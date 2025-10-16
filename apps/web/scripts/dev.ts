#!/usr/bin/env -S deno run --watch=apps/web --allow-run --allow-read --allow-write --allow-net --allow-env
import { serveDir } from "https://deno.land/std@0.208.0/http/file_server.ts";
import { fromFileUrl } from "https://deno.land/std@0.208.0/path/mod.ts";
import { build } from "./build.ts";

const webRoot = fromFileUrl(new URL("..", import.meta.url));
const port = Number(Deno.env.get("PORT") ?? 5173);

await build();

console.log(`Starting dev server on http://localhost:${port}`);

const server = Deno.serve({ port }, (request) =>
  serveDir(request, {
    fsRoot: webRoot,
    quiet: true,
  })
);

await server.finished;
