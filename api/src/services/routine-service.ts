import type {
  Completion,
  CompletionCreateInput,
  Paginated,
  Pagination,
  Routine,
  RoutineCreateInput,
  RoutineUpdateInput,
} from "../types.ts";
import type { RoutineRepository } from "../repositories/routine-repository.ts";
import type { UserRepository } from "../repositories/user-repository.ts";
import { notFound, ServiceError, validationError } from "./errors.ts";

/* ソフトデリート復元可能期間（7日間）をミリ秒で表現。 */
const SOFT_DELETE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/* 完了日付のISO形式（YYYY-MM-DD）を検証する正規表現。 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface RoutineServiceOptions {
  repository: RoutineRepository;
  userRepository: UserRepository;
}

/* RoutineServiceはアプリケーションルールを実装し、リポジトリ越しに永続化層を操作する。 */
export class RoutineService {
  #repository: RoutineRepository;
  #userRepository: UserRepository;

  constructor(options: RoutineServiceOptions) {
    this.#repository = options.repository;
    this.#userRepository = options.userRepository;
  }

  listRoutines(
    userId: string,
    pagination: Pagination,
  ): Promise<Paginated<Routine>> {
    return this.#repository.listByUser(userId, pagination);
  }

  async getRoutine(userId: string, routineId: string): Promise<Routine> {
    const routine = await this.#repository.getById(userId, routineId);
    if (!routine) {
      throw notFound("routine not found");
    }
    if (routine.deletedAt) {
      throw validationError("routine is deleted");
    }
    return routine;
  }

  async createRoutine(
    userId: string,
    input: RoutineCreateInput,
  ): Promise<Routine> {
    if (!input.title || input.title.trim().length === 0) {
      throw validationError("title is required");
    }

    const user = await this.#userRepository.getById(userId);
    // If user is not found, we might assume free plan or error. Assuming free.
    const isPremium = user?.isPremium ?? false;

    if (!isPremium) {
      const count = await this.#repository.countByUser(userId);
      if (count >= 2) {
        throw validationError("Free plan limit reached (2 routines). Upgrade to Premium to create more.");
      }
    }

    const schedule = input.schedule ?? {};
    return await this.#repository.create(userId, {
      title: input.title.trim(),
      description: input.description ?? null,
      schedule,
      autoShare: input.autoShare ?? false,
      visibility: input.visibility ?? "private",
    });
  }

  async updateRoutine(
    userId: string,
    routineId: string,
    input: RoutineUpdateInput,
  ): Promise<Routine> {
    if (input.title !== undefined && input.title.trim().length === 0) {
      throw validationError("title must not be empty");
    }
    const routine = await this.#repository.update(userId, routineId, {
      ...input,
      title: input.title?.trim(),
    });
    if (!routine) {
      throw notFound("routine not found");
    }
    if (routine.deletedAt) {
      throw validationError("routine is deleted");
    }
    return routine;
  }

  async deleteRoutine(userId: string, routineId: string): Promise<void> {
    const routine = await this.#repository.softDelete(
      userId,
      routineId,
      new Date(),
    );
    if (!routine) {
      throw notFound("routine not found");
    }
    if (routine.deletedAt === null) {
      throw new ServiceError("failed to delete routine", 500, "delete_failed");
    }
  }

  async restoreRoutine(userId: string, routineId: string): Promise<Routine> {
    const routine = await this.#repository.getById(userId, routineId);
    if (!routine) {
      throw notFound("routine not found");
    }
    if (!routine.deletedAt) {
      throw validationError("routine is not deleted");
    }
    const deletedAt = new Date(routine.deletedAt);
    const now = new Date();
    if (now.getTime() - deletedAt.getTime() > SOFT_DELETE_WINDOW_MS) {
      throw validationError("restore window (7 days) has expired");
    }
    const restored = await this.#repository.restore(userId, routineId);
    if (!restored) {
      throw new ServiceError(
        "failed to restore routine",
        500,
        "restore_failed",
      );
    }
    return restored;
  }

  async listCompletions(
    userId: string,
    routineId: string,
    range?: { from?: string; to?: string },
  ): Promise<Completion[]> {
    await this.#ensureRoutineAccessible(userId, routineId);
    if (range?.from && !DATE_PATTERN.test(range.from)) {
      throw validationError("from must be YYYY-MM-DD");
    }
    if (range?.to && !DATE_PATTERN.test(range.to)) {
      throw validationError("to must be YYYY-MM-DD");
    }
    if (range?.from && range?.to && range.from > range.to) {
      throw validationError("from must be earlier than to");
    }
    return await this.#repository.listCompletions(userId, routineId, range);
  }

  async addCompletion(
    userId: string,
    routineId: string,
    input: CompletionCreateInput,
  ): Promise<Completion> {
    const routine = await this.#ensureRoutineAccessible(userId, routineId);
    const date = input.date;
    this.#assertDate(date);
    const completion = await this.#repository.addCompletion(userId, routineId, {
      date,
    });
    if (!completion) {
      throw notFound("routine not found");
    }
    await this.#refreshStreaks(routine.userId, routineId);
    return completion;
  }

  async removeCompletion(
    userId: string,
    routineId: string,
    date: string,
  ): Promise<void> {
    const routine = await this.#ensureRoutineAccessible(userId, routineId);
    this.#assertDate(date);
    const removed = await this.#repository.removeCompletion(
      userId,
      routineId,
      date,
    );
    if (!removed) {
      throw notFound("completion not found");
    }
    await this.#refreshStreaks(routine.userId, routineId);
  }

  async #ensureRoutineAccessible(
    userId: string,
    routineId: string,
  ): Promise<Routine> {
    /* 所有者チェックとソフトデリート判定をまとめて行う。 */
    const routine = await this.#repository.getById(userId, routineId);
    if (!routine) {
      throw notFound("routine not found");
    }
    if (routine.deletedAt) {
      throw validationError("routine is deleted");
    }
    return routine;
  }

  async #refreshStreaks(ownerId: string, routineId: string): Promise<void> {
    /* 完了一覧から連続日数を再計算し、Routineへ反映する。 */
    const completions = await this.#repository.listCompletions(
      ownerId,
      routineId,
    );
    const dates = completions.map((completion) => completion.date);
    const { current, max } = calculateStreaks(dates);
    await this.#repository.updateStreaks(ownerId, routineId, {
      currentStreak: current,
      maxStreak: max,
    });
  }

  #assertDate(date: string) {
    if (!DATE_PATTERN.test(date)) {
      throw validationError("date must be YYYY-MM-DD");
    }
  }
}

