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

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

/* NotificationSettings controls user preferences for alerts. */
export interface NotificationSettings {
  emailEnabled: boolean;
  lineEnabled: boolean;
  lineUserId?: string | null;
  scheduleTime?: string; // HH:mm
}
/* User represents a user profile in the system. */
export interface User {
  id: string; // auth.uid
  displayName: string;
  photoUrl: string | null;
  notificationSettings?: NotificationSettings;
  isPremium?: boolean;
  createdAt: string;
  updatedAt: string;
}

/* UserUpdateInput is used for PATCH /users/me */
export interface UserUpdateInput {
  displayName?: string;
  photoUrl?: string | null;
  notificationSettings?: NotificationSettings;
  isPremium?: boolean; // Usually not updateable by user directly, but for MVP/Admin maybe? Or webhook.
}

/* Post represents a shared routine update in the feed. */
export interface Post {
  id: string;
  userId: string;
  routineId: string;
  text: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostCreateInput {
  routineId: string;
  text?: string;
}

/* Comment on a post. */
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface CommentCreateInput {
  text: string;
}

/* Like on a post. */
export interface Like {
  id: string; // composite userId_postId usually, or random
  postId: string;
  userId: string;
  createdAt: string;
}
