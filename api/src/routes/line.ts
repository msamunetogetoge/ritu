import { Hono, type Context } from "hono";
import { LineService } from "../services/line-service.ts";

export const registerLineRoutes = (app: Hono<any>, lineService: LineService) => {
  const line = new Hono();

  /**
   * GET /v1/line/config
   * Returns LINE configuration (Friend URL, QR Code) for frontend display.
   */
  line.get("/config", (c: Context) => {
    const config = lineService.getLineConfig();
    return c.json(config);
  });

  /**
   * POST /v1/line/webhook
   * Receives Webhook events from LINE Platform.
   * Verifies signature and processes events.
   */
  line.post("/webhook", async (c: Context) => {
    const signature = c.req.header("x-line-signature");
    const body = await c.req.text();
    const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";

    if (!signature) {
      return c.json({ message: "Missing signature" }, 401);
    }

    const isValid = await lineService.verifySignature(body, signature, channelSecret);
    if (!isValid) {
      console.warn("[LINE Webhook] Invalid signature");
      return c.json({ message: "Invalid signature" }, 403);
    }

    try {
      const json = JSON.parse(body);
      const events = json.events ?? [];
      await lineService.handleWebhookEvent(events);
      return c.json({ status: "ok" });
    } catch (e) {
      console.error("[LINE Webhook] Error processing events", e);
      return c.json({ message: "Internal Server Error" }, 500);
    }
  });

  app.route("/v1/line", line);
};