export function calculateStreaks(
  dates: string[],
): { current: number; max: number } {
  if (dates.length === 0) {
    return { current: 0, max: 0 };
  }
  /* Firestoreの完了記録が穴埋めされている前提でストリークを計算する。 */
  const sorted = Array.from(new Set(dates)).sort();
  let maxStreak = 1;
  let currentStreak = 1;
  const todayString = toDateString(new Date());
  let streakEndingToday = false;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (isNextDay(prev, current)) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }
    if (currentStreak > maxStreak) {
      maxStreak = currentStreak;
    }
  }
  const lastDate = sorted[sorted.length - 1];
  streakEndingToday = lastDate === todayString;
  const trailingStreak = streakEndingToday
    ? countTrailing(sorted, todayString)
    : countTrailing(sorted, lastDate);
  return {
    current: trailingStreak,
    max: Math.max(maxStreak, trailingStreak),
  };
}

function toDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isNextDay(prev: string, current: string): boolean {
  const prevDate = new Date(`${prev}T00:00:00Z`);
  const currentDate = new Date(`${current}T00:00:00Z`);
  const diff = currentDate.getTime() - prevDate.getTime();
  /* 1日分のミリ秒。 */
  const DAY = 24 * 60 * 60 * 1000;
  return Math.round(diff / DAY) === 1;
}

function countTrailing(sortedDates: string[], anchor: string): number {
  const dayMs = 24 * 60 * 60 * 1000;
  let count = 0;
  let target = new Date(`${anchor}T00:00:00Z`).getTime();
  for (let i = sortedDates.length - 1; i >= 0; i--) {
    const dateMs = new Date(`${sortedDates[i]}T00:00:00Z`).getTime();
    if (dateMs === target) {
      count += 1;
      target -= dayMs;
    } else if (dateMs < target) {
      break;
    }
  }
  return count;
}
