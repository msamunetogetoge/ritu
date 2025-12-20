import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.8";
import { LineLoginService } from "./line-login-service.ts";

Deno.test("LineLoginService.verifyIdToken posts token to LINE verify API", async () => {
  const calls: { url: string; body?: URLSearchParams }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body as URLSearchParams });
    const payload = {
      sub: "U1234567890",
      name: "Line User",
      picture: "https://example.com/p.png",
      exp: 2,
      iss: "https://access.line.me",
    };
    return Promise.resolve(
      new Response(JSON.stringify(payload), { status: 200 }),
    );
  };

  try {
    const service = new LineLoginService("channel-1");
    const result = await service.verifyIdToken("id-token");

    assertEquals(result.lineUserId, "U1234567890");
    assertEquals(result.displayName, "Line User");
    assertEquals(result.pictureUrl, "https://example.com/p.png");
    assertEquals(result.expiresAt, 2000);
    assertEquals(result.issuer, "https://access.line.me");

    assertEquals(calls[0]?.url, "https://api.line.me/oauth2/v2.1/verify");
    assertEquals(calls[0]?.body?.get("id_token"), "id-token");
    assertEquals(calls[0]?.body?.get("client_id"), "channel-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("LineLoginService.verifyIdToken requires channel id", async () => {
  const service = new LineLoginService("");
  await assertRejects(
    async () => await service.verifyIdToken("token"),
    Error,
    "LINE_LOGIN_CHANNEL_ID is not configured.",
  );
});
