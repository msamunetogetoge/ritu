import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createRoutine,
  deleteRoutine,
  setTodayCompletion,
  subscribeRoutines,
  subscribeTodayCompletions,
  updateRoutine,
} from "../../../services/routine-service.ts";
import type {
  CompletionRecord,
  RoutineRecord,
} from "../../../services/routine-service.ts";
import type { Routine, RoutineDialogValue } from "../types.ts";
import { extractScheduledTime, normalizeDialogValue, toFirestoreSchedule } from "../utils.ts";

interface CompletionSummary {
  readonly total: number;
  readonly completed: number;
  readonly rate: number;
}

interface UseTodayRoutinesResult {
  readonly routines: ReadonlyArray<Routine>;
  readonly routineRecords: ReadonlyArray<RoutineRecord>;
  readonly deletedRoutineRecords: ReadonlyArray<RoutineRecord>;
  readonly completion: CompletionSummary;
  readonly dataError: string | null;
  readonly isLoading: boolean;
  readonly creating: boolean;
  readonly updatingRoutineId: string | null;
  readonly deletingRoutineIds: ReadonlySet<string>;
  readonly pendingRoutineIds: ReadonlySet<string>;
  readonly createRoutine: (value: RoutineDialogValue) => Promise<void>;
  readonly updateRoutine: (
    id: string,
    value: RoutineDialogValue,
  ) => Promise<void>;
  readonly toggleCompletion: (routineId: string) => Promise<void>;
  readonly deleteRoutine: (routineId: string) => Promise<void>;
}

export function useTodayRoutines(
  user: { readonly uid: string } | null,
  isoDate: string,
): UseTodayRoutinesResult {
  const [routineRecords, setRoutineRecords] = useState<
    ReadonlyArray<RoutineRecord>
  >([]);
  const [deletedRoutineRecords, setDeletedRoutineRecords] = useState<
    ReadonlyArray<RoutineRecord>
  >([]);
  const [completionRecords, setCompletionRecords] = useState<
    ReadonlyArray<CompletionRecord>
  >([]);
  const [dataError, setDataError] = useState<string | null>(null);
  const [routinesLoading, setRoutinesLoading] = useState(false);
  const [completionsLoading, setCompletionsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingRoutineId, setUpdatingRoutineId] = useState<string | null>(
    null,
  );
  const [deletingRoutineIds, setDeletingRoutineIds] = useState<Set<string>>(
    new Set(),
  );
  const [pendingRoutineIds, setPendingRoutineIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    setRoutineRecords([]);
    setDeletedRoutineRecords([]);
    if (!user) {
      return;
    }
    setRoutinesLoading(true);
    const unsubscribe = subscribeRoutines(user.uid, {
      onData: (rows) => {
        setDataError(null);
        const active = rows.filter((row) => !row.deletedAt);
        const deleted = rows.filter((row) => Boolean(row.deletedAt));
        setRoutineRecords(active);
        setDeletedRoutineRecords(deleted);
        setRoutinesLoading(false);
      },
      onError: (error) => {
        console.error("Failed to subscribe routines", error);
        setDataError("ルーティーンの取得に失敗しました。");
        setRoutinesLoading(false);
      },
    });
    return () => {
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    setCompletionRecords([]);
    if (!user) {
      return;
    }
    setCompletionsLoading(true);
    const unsubscribe = subscribeTodayCompletions(user.uid, isoDate, {
      onData: (rows) => {
        setCompletionRecords(rows);
        setCompletionsLoading(false);
      },
      onError: (error) => {
        console.error("Failed to subscribe completions", error);
        setDataError("完了状況の取得に失敗しました。");
        setCompletionsLoading(false);
      },
    });
    return () => {
      unsubscribe();
    };
  }, [user, isoDate]);

  const completionSet = useMemo(
    () => new Set(completionRecords.map((record) => record.routineId)),
    [completionRecords],
  );

  const routines = useMemo<ReadonlyArray<Routine>>(() => {
    return routineRecords.map((record) => ({
      id: record.id,
      title: record.title,
      autoShare: record.autoShare,
      scheduledTime: extractScheduledTime(record.schedule),
      status: completionSet.has(record.id) ? "complete" : "pending",
      streakLabel: record.currentStreak > 0
        ? `${record.currentStreak}日継続中`
        : undefined,
    }));
  }, [routineRecords, completionSet]);

  const completion = useMemo<CompletionSummary>(() => {
    const total = routines.length;
    const completed = routines.filter((routine) =>
      routine.status === "complete"
    )
      .length;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, rate };
  }, [routines]);

  const isLoading = routinesLoading || completionsLoading;

  const createRoutineAction = useCallback(async (value: RoutineDialogValue) => {
    if (!user) {
      throw new Error("ログインが必要です");
    }
    const normalized = normalizeDialogValue(value);
    setCreating(true);
    try {
      await createRoutine(user.uid, {
        title: normalized.title,
        schedule: toFirestoreSchedule(normalized.scheduledTime),
        autoShare: normalized.autoShare,
        visibility: normalized.visibility,
      });
    } finally {
      setCreating(false);
    }
  }, [user]);

  const updateRoutineAction = useCallback(
    async (id: string, value: RoutineDialogValue) => {
      const normalized = normalizeDialogValue(value);
      setUpdatingRoutineId(id);
      try {
        await updateRoutine(id, {
          title: normalized.title,
          schedule: toFirestoreSchedule(normalized.scheduledTime),
          autoShare: normalized.autoShare,
          visibility: normalized.visibility,
        });
      } finally {
        setUpdatingRoutineId(null);
      }
    },
    [],
  );

  const toggleCompletion = useCallback(
    async (routineId: string) => {
      if (!user) {
        globalThis.alert("Firestore に記録するにはログインが必要です。");
        return;
      }
      const target = routineRecords.find((record) => record.id === routineId);
      if (!target) {
        return;
      }
      const isComplete = completionSet.has(routineId);
      setPendingRoutineIds((prev) => {
        const next = new Set(prev);
        next.add(routineId);
        return next;
      });
      try {
        await setTodayCompletion({
          routine: target,
          userId: user.uid,
          complete: !isComplete,
          completedAt: new Date(),
        });
      } catch (error) {
        console.error("Failed to toggle completion", error);
        throw error;
      } finally {
        setPendingRoutineIds((prev) => {
          const next = new Set(prev);
          next.delete(routineId);
          return next;
        });
      }
    },
    [user, routineRecords, completionSet],
  );

  const deleteRoutineAction = useCallback(async (routineId: string) => {
    setDeletingRoutineIds((prev) => {
      const next = new Set(prev);
      next.add(routineId);
      return next;
    });
    try {
      await deleteRoutine(routineId);
    } finally {
      setDeletingRoutineIds((prev) => {
        const next = new Set(prev);
        next.delete(routineId);
        return next;
      });
    }
  }, []);

  return {
    routines,
    routineRecords,
    deletedRoutineRecords,
    completion,
    dataError,
    isLoading,
    creating,
    updatingRoutineId,
    deletingRoutineIds,
    pendingRoutineIds,
    createRoutine: createRoutineAction,
    updateRoutine: updateRoutineAction,
    toggleCompletion,
    deleteRoutine: deleteRoutineAction,
  };
}
