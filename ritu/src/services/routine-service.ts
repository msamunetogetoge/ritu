import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type DocumentReference,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type Transaction,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase.ts";

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

function convertTimestamp(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function routinesCollection() {
  return collection(db, "routines");
}

function routineRef(routineId: string): DocumentReference {
  return doc(db, "routines", routineId);
}

export function subscribeRoutines(userId: string, options: SubscribeOptions<RoutineRecord>): Unsubscribe {
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
          schedule: (data.schedule as Record<string, unknown> | null | undefined) ?? null,
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
      const rows = snapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          routineId: data.routineId as string,
          userId: data.userId as string,
          date: data.date as string,
        };
      });
      options.onData(rows);
    },
    (error: FirestoreError) => {
      options.onError?.(error);
    },
  );
}

export interface CreateRoutineInput {
  readonly title: string;
  readonly scheduledTime?: string;
  readonly autoShare: boolean;
}

export async function createRoutine(userId: string, input: CreateRoutineInput): Promise<string> {
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

export interface SetCompletionOptions {
  readonly routine: RoutineRecord;
  readonly userId: string;
  readonly complete: boolean;
  readonly completedAt: Date;
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function setTodayCompletion(options: SetCompletionOptions): Promise<void> {
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
    const nextStreak = complete ? priorStreak + 1 : Math.max(priorStreak - 1, 0);
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
