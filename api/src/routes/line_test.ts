import { assertEquals } from "jsr:@std/assert@1.0.8";
import { Hono } from "hono";
import { registerLineRoutes } from "./line.ts";
import { LineService } from "../services/line-service.ts";

Deno.test("GET /v1/line/config returns config from service", async () => {
  const app = new Hono();
  const mockService = {
    getLineConfig: () => ({ friendUrl: "http://test.url", friendQr: "http://test.qr" }),
  } as unknown as LineService;

  registerLineRoutes(app, mockService);

  const res = await app.request("/v1/line/config");
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json, { friendUrl: "http://test.url", friendQr: "http://test.qr" });
});

Deno.test("POST /v1/line/webhook checks signature", async () => {
  const app = new Hono();
  const mockService = {
    verifySignature: (_b: string, s: string) => Promise.resolve(s === "valid"),
    handleWebhookEvent: () => Promise.resolve(),
  } as unknown as LineService;

  registerLineRoutes(app, mockService);

  // Missing signature
  const res1 = await app.request("/v1/line/webhook", { method: "POST", body: "{}" });
  assertEquals(res1.status, 401);

  // Invalid signature
  const res2 = await app.request("/v1/line/webhook", {
    method: "POST",
    headers: { "x-line-signature": "invalid" },
    body: "{}"
  });
  assertEquals(res2.status, 403);

  // Valid signature
  const res3 = await app.request("/v1/line/webhook", {
    method: "POST",
    headers: { "x-line-signature": "valid" },
    body: "{}"
  });
  assertEquals(res3.status, 200);
});
