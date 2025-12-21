import { createApp } from "./src/app.ts";
import { setupLogger } from "./src/lib/logger.ts";
import { FirestoreClient } from "./src/lib/firestore-client.ts";
import { FirestoreRoutineRepository } from "./src/repositories/firestore.ts";
import { FirestoreUserRepository } from "./src/repositories/user-repository.ts";
import { FirestoreCommunityRepository } from "./src/repositories/community-repository.ts";
import {
  InMemoryCommunityRepository,
  InMemoryRoutineRepository,
  InMemoryUserRepository,
} from "./src/repositories/in-memory.ts";
import { LineService } from "./src/services/line-service.ts";
import { NotificationWorker } from "./src/services/notification-worker.ts";
import { RoutineService } from "./src/services/routine-service.ts";
import { UserService } from "./src/services/user-service.ts";
import { CommunityService } from "./src/services/community-service.ts";

// Initialize Logger
await setupLogger();

function readFlag(envName: string, fallback: boolean): boolean {
  const raw = Deno.env.get(envName);
  if (raw === undefined) return fallback;
  return raw.toLowerCase() === "true";
}

function createFirestoreClient(): FirestoreClient | null {
  const projectId = Deno.env.get("FIRESTORE_PROJECT_ID") ??
    Deno.env.get("GOOGLE_CLOUD_PROJECT");

  if (!projectId) return null;

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

const client = createFirestoreClient();

// Initialize Repositories
const forceMemory = Deno.env.get("ROUTINE_REPOSITORY") === "memory";

const routineRepo = (!forceMemory && client)
  ? new FirestoreRoutineRepository({ client })
  : new InMemoryRoutineRepository();

const userRepo = client ? new FirestoreUserRepository({ client }) : new InMemoryUserRepository();

const communityRepo = client
  ? new FirestoreCommunityRepository({ client })
  : new InMemoryCommunityRepository();

if (userRepo instanceof InMemoryUserRepository) {
  await userRepo.create("mock-token", {
    displayName: "Mock User",
    photoUrl: null,
    notificationSettings: {
      emailEnabled: false,
      lineEnabled: false,
    },
    isPremium: false,
  });
}

// Initialize Services
const routineService = new RoutineService({ repository: routineRepo, userRepository: userRepo });
const userService = new UserService({ repository: userRepo });
const communityService = new CommunityService({ repository: communityRepo });

// Initialize Notification Worker
const lineEnabled = readFlag("FEATURE_FLAG_LINE_INTEGRATION", false);
const notificationsEnabled = readFlag("FEATURE_FLAG_NOTIFICATIONS", false);
const legacyLineAccessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
const lineChannelAccessToken = Deno.env.get("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN") ??
  legacyLineAccessToken ?? "";
if (legacyLineAccessToken) {
  console.warn(
    "[Notification] LINE_CHANNEL_ACCESS_TOKEN is deprecated. Use LINE_MESSAGING_CHANNEL_ACCESS_TOKEN.",
  );
}
if (lineEnabled && !lineChannelAccessToken) {
  console.warn(
    "[Notification] LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is not set. Falling back to mock send.",
  );
}
const lineService = new LineService(lineChannelAccessToken);
const notificationWorker = new NotificationWorker(userRepo, routineRepo, lineService);

if (lineEnabled && notificationsEnabled) {
  notificationWorker.start();
} else {
  console.info(`[Notification] Disabled (line=${lineEnabled}, notifications=${notificationsEnabled})`);
}

const app = createApp({
  routineService,
  userService,
  communityService,
  routineRepository: routineRepo,
  userRepository: userRepo,
  communityRepository: communityRepo,
  enableLineRoutes: lineEnabled,
});

/* Cloud Run想定の単純なHTTPエントリーポイント。 */
const port = parseInt(Deno.env.get("PORT") ?? "8080");
console.log(`Server starting on port ${port}...`);
Deno.serve({ port }, (req) => app.fetch(req));
