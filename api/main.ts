import { createApp } from "./src/app.ts";
import { setupLogger } from "./src/lib/logger.ts";
import { FirestoreClient } from "./src/lib/firestore-client.ts";
import { FirestoreRoutineRepository } from "./src/repositories/firestore.ts";
import { FirestoreUserRepository } from "./src/repositories/user-repository.ts";
import { FirestoreCommunityRepository } from "./src/repositories/community-repository.ts";
import { InMemoryRoutineRepository, InMemoryUserRepository, InMemoryCommunityRepository } from "./src/repositories/in-memory.ts";
import { LineService } from "./src/services/line-service.ts";
import { NotificationWorker } from "./src/services/notification-worker.ts";
import { RoutineService } from "./src/services/routine-service.ts";
import { UserService } from "./src/services/user-service.ts";
import { CommunityService } from "./src/services/community-service.ts";

// Initialize Logger
await setupLogger();

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

const userRepo = (client) 
  ? new FirestoreUserRepository({ client }) 
  : new InMemoryUserRepository();
  
const communityRepo = (client)
  ? new FirestoreCommunityRepository({ client })
  : new InMemoryCommunityRepository();

// Initialize Services
const routineService = new RoutineService({ repository: routineRepo, userRepository: userRepo });
const userService = new UserService({ repository: userRepo });
const communityService = new CommunityService({ repository: communityRepo });

// Initialize Notification Worker
const lineChannelAccessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const lineService = new LineService(lineChannelAccessToken);
const notificationWorker = new NotificationWorker(userRepo, routineRepo, lineService);

// Start Worker (only if allowed or in specific env? For now always)
notificationWorker.start();

const app = createApp({
  routineService,
  userService,
  communityService,
  routineRepository: routineRepo,
  userRepository: userRepo,
  communityRepository: communityRepo,
});

/* Cloud Run想定の単純なHTTPエントリーポイント。 */
const port = parseInt(Deno.env.get("PORT") ?? "8080");
console.log(`Server starting on port ${port}...`);
Deno.serve({ port }, (req) => app.fetch(req));
