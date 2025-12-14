import { type RoutineRepository } from "../repositories/routine-repository.ts";
import { type UserRepository } from "../repositories/user-repository.ts";
import { type LineService } from "./line-service.ts";

export class NotificationWorker {
  #userRepository: UserRepository;
  #routineRepository: RoutineRepository;
  #lineService: LineService;
  #forcedRecipient?: string;

  constructor(
    userRepository: UserRepository,
    routineRepository: RoutineRepository,
    lineService: LineService,
  ) {
    this.#userRepository = userRepository;
    this.#routineRepository = routineRepository;
    this.#lineService = lineService;
    this.#forcedRecipient = Deno.env.get("LINE_NOTIFICATION_TO") ??
      Deno.env.get("LINE_TEST_TO");
  }

  start() {
    console.info("Starting notification worker...");
    // Check every minute
    setInterval(() => this.#checkAndSend(), 60 * 1000);
  }

  async #checkAndSend() {
    const now = new Date();
    // Format HH:MM
    const time = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    try {
      const routines = await this.#routineRepository.listByScheduleTime(time);
      if (routines.length === 0) return;

      console.info(`[Notification] Found ${routines.length} routines for time ${time}`);

      const byUser = new Map<string, string[]>();
      for (const routine of routines) {
        const list = byUser.get(routine.userId) ?? [];
        list.push(routine.title);
        byUser.set(routine.userId, list);
      }

      for (const [userId, routineTitles] of byUser.entries()) {
        const user = await this.#userRepository.getById(userId);
        const target = this.#forcedRecipient ??
          (user?.notificationSettings?.lineEnabled ? user.notificationSettings.lineUserId : null);
        if (!target) {
          continue;
        }

        for (const title of routineTitles) {
          await this.#lineService.sendPushMessage(
            target,
            `${title}の時間です！`,
          );
        }
      }
    } catch (e) {
      console.error("[Notification] Error processing notifications:", e);
    }
  }
}
