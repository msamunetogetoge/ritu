#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env
import {
  fromFileUrl,
  join,
  relative,
} from "https://deno.land/std@0.208.0/path/mod.ts";

const webRoot = fromFileUrl(new URL("..", import.meta.url));
const entryFile = "main.tsx";
const outFile = join("dist", "main.js");

async function runDenoCommand(
  args: Array<string>,
  label: string
): Promise<void> {
  const command = new Deno.Command(Deno.execPath(), {
    args,
    cwd: webRoot,
    stdout: "piped",
    stderr: "piped",
  });

  console.info(`Running: deno ${args.join(" ")}`);
  console.info(`(in ${webRoot})`);

  const { code, stdout, stderr } = await command.output();
  const stdoutText = new TextDecoder().decode(stdout);
  const stderrText = new TextDecoder().decode(stderr);

  if (code !== 0) {
    const message = [stdoutText, stderrText].filter(Boolean).join("\n");
    throw new Error(`${label} failed.\n${message}`);
  }

  if (stdoutText.trim()) {
    console.log(stdoutText.trim());
  }
  if (stderrText.trim()) {
    console.error(stderrText.trim());
  }
}

export async function build(): Promise<void> {
  await Deno.mkdir(join(webRoot, "dist"), { recursive: true });

  await runDenoCommand(["check", entryFile], "deno check");
  await runDenoCommand(["bundle", entryFile, outFile], "deno bundle");

  const entryRel = relative(webRoot, join(webRoot, entryFile));
  const outRel = relative(webRoot, join(webRoot, outFile));
  console.log(`Bundled ${entryRel} → ${outRel}`);
}

if (import.meta.main) {
  await build();
}
