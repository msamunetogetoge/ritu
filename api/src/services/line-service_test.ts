import { assertEquals } from "jsr:@std/assert@1.0.8";
import { LineService } from "./line-service.ts";

Deno.test("LineService sends push message", async () => {
  const token = Deno.env.get("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN") ??
    Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? undefined;
  const to = Deno.env.get("LINE_TEST_TO") ?? Deno.env.get("LINE_NOTIFICATION_TO") ??
    undefined;
  // const looksLikeLineUserId = (value: string) => /^U[0-9a-f]{10,}$/i.test(value);
  const looksLikeLineUserId = (value: string) => /^[0-9a-z]{10,}$/i.test(value);
  console.info(`LINE test push to ${to}`);
  console.info(`LINE test push to ${to}`);
  // console.info(`LINE test push to ${token}`); // Removed to prevent token leak

  if (!token || !to || !looksLikeLineUserId(to)) {
    console.warn(
      "Skip LINE push test: require LINE_MESSAGING_CHANNEL_ACCESS_TOKEN and LINE_TEST_TO/LINE_NOTIFICATION_TO starting with 'U...'",
    );
    return;
  }

  const service = new LineService(token);
  console.info(`Sending LINE test push to ${to}`);
  
  await service.sendPushMessage(
    to,
    "PoC通知テスト: LINE通知PoC from deno test",
  );
  assertEquals(true, true);
});

Deno.test("LineService configuration", () => {
  Deno.env.set("LINE_FRIEND_URL", "https://line.me/R/ti/p/@example");
  Deno.env.set("LINE_FRIEND_QR", "https://qr-code.example.com");

  const service = new LineService("token");
  const config = service.getLineConfig();

  assertEquals(config.friendUrl, "https://line.me/R/ti/p/@example");
  assertEquals(config.friendQr, "https://qr-code.example.com");
});

Deno.test("LineService webhook signature verification (mock)", async () => {
  const service = new LineService("token");
  const body = JSON.stringify({ events: [] });
  // Need a known key/signature pair to test true positive manually if we implemented HMAC.
  // Or better, let's trust crypto API works and test the logic flow.

  const secret = "secret";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  const isValid = await service.verifySignature(body, signature, secret);
  assertEquals(isValid, true, "Signature should be valid");

  const isInvalid = await service.verifySignature(body, "invalidsig", secret);
  assertEquals(isInvalid, false, "Signature should be invalid");
});
