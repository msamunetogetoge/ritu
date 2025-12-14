import { fromFileUrl } from "https://deno.land/std@0.208.0/path/mod.ts";

const root = new URL("../", import.meta.url);
const cwd = fromFileUrl(root);

const firebaseBin = Deno.build.os === "windows" ? "firebase.cmd" : "firebase";
const localFirebasePath = new URL(`../ritu/node_modules/.bin/${firebaseBin}`, import.meta.url);
let executable = "firebase";

try {
  const stat = await Deno.stat(localFirebasePath);
  if (stat.isFile) {
    executable = fromFileUrl(localFirebasePath);
    console.log(`[emulator] Using local firebase: ${executable}`);
  }
} catch {
  console.log("[emulator] Using global firebase");
  // Review feedback: Ensure fallback uses .cmd on Windows
  if (Deno.build.os === "windows" && executable === "firebase") {
    executable = "firebase.cmd";
  }
}

const command = new Deno.Command(executable, {
  args: ["emulators:start", "--only", "firestore,auth"],
  cwd,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const child = command.spawn();

const signals: Deno.Signal[] = ["SIGINT"];
if (Deno.build.os !== "windows") {
  signals.push("SIGTERM");
}

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
