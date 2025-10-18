import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  type DocumentData,
  type DocumentReference,
  type FirestoreError,
  onSnapshot,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  runTransaction,
  serverTimestamp,
  type Transaction,
  type Unsubscribe,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase.ts";

/* RoutineVisibilityはFirestoreに保存される公開範囲。 */
export type RoutineVisibility = "private" | "public" | "followers";

/* RoutineRecordはFirestoreの`routines`ドキュメントを型付けしたもの。 */
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

/* CompletionRecordはサブコレクション`completions`の要素を表す。 */
export interface CompletionRecord {
  readonly id: string;
  readonly routineId: string;
  readonly userId: string;
  readonly date: string;
}

/* SubscribeOptionsはリアルタイム購読時のコールバックを指定する。 */
export interface SubscribeOptions<T> {
  readonly onData: (rows: ReadonlyArray<T>) => void;
  readonly onError?: (error: unknown) => void;
}

/* convertTimestampはFirestoreのTimestampをDateへ変換する。 */
function convertTimestamp(value: unknown): Date | null {
  if (
    value && typeof value === "object" && "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

/* routinesCollectionはroutinesコレクション参照を返す。 */
function routinesCollection() {
  return collection(db, "routines");
}

/* routineRefは個別ルーティーンのドキュメント参照。 */
function routineRef(routineId: string): DocumentReference {
  return doc(db, "routines", routineId);
}

/* subscribeRoutinesはユーザーのルーティーン一覧をリアルタイム購読する。 */
export function subscribeRoutines(
  userId: string,
  options: SubscribeOptions<RoutineRecord>,
): Unsubscribe {
  const routinesQuery = query(
    routinesCollection(),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    routinesQuery,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const rows: RoutineRecord[] = [];
      snapshot.docs.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnap.data();
        const deletedAt = convertTimestamp(data.deletedAt);
        if (deletedAt) {
          return;
        }
        rows.push({
          id: docSnap.id,
          userId: data.userId as string,
          title: data.title as string,
          description: (data.description as string | null | undefined) ?? null,
          schedule:
            (data.schedule as Record<string, unknown> | null | undefined) ??
              null,
          autoShare: Boolean(data.autoShare),
          visibility: (data.visibility as RoutineVisibility) ?? "private",
          currentStreak: Number(data.currentStreak ?? 0),
          maxStreak: Number(data.maxStreak ?? 0),
          createdAt: convertTimestamp(data.createdAt),
          updatedAt: convertTimestamp(data.updatedAt),
          deletedAt,
        });
      });

      options.onData(rows);
    },
    (error: FirestoreError) => {
      options.onError?.(error);
    },
  );
}

/* subscribeTodayCompletionsは当日の完了レコードを購読する。 */
export function subscribeTodayCompletions(
  userId: string,
  isoDate: string,
  options: SubscribeOptions<CompletionRecord>,
): Unsubscribe {
  const completionsQuery = query(
    collectionGroup(db, "completions"),
    where("userId", "==", userId),
    where("date", "==", isoDate),
  );

  return onSnapshot(
    completionsQuery,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const rows = snapshot.docs.map(
        (docSnap: QueryDocumentSnapshot<DocumentData>) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            routineId: data.routineId as string,
            userId: data.userId as string,
            date: data.date as string,
          };
        },
      );
      options.onData(rows);
    },
    (error: FirestoreError) => {
      options.onError?.(error);
    },
  );
}

/* CreateRoutineInputは新規ルーティーン作成フォームの入力。 */
export interface CreateRoutineInput {
  readonly title: string;
  readonly scheduledTime?: string;
  readonly autoShare: boolean;
}

/* createRoutineはFirestoreにルーティーンを追加しIDを返す。 */
export async function createRoutine(
  userId: string,
  input: CreateRoutineInput,
): Promise<string> {
  const schedule: Record<string, unknown> = {
    type: "daily",
  };

  if (input.scheduledTime) {
    schedule.time = input.scheduledTime;
  }

  const docRef = await addDoc(routinesCollection(), {
    userId,
    title: input.title,
    description: null,
    schedule,
    autoShare: input.autoShare,
    visibility: "private",
    currentStreak: 0,
    maxStreak: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  });

  return docRef.id;
}

/* SetCompletionOptionsは完了登録/解除に必要な情報。 */
export interface SetCompletionOptions {
  readonly routine: RoutineRecord;
  readonly userId: string;
  readonly complete: boolean;
  readonly completedAt: Date;
}

/* formatIsoDateはYYYY-MM-DD形式の文字列を返す。 */
export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/* setTodayCompletionはトランザクションで当日の完了状態とストリークを更新する。 */
export async function setTodayCompletion(
  options: SetCompletionOptions,
): Promise<void> {
  const { routine, userId, complete, completedAt } = options;
  const dateId = formatIsoDate(completedAt);
  const completionRef = doc(db, "routines", routine.id, "completions", dateId);

  await runTransaction(db, async (transaction: Transaction) => {
    const ref = routineRef(routine.id);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) {
      throw new Error(`Routine not found: ${routine.id}`);
    }

    const data = snapshot.data() as Record<string, unknown>;
    const priorStreak = Number(data.currentStreak ?? 0);
    const priorMax = Number(data.maxStreak ?? 0);
    const nextStreak = complete
      ? priorStreak + 1
      : Math.max(priorStreak - 1, 0);
    const nextMax = complete ? Math.max(priorMax, nextStreak) : priorMax;

    if (complete) {
      transaction.set(completionRef, {
        id: dateId,
        routineId: routine.id,
        userId,
        date: dateId,
        createdAt: serverTimestamp(),
      });
    } else {
      transaction.delete(completionRef);
    }

    transaction.update(ref, {
      currentStreak: nextStreak,
      maxStreak: nextMax,
      updatedAt: serverTimestamp(),
    });
  });
}
