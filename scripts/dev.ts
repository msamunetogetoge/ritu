import { fromFileUrl } from "@std/path";

const root = new URL("../", import.meta.url);

interface ProcSpec {
  name: string;
  cwd: string;
  args: string[];
}

const processes: ProcSpec[] = [
  {
    name: "api",
    cwd: fromFileUrl(new URL("api/", root)),
    args: ["task", "dev"],
  },
  {
    name: "web",
    cwd: fromFileUrl(new URL("ritu/", root)),
    args: ["task", "dev"],
  },
];

const children = processes.map((proc) => ({
  ...proc,
  command: new Deno.Command(Deno.execPath(), {
    args: proc.args,
    cwd: proc.cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }),
}));

const running = children.map((entry) => ({
  name: entry.name,
  proc: entry.command.spawn(),
}));

let shuttingDown = false;

async function shutdown(signal?: Deno.Signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(
    `\n[dev] stopping processes${signal ? ` (signal: ${signal})` : ""}...`,
  );
  await Promise.allSettled(
    running.map(async ({ proc, name }) => {
      try {
        proc.kill("SIGTERM");
      } catch (error) {
        if (error instanceof Deno.errors.NotSupported) {
          try {
            proc.kill();
            return;
          } catch (fallbackError) {
            console.error(
              `[dev:${name}] failed to kill process`,
              fallbackError,
            );
          }
        } else {
          console.error(`[dev:${name}] failed to send SIGTERM`, error);
        }
      }
      try {
        await proc.status;
      } catch {
        // ignore
      }
    }),
  );
}

const signalHandlers: Array<[Deno.Signal, () => void]> = [
  ["SIGINT", () => shutdown("SIGINT").then(() => Deno.exit(0))],
  ["SIGTERM", () => shutdown("SIGTERM").then(() => Deno.exit(0))],
];

for (const [signal, handler] of signalHandlers) {
  Deno.addSignalListener(signal, handler);
}

const winner = await Promise.race(
  running.map(async ({ proc, name }) => {
    const status = await proc.status;
    return { name, status };
  }),
);

console.log(
  `\n[dev] process '${winner.name}' exited with code ${winner.status.code}`,
);
await shutdown();

Deno.exit(winner.status.code);
