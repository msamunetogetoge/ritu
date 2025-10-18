import { Hono } from "hono";
import type { AppEnv } from "./middlewares/auth.ts";
import { authMiddleware } from "./middlewares/auth.ts";
import { registerRoutineRoutes } from "./routes/routines.ts";
import { RoutineService } from "./services/routine-service.ts";
import { InMemoryRoutineRepository } from "./repositories/in-memory.ts";
import { ServiceError } from "./services/errors.ts";

export interface AppOptions {
  routineService?: RoutineService;
}

/* createAppはHonoインスタンスを組み立て、認証・ルーティング・エラーハンドリングを束ねる。 */
export function createApp(options: AppOptions = {}) {
  const routineService = options.routineService ??
    new RoutineService({ repository: new InMemoryRoutineRepository() });

  const app = new Hono<AppEnv>();

  app.get("/v1/health", (c) => c.json({ status: "ok" }));

  app.use("/v1/*", authMiddleware);

  registerRoutineRoutes(app, routineService);

  app.onError((err, c) => {
    /* ドメインエラーはコード付きで返し、それ以外は500にフォールバック。 */
    if (err instanceof ServiceError) {
      return c.json({ message: err.message, code: err.code }, err.status);
    }
    console.error(err);
    return c.json({ message: "internal server error" }, 500);
  });

  return app;
}
