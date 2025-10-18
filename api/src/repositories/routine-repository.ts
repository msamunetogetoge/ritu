import type {
  Completion,
  CompletionCreateInput,
  Paginated,
  Pagination,
  Routine,
  RoutineCreateInput,
  RoutineUpdateInput,
} from "../types.ts";

/* RoutineRepositoryはストレージ層の契約で、Firestore等の実装を差し替えられるようにする。 */
export interface RoutineRepository {
  listByUser(
    userId: string,
    pagination: Pagination,
  ): Promise<Paginated<Routine>>;
  getById(userId: string, routineId: string): Promise<Routine | null>;
  create(userId: string, input: RoutineCreateInput): Promise<Routine>;
  update(
    userId: string,
    routineId: string,
    input: RoutineUpdateInput,
  ): Promise<Routine | null>;
  updateStreaks(
    userId: string,
    routineId: string,
    streaks: { currentStreak: number; maxStreak: number },
  ): Promise<Routine | null>;
  softDelete(
    userId: string,
    routineId: string,
    deletedAt: Date,
  ): Promise<Routine | null>;
  restore(userId: string, routineId: string): Promise<Routine | null>;
  listCompletions(
    userId: string,
    routineId: string,
    range?: { from?: string; to?: string },
  ): Promise<Completion[]>;
  addCompletion(
    userId: string,
    routineId: string,
    input: CompletionCreateInput,
  ): Promise<Completion | null>;
  removeCompletion(
    userId: string,
    routineId: string,
    date: string,
  ): Promise<boolean>;
}
