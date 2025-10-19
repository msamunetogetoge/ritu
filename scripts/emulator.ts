import { fromFileUrl } from "https://deno.land/std@0.208.0/path/mod.ts";

const root = new URL("../", import.meta.url);
const cwd = fromFileUrl(root);

const command = new Deno.Command("firebase", {
  args: ["emulators:start", "--only", "firestore,auth"],
  cwd,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const child = command.spawn();

const signals: Deno.Signal[] = ["SIGINT", "SIGTERM"];
let shuttingDown = false;

async function shutdown(signal: Deno.Signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[emulator] shutting down (signal: ${signal})...`);
  try {
    child.kill("SIGINT");
  } catch {
    try {
      child.kill();
    } catch {
      // ignore
    }
  }
  await child.status.catch(() => undefined);
  Deno.exit(0);
}

for (const signal of signals) {
  Deno.addSignalListener(signal, () => {
    shutdown(signal);
  });
}

const status = await child.status;
if (status.success) {
  Deno.exit(0);
}

console.error(`firebase emulators:start exited with code ${status.code}`);
Deno.exit(status.code ?? 1);
