import { Hono, type Context } from "hono";
import type { AppEnv } from "../middlewares/auth.ts";
import { type UserService } from "../services/user-service.ts";
import type { UserUpdateInput } from "../types.ts";

export function registerUserRoutes(app: Hono<AppEnv>, service: UserService) {
  app.get("/v1/users/me", async (c: Context<AppEnv>) => {
    const userId = c.get("userId");
    try {
      const user = await service.getMe(userId);
      return c.json(user);
    } catch (e: unknown) {
      const err = e as { code?: number; status?: number };
      // If 404, maybe return null or 404? Service throws specific errors.
      if (err.code === 404 || err.status === 404) {
         // Special handling: if user queries /me and it doesn't exist, we might return 404
         // frontend should detect and prompt creation.
         throw e;
      }
      throw e;
    }
  });

  app.patch("/v1/users/me", async (c: Context<AppEnv>) => {
    const userId = c.get("userId");
    const body = await c.req.json<UserUpdateInput>();
    const user = await service.updateMe(userId, body);
    return c.json(user);
  });
}
