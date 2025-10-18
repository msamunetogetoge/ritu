/* VisibilityはRoutineを誰に共有するかを示すフラグ。 */
export type Visibility = "private" | "public" | "followers";

/* RoutineScheduleはOpenAPI準拠の柔軟なスケジュール定義を保持する。 */
export interface RoutineSchedule {
  [key: string]: unknown;
}

/* RoutineはFirestoreに保存されるルーティーン本体を表し、APIレスポンスとも一致する。 */
export interface Routine {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  schedule: RoutineSchedule;
  autoShare: boolean;
  visibility: Visibility;
  currentStreak: number;
  maxStreak: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/* RoutineCreateInputはPOST /routinesのリクエストペイロードで利用。 */
export interface RoutineCreateInput {
  title: string;
  description?: string | null;
  schedule: RoutineSchedule;
  autoShare?: boolean;
  visibility?: Visibility;
}

/* RoutineUpdateInputはPATCH /routines/:idの入力兼Service層の更新引数。 */
export interface RoutineUpdateInput {
  title?: string;
  description?: string | null;
  schedule?: RoutineSchedule;
  autoShare?: boolean;
  visibility?: Visibility;
}

/* Completionは1日の完了結果を表し、FirestoreとAPIレスポンスで共通化。 */
export interface Completion {
  id: string;
  routineId: string;
  userId: string;
  date: string;
  createdAt: string;
}

/* CompletionCreateInputはPOST /routines/:id/completions用の入力型。 */
export interface CompletionCreateInput {
  date: string;
}

/* Paginationはサービス層で使うページング指定（page + limit）。 */
export interface Pagination {
  page: number;
  limit: number;
}

/* Paginatedは一覧レスポンスの共通形（items + page情報）を表す。 */
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
