import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type FirestoreError,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  type QuerySnapshot,
  runTransaction,
  serverTimestamp,
  type Transaction,
  type Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";
import { app } from "../../lib/firebase.ts";
import {
  formatIsoDate,
  normalizeRoutineTitle,
} from "./helpers.ts";
import type {
  CompletionRecord,
  CreateRoutineInput,
  RoutineGateway,
  RoutineRecord,
  SetCompletionOptions,
  SubscribeOptions,
  UpdateRoutineInput,
} from "./types.ts";
import type { RoutineVisibility } from "./types.ts";

const db: Firestore = getFirestore(app);

export function createFirestoreGateway(): RoutineGateway {
  return {
    subscribeRoutines,
    subscribeTodayCompletions,
    createRoutine,
    updateRoutine,
    setTodayCompletion,
    deleteRoutine,
  };
}

function subscribeRoutines(
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
      const rows = snapshot.docs.map((docSnap) =>
        convertRoutineDoc(docSnap.id, docSnap.data())
      );
      options.onData(rows);
    },
    (error: FirestoreError) => {
      options.onError?.(error);
    },
  );
}

function subscribeTodayCompletions(
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
      const rows = snapshot.docs.map((docSnap) => {
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

async function createRoutine(
  userId: string,
  input: CreateRoutineInput,
): Promise<string> {
  const docRef = await addDoc(routinesCollection(), {
    userId,
    title: normalizeRoutineTitle(input.title),
    description: null,
    schedule: input.schedule ?? null,
    autoShare: Boolean(input.autoShare),
    visibility: input.visibility,
    currentStreak: 0,
    maxStreak: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  });
  return docRef.id;
}

async function updateRoutine(
  routineId: string,
  input: UpdateRoutineInput,
): Promise<void> {
  const ref = routineRef(routineId);
  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (input.title !== undefined) {
    updateData.title = normalizeRoutineTitle(input.title);
  }
  if (input.autoShare !== undefined) {
    updateData.autoShare = Boolean(input.autoShare);
  }
  if (input.visibility !== undefined) {
    updateData.visibility = input.visibility;
  }
  if (input.schedule !== undefined) {
    updateData.schedule = input.schedule;
  }
  await updateDoc(ref, updateData);
}

async function deleteRoutine(routineId: string): Promise<void> {
  const ref = routineRef(routineId);
  await updateDoc(ref, {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function setTodayCompletion(
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

function routinesCollection() {
  return collection(db, "routines");
}

function routineRef(routineId: string): DocumentReference {
  return doc(db, "routines", routineId);
}

function convertRoutineDoc(id: string, data: DocumentData): RoutineRecord {
  return {
    id,
    userId: data.userId as string,
    title: data.title as string,
    description: (data.description as string | null | undefined) ?? null,
    schedule: (data.schedule as Record<string, unknown> | null | undefined) ??
      null,
    autoShare: Boolean(data.autoShare),
    visibility: (data.visibility as RoutineVisibility) ?? "private",
    currentStreak: Number(data.currentStreak ?? 0),
    maxStreak: Number(data.maxStreak ?? 0),
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt),
    deletedAt: convertTimestamp(data.deletedAt),
  };
}

function convertTimestamp(value: unknown): Date | null {
  if (
    value && typeof value === "object" && "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
