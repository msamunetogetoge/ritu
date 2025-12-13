
import { type RoutineRepository } from "../repositories/routine-repository.ts";
import { type UserRepository } from "../repositories/user-repository.ts";
import { type LineService } from "./line-service.ts";

export class NotificationWorker {
  #userRepository: UserRepository;
  #routineRepository: RoutineRepository;
  #lineService: LineService;

  constructor(
    userRepository: UserRepository,
    routineRepository: RoutineRepository,
    lineService: LineService,
  ) {
    this.#userRepository = userRepository;
    this.#routineRepository = routineRepository;
    this.#lineService = lineService;
  }

  start() {
    console.log("Starting notification worker...");
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
      const users = await this.#userRepository.listByScheduleTime(time);
      if (users.length === 0) return;

      console.log(`[Notification] Found ${users.length} users for time ${time}`);

      for (const user of users) {
        if (!user.notificationSettings?.lineEnabled || !user.notificationSettings.lineUserId) {
          continue;
        }

        // Get routines for today? Or just remind general?
        // Prompt implies "routine creation limit... notifications".
        // Assuming simple reminder: "Time for your routines!"
        // Or checking if they have incomplete routines?
        // For MVP, simple reminder.
        
        await this.#lineService.sendPushMessage(
          user.notificationSettings.lineUserId,
          "ルーティーンの時間です！今日の積み上げを始めましょう。",
        );
      }
    } catch (e) {
      console.error("[Notification] Error processing notifications:", e);
    }
  }
}
