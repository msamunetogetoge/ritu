import { type Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cors } from "hono/cors";
import type { AppEnv } from "./middlewares/auth.ts";
import { authMiddleware } from "./middlewares/auth.ts";
import { loggerMiddleware } from "./middlewares/logger.ts";
import { registerRoutineRoutes } from "./routes/routines.ts";
import { registerUserRoutes } from "./routes/users.ts";
import { registerCommunityRoutes } from "./routes/community.ts";
import { registerLineRoutes } from "./routes/line.ts";
import { RoutineService } from "./services/routine-service.ts";
import { UserService } from "./services/user-service.ts";
import { CommunityService } from "./services/community-service.ts";
import { LineService } from "./services/line-service.ts";
import { LineLoginService } from "./services/line-login-service.ts";
import {
  InMemoryCommunityRepository,
  InMemoryRoutineRepository,
  InMemoryUserRepository,
} from "./repositories/in-memory.ts";
import { ServiceError } from "./services/errors.ts";
import { FirestoreRoutineRepository } from "./repositories/firestore.ts";
import {
  FirestoreUserRepository,
  type UserRepository,
} from "./repositories/user-repository.ts";
import {
  type CommunityRepository,
  FirestoreCommunityRepository,
} from "./repositories/community-repository.ts";
import { FirestoreClient } from "./lib/firestore-client.ts";
import type { RoutineRepository } from "./repositories/routine-repository.ts";

export interface AppOptions {
  routineService?: RoutineService;
  userService?: UserService;
  communityService?: CommunityService;
  lineService?: LineService;
  lineLoginService?: LineLoginService;
  repository?: RoutineRepository; // Simplify: legacy prop
  routineRepository?: RoutineRepository;
  userRepository?: UserRepository;
  communityRepository?: CommunityRepository;
  enableLineRoutes?: boolean;
}

/* createAppはHonoインスタンスを組み立て、認証・ルーティング・エラーハンドリングを束ねる。 */
export function createApp(options: AppOptions = {}) {
  const routineRepo = options.routineRepository ?? options.repository ??
    createDefaultRoutineRepository();
  const userRepo = options.userRepository ?? createDefaultUserRepository();
  const communityRepo = options.communityRepository ??
    createDefaultCommunityRepository();
  const enableLineRoutes = options.enableLineRoutes ?? true;

  const routineService = options.routineService ??
    new RoutineService({ repository: routineRepo, userRepository: userRepo });
  const userService = options.userService ??
    new UserService({ repository: userRepo });
  const communityService = options.communityService ??
    new CommunityService({ repository: communityRepo });
  const lineService = options.lineService ??
    new LineService(
      Deno.env.get("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN") ??
        Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ??
        "",
    );
  const lineLoginService = options.lineLoginService ??
    new LineLoginService(Deno.env.get("LINE_LOGIN_CHANNEL_ID") ?? "");

  const app = new Hono<AppEnv>();

  app.use(
    "*",
    cors({
      origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://ritu-9cfb0.web.app",
        "https://ritu-9cfb0.firebaseapp.com",
      ],
      allowHeaders: ["Content-Type", "Authorization", "X-User-Id"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }),
  );

  app.use("*", loggerMiddleware);

  app.get("/v1/health", (c: Context) => c.json({ status: "ok" }));

  // app.use("/v1/*", authMiddleware);
  // Skipped for public webhooks. We will apply auth middleware selectively or use exclusion.
  app.use("/v1/*", async (c, next) => {
    if (c.req.path === "/v1/line/webhook") {
      await next();
      return;
    }
    return authMiddleware(c, next);
  });

  registerRoutineRoutes(app, routineService);
  registerUserRoutes(app, userService);
  registerCommunityRoutes(app, communityService);
  if (enableLineRoutes) {
    registerLineRoutes(app, lineService, userService, lineLoginService);
  }

  app.onError((err: Error, c: Context<AppEnv>) => {
    /* ドメインエラーはコード付きで返し、それ以外は500にフォールバック。 */
    if (err instanceof ServiceError) {
      return c.json(
        { message: err.message, code: err.code },
        err.status as ContentfulStatusCode,
      );
    }
    console.error(err);
    return c.json({ message: "internal server error" }, 500);
  });

  return app;
}

function createDefaultRoutineRepository(): RoutineRepository {
  const forceMemory = Deno.env.get("ROUTINE_REPOSITORY") === "memory"; // Keep legacy env for now
  if (forceMemory) return new InMemoryRoutineRepository();

  const client = createFirestoreClient();
  if (client) {
    return new FirestoreRoutineRepository({ client });
  }
  return new InMemoryRoutineRepository();
}

function createDefaultUserRepository(): UserRepository {
  const client = createFirestoreClient();
  if (client) {
    return new FirestoreUserRepository({ client });
  }

  console.warn(
    "No Firestore client for UserRepo. Using InMemoryUserRepository.",
  );
  return new InMemoryUserRepository();
}

function createDefaultCommunityRepository(): CommunityRepository {
  const client = createFirestoreClient();
  if (client) {
    return new FirestoreCommunityRepository({ client });
  }
  console.warn(
    "No Firestore client for CommunityRepo. Using InMemoryCommunityRepository.",
  );
  return new InMemoryCommunityRepository();
}

function createFirestoreClient(): FirestoreClient | null {
  const projectId = Deno.env.get("FIRESTORE_PROJECT_ID") ??
    Deno.env.get("GOOGLE_CLOUD_PROJECT");

  if (!projectId) {
    return null;
  }

  const emulatorHost = Deno.env.get("FIRESTORE_EMULATOR_HOST");
  const database = Deno.env.get("FIRESTORE_DATABASE") ?? "(default)";
  const credentialsPath = Deno.env.get("GOOGLE_APPLICATION_CREDENTIALS");
  const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

  try {
    return new FirestoreClient({
      projectId,
      database,
      emulatorHost,
      credentialsPath,
      serviceAccountJson,
    });
  } catch (error) {
    console.error("Failed to init FirestoreClient", error);
    return null;
  }
}
