import type { MiddlewareHandler } from "hono";

/* Firebase検証の代わりにデバッグ用userId抽出を行う暫定ミドルウェア。 */
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.path === "/v1/health") {
    return await next();
  }
  const header = c.req.header("authorization");
  const fallback = c.req.header("x-user-id");
  const userId = extractUserId(header) ?? (fallback ? fallback.trim() : undefined);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }
  c.set("userId", userId);
  await next();
};

function extractUserId(authHeader?: string | null): string | undefined {
  /* `Authorization: Bearer <uid>` 形式をシンプルに解釈する。 */
  if (!authHeader) return undefined;
  const matches = authHeader.match(/^Bearer (.+)$/i);
  if (!matches) return undefined;
  return matches[1]?.trim();
}

export type AppEnv = {
  Variables: {
    userId: string;
  };
};
