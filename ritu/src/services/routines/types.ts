import type { Unsubscribe } from "firebase/firestore";

export type RoutineVisibility = "private" | "public" | "followers";

export interface RoutineRecord {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly schedule?: Record<string, unknown> | null;
  readonly autoShare: boolean;
  readonly visibility: RoutineVisibility;
  readonly currentStreak: number;
  readonly maxStreak: number;
  readonly createdAt?: Date | null;
  readonly updatedAt?: Date | null;
  readonly deletedAt?: Date | null;
}

export interface CompletionRecord {
  readonly id: string;
  readonly routineId: string;
  readonly userId: string;
  readonly date: string;
}

export interface SubscribeOptions<T> {
  readonly onData: (rows: ReadonlyArray<T>) => void;
  readonly onError?: (error: unknown) => void;
}

export interface CreateRoutineInput {
  readonly title: string;
  readonly schedule?: Record<string, unknown> | null;
  readonly autoShare: boolean;
  readonly visibility: RoutineVisibility;
}

export interface UpdateRoutineInput {
  readonly title?: string;
  readonly schedule?: Record<string, unknown> | null;
  readonly autoShare?: boolean;
  readonly visibility?: RoutineVisibility;
}

export interface SetCompletionOptions {
  readonly routine: RoutineRecord;
  readonly userId: string;
  readonly complete: boolean;
  readonly completedAt: Date;
}

export interface RoutineGateway {
  subscribeRoutines(
    userId: string,
    options: SubscribeOptions<RoutineRecord>,
  ): Unsubscribe;
  subscribeTodayCompletions(
    userId: string,
    isoDate: string,
    options: SubscribeOptions<CompletionRecord>,
  ): Unsubscribe;
  createRoutine(userId: string, input: CreateRoutineInput): Promise<string>;
  updateRoutine(routineId: string, input: UpdateRoutineInput): Promise<void>;
  setTodayCompletion(options: SetCompletionOptions): Promise<void>;
  deleteRoutine(routineId: string): Promise<void>;
}

export interface BackendGatewayOptions {
  readonly baseUrl: string;
  readonly pollIntervalMs: number;
}
