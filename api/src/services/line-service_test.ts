import { assertEquals } from "jsr:@std/assert@1.0.8";
import { LineService } from "./line-service.ts";

Deno.test("LineService sends push message", async () => {
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? undefined;
  const to = Deno.env.get("LINE_TEST_TO") ?? Deno.env.get("LINE_NOTIFICATION_TO") ??
    undefined;
  const looksLikeLineUserId = (value: string) => /^U[0-9a-f]{10,}$/i.test(value);

  if (!token || !to || !looksLikeLineUserId(to)) {
    console.warn(
      "Skip LINE push test: require LINE_CHANNEL_ACCESS_TOKEN and LINE_TEST_TO/LINE_NOTIFICATION_TO starting with 'U...'",
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
