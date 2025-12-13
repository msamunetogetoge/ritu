import type { Context, MiddlewareHandler, Next } from "hono";
import { getLogger } from "../lib/logger.ts";
import type { AppEnv } from "./auth.ts";

export const loggerMiddleware: MiddlewareHandler<AppEnv> = async (c: Context<AppEnv>, next: Next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;

  const { method, path } = c.req;
  const status = c.res.status;
  const userId = c.get("userId") ?? "anonymous";

  const msg = `${method} ${path} ${status} - ${ms}ms - User: ${userId}`;

  /* ステータスに応じてログレベルを変える */
  const logger = getLogger();
  if (status >= 500) {
    logger.error(msg);
  } else if (status >= 400) {
    logger.warn(msg);
  } else {
    logger.info(msg);
  }
};
