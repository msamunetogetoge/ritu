import { assertEquals } from "jsr:@std/assert@1.0.8";
import { Hono } from "hono";
import { registerLineRoutes } from "./line.ts";
import { LineService } from "../services/line-service.ts";
import type { UserService } from "../services/user-service.ts";
import type { LineLoginService } from "../services/line-login-service.ts";
import type { AppEnv } from "../middlewares/auth.ts";

Deno.test("GET /v1/line/config returns config from service", async () => {
  const app = new Hono<AppEnv>();
  const mockService = {
    getLineConfig: () => ({
      friendUrl: "http://test.url",
      friendQr: "http://test.qr",
    }),
  } as unknown as LineService;
  const mockUserService = {} as UserService;

  registerLineRoutes(app, mockService, mockUserService);

  const res = await app.request("/v1/line/config");
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json, {
    friendUrl: "http://test.url",
    friendQr: "http://test.qr",
  });
});

Deno.test("POST /v1/line/webhook checks signature", async () => {
  const app = new Hono<AppEnv>();
  const mockService = {
    verifySignature: (_b: string, s: string) => Promise.resolve(s === "valid"),
    handleWebhookEvent: () => Promise.resolve(),
  } as unknown as LineService;
  const mockUserService = {} as UserService;

  registerLineRoutes(app, mockService, mockUserService);

  // Missing signature
  const res1 = await app.request("/v1/line/webhook", {
    method: "POST",
    body: "{}",
  });
  assertEquals(res1.status, 401);

  // Invalid signature
  const res2 = await app.request("/v1/line/webhook", {
    method: "POST",
    headers: { "x-line-signature": "invalid" },
    body: "{}",
  });
  assertEquals(res2.status, 403);

  // Valid signature
  const res3 = await app.request("/v1/line/webhook", {
    method: "POST",
    headers: { "x-line-signature": "valid" },
    body: "{}",
  });
  assertEquals(res3.status, 200);
});

Deno.test("POST /v1/line/login returns 503 when LINE Login is not configured", async () => {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("userId", "user-1");
    await next();
  });

  const mockLineService = {
    getLineConfig: () => ({}),
    verifySignature: () => Promise.resolve(true),
    handleWebhookEvent: () => Promise.resolve(),
  } as unknown as LineService;
  const mockUserService = {} as UserService;

  registerLineRoutes(app, mockLineService, mockUserService);

  const res = await app.request("/v1/line/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: "id-token" }),
  });

  assertEquals(res.status, 503);
});

Deno.test("POST /v1/line/login stores lineUserId and returns user", async () => {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("userId", "user-1");
    await next();
  });
  let receivedContext:
    | {
      code?: string;
      state?: string;
      liffClientId?: string;
      liffRedirectUri?: string;
    }
    | undefined;

  const mockLineService = {
    getLineConfig: () => ({}),
    verifySignature: () => Promise.resolve(true),
    handleWebhookEvent: () => Promise.resolve(),
  } as unknown as LineService;
  const mockUserService = {
    linkLineUserId: (
      _userId: string,
      lineUserId: string,
      _profile?: { displayName?: string; photoUrl?: string | null },
      lineLoginContext?: {
        code?: string;
        state?: string;
        liffClientId?: string;
        liffRedirectUri?: string;
      },
    ) => {
      receivedContext = lineLoginContext;
      return Promise.resolve({
        id: "user-1",
        displayName: "Test User",
        photoUrl: null,
        notificationSettings: {
          emailEnabled: false,
          lineEnabled: true,
          lineUserId,
        },
        createdAt: "now",
        updatedAt: "now",
      });
    },
  } as unknown as UserService;
  const mockLineLoginService = {
    verifyIdToken: (token: string) =>
      Promise.resolve({
        lineUserId: `line-${token}`,
        displayName: "Line User",
        pictureUrl: "http://example.com/line.jpg",
        expiresAt: 1,
      }),
  } as unknown as LineLoginService;

  registerLineRoutes(
    app,
    mockLineService,
    mockUserService,
    mockLineLoginService,
  );

  const res = await app.request("/v1/line/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken: "id-token",
      lineLoginContext: {
        code: "code-123",
        state: "state-456",
        liffClientId: "liff-789",
        liffRedirectUri: "http://localhost:5173/settings/notifications",
      },
    }),
  });

  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.lineUserId, "line-id-token");
  assertEquals(json.user.notificationSettings.lineUserId, "line-id-token");
  assertEquals(receivedContext?.code, "code-123");
});
