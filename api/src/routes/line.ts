import { type Context, Hono } from "hono";
import type { AppEnv } from "../middlewares/auth.ts";
import { LineService } from "../services/line-service.ts";
import { LineLoginService } from "../services/line-login-service.ts";
import { type UserService } from "../services/user-service.ts";
import { ServiceError } from "../services/errors.ts";

export const registerLineRoutes = (
  app: Hono<AppEnv>,
  lineService: LineService,
  userService: UserService,
  lineLoginService?: LineLoginService,
) => {
  const line = new Hono<AppEnv>();
  const isLocal = () => !Deno.env.get("K_SERVICE");

  /**
   * GET /v1/line/config
   * Returns LINE configuration (Friend URL, QR Code) for frontend display.
   */
  line.get("/config", (c: Context) => {
    const config = lineService.getLineConfig();
    return c.json(config);
  });

  /**
   * POST /v1/line/login
   * Accepts LINE Login ID token and stores the associated LINE userId to the profile.
   * Requires Firebase authentication (handled by upstream middleware).
   */
  line.post("/login", async (c: Context<AppEnv>) => {
    if (!lineLoginService) {
      return c.json({ message: "LINE Login is not configured" }, 503);
    }
    const userId = c.get("userId");
    const body = await c.req.json<{ idToken?: string }>().catch(() => null);
    const idToken = body?.idToken;
    if (!idToken) {
      return c.json({ message: "idToken is required" }, 400);
    }

    try {
      const login = await lineLoginService.verifyIdToken(idToken);
      const user = await userService.linkLineUserId(userId, login.lineUserId);
      if (isLocal()) {
        console.debug(
          `[LINE Login][DEBUG] linked user=${userId} lineUserId=${login.lineUserId}`,
        );
      }
      return c.json({
        lineUserId: login.lineUserId,
        linked: true,
        expiresAt: login.expiresAt,
        issuer: login.issuer,
        user,
      });
    } catch (e) {
      console.error("[LINE Login] Failed to link user", e);
      if (e instanceof ServiceError) {
        throw e;
      }
      const message = e instanceof Error ? e.message : "LINE Login failed";
      if (message.includes("not configured")) {
        return c.json({ message }, 503);
      }
      return c.json({ message }, 400);
    }
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

    const isValid = await lineService.verifySignature(
      body,
      signature,
      channelSecret,
    );
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
