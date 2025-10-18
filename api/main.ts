import { createApp } from "./src/app.ts";

const app = createApp();

/* Cloud Run想定の単純なHTTPエントリーポイント。 */
Deno.serve((req) => app.fetch(req));
