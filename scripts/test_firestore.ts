import { fromFileUrl } from "https://deno.land/std@0.208.0/path/mod.ts";

const root = new URL("../", import.meta.url);
const apiDir = fromFileUrl(new URL("api/", root));
const denoCmd = Deno.execPath();

const env = {
  ...Deno.env.toObject(),
  FIRESTORE_EMULATOR_HOST: "localhost:8080",
  FIRESTORE_PROJECT_ID: Deno.env.get("FIRESTORE_PROJECT_ID") ?? "ritu-emulator",
  ROUTINE_REPOSITORY: "firestore",
};

await ensureEmulatorRunning();

const command = new Deno.Command(denoCmd, {
  cwd: apiDir,
  args: [
    "test",
    "--allow-env",
    "--allow-net",
    "--allow-read",
    "--filter",
    "FirestoreRoutineRepository",
  ],
  env,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const status = await command.spawn().status;
if (!status.success) {
  console.error(`deno test failed with code ${status.code}`);
  Deno.exit(status.code ?? 1);
}

async function ensureEmulatorRunning() {
  try {
    const connection = await Deno.connect({
      hostname: "127.0.0.1",
      port: 8080,
    });
    connection.close();
  } catch (error) {
    console.error(
      "Firestore emulator (localhost:8080) へ接続できませんでした。先に `deno task emulator` もしくは `firebase emulators:start --only firestore,auth` を実行してください。",
    );
    console.error(error);
    Deno.exit(1);
  }
}
