import { Hono } from "hono";
import type { AppEnv } from "./middlewares/auth.ts";
import { authMiddleware } from "./middlewares/auth.ts";
import { registerRoutineRoutes } from "./routes/routines.ts";
import { RoutineService } from "./services/routine-service.ts";
import { InMemoryRoutineRepository } from "./repositories/in-memory.ts";
import { ServiceError } from "./services/errors.ts";
import { FirestoreRoutineRepository } from "./repositories/firestore.ts";
import { FirestoreClient } from "./lib/firestore-client.ts";
import type { RoutineRepository } from "./repositories/routine-repository.ts";

export interface AppOptions {
  routineService?: RoutineService;
  repository?: RoutineRepository;
}

/* createAppはHonoインスタンスを組み立て、認証・ルーティング・エラーハンドリングを束ねる。 */
export function createApp(options: AppOptions = {}) {
  const repository = options.repository ?? createDefaultRepository();
  const routineService = options.routineService ??
    new RoutineService({ repository });

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

function createDefaultRepository(): RoutineRepository {
  const forceMemory = Deno.env.get("ROUTINE_REPOSITORY") === "memory";
  if (forceMemory) {
    console.info("[app] Using in-memory routine repository (forced by env).");
    return new InMemoryRoutineRepository();
  }

  const projectId = Deno.env.get("FIRESTORE_PROJECT_ID") ??
    Deno.env.get("GOOGLE_CLOUD_PROJECT");
  if (!projectId) {
    console.warn(
      "[app] FIRESTORE_PROJECT_ID not set. Falling back to in-memory repository.",
    );
    return new InMemoryRoutineRepository();
  }

  const emulatorHost = Deno.env.get("FIRESTORE_EMULATOR_HOST");
  const database = Deno.env.get("FIRESTORE_DATABASE") ?? "(default)";
  const credentialsPath = Deno.env.get("GOOGLE_APPLICATION_CREDENTIALS");
  const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

  try {
    const client = new FirestoreClient({
      projectId,
      database,
      emulatorHost,
      credentialsPath,
      serviceAccountJson,
    });
    console.info(
      `[app] Using Firestore routine repository (projectId=${projectId}, database=${database}${
        emulatorHost ? `, emulatorHost=${emulatorHost}` : ""
      }).`,
    );
    return new FirestoreRoutineRepository({ client });
  } catch (error) {
    console.error(
      "[app] Failed to initialise Firestore repository. Falling back to in-memory.",
      error,
    );
    return new InMemoryRoutineRepository();
  }
}
