import { type JSX, useCallback, useMemo, useState } from "react";
import { RoutineCard } from "../features/routines/components/RoutineCard.tsx";
import { RoutineDialog } from "../features/routines/components/RoutineDialog.tsx";
import { useTodayRoutines } from "../features/routines/hooks/useTodayRoutines.ts";
import { extractScheduledTime } from "../features/routines/utils.ts";
import type { Routine, RoutineDialogValue } from "../features/routines/types.ts";
import {
  formatIsoDate,
  type RoutineRecord,
} from "../services/routine-service.ts";
import { useAuth } from "../context/AuthContext.tsx";
import { useFeatureFlags } from "../context/FeatureFlagContext.tsx";

export default function Today(): JSX.Element {
  const { user, loading: authLoading, signIn } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const completionsEnabled = isEnabled("completions");
  const communityEnabled = isEnabled("community");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);

  const today = useMemo(() => formatIsoDate(new Date()), []);
  const {
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
  } = useTodayRoutines(user, today, { enableCompletion: completionsEnabled });

  const defaultDialogValue = useMemo<RoutineDialogValue>(
    () => ({
      title: "",
      scheduledTime: undefined,
      autoShare: false,
      visibility: "private",
    }),
    [],
  );

  const editingRoutine: RoutineRecord | null = useMemo(() => {
    if (!editingRoutineId) {
      return null;
    }
    return routineRecords.find((item) => item.id === editingRoutineId) ?? null;
  }, [editingRoutineId, routineRecords]);

  const editDialogValue = useMemo<RoutineDialogValue>(() => {
    if (!editingRoutine) {
      return defaultDialogValue;
    }
    return {
      title: editingRoutine.title,
      scheduledTime: extractScheduledTime(editingRoutine.schedule),
      autoShare: editingRoutine.autoShare,
      visibility: editingRoutine.visibility,
    };
  }, [editingRoutine, defaultDialogValue]);

  const handleOpenCreateDialog = useCallback(() => {
    if (!user) {
      globalThis.alert("Firestore に保存するにはログインが必要です。");
      return;
    }
    setShowCreateDialog(true);
  }, [user]);

  const handleCloseCreateDialog = useCallback(() => {
    setShowCreateDialog(false);
  }, []);

  const handleCreateRoutine = useCallback(
    async (value: RoutineDialogValue) => {
      try {
        await createRoutineAction(value);
        setShowCreateDialog(false);
      } catch (error) {
        console.error("Failed to create routine", error);
        globalThis.alert("ルーティーンの作成に失敗しました。");
      }
    },
    [createRoutineAction],
  );

  const handleOpenEditDialog = useCallback(
    (id: Routine["id"]) => {
      if (!user) {
        globalThis.alert("Firestore に保存するにはログインが必要です。");
        return;
      }
      setEditingRoutineId(id);
    },
    [user],
  );

  const handleCloseEditDialog = useCallback(() => {
    setEditingRoutineId(null);
  }, []);

  const handleUpdateRoutine = useCallback(
    async (value: RoutineDialogValue) => {
      if (!editingRoutine) {
        return;
      }
      try {
        await updateRoutineAction(editingRoutine.id, value);
        setEditingRoutineId(null);
      } catch (error) {
        console.error("Failed to update routine", error);
        globalThis.alert("ルーティーンの更新に失敗しました。");
      }
    },
    [editingRoutine, updateRoutineAction],
  );

  const handleToggle = useCallback(async (id: Routine["id"]) => {
    if (!completionsEnabled) return;
    try {
      await toggleCompletion(id);
    } catch (error) {
      console.error("Failed to update completion", error);
      globalThis.alert("完了状態の更新に失敗しました。");
    }
  }, [toggleCompletion, completionsEnabled]);

  const handleDeleteRoutine = useCallback(async (id: Routine["id"]) => {
    const target = routines.find((routine) => routine.id === id);
    const title = target?.title ?? "このルーティーン";
    const confirmed = globalThis.confirm(
      `${title} を削除しますか？（7日以内は復元できます）`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await deleteRoutineAction(id);
      if (editingRoutineId === id) {
        setEditingRoutineId(null);
      }
    } catch (error) {
      console.error("Failed to delete routine", error);
      globalThis.alert("ルーティーンの削除に失敗しました。");
    }
  }, [routines, deleteRoutineAction, editingRoutineId]);

  const deletedSummaries = useMemo(
    () =>
      deletedRoutineRecords.map((record) => ({
        id: record.id,
        title: record.title,
        deletedAtLabel: record.deletedAt
          ? record.deletedAt.toLocaleString("ja-JP", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          : "削除予定日未取得",
      })),
    [deletedRoutineRecords],
  );

  const flameScale = useMemo(
    () => 1 + (completion.rate / 100) * 0.7,
    [completion.rate],
  );

  if (!authLoading && !user) {
    return (
      <>
        <div className="main-scroll">
          <h1>Today</h1>
          <section className="routine-list" aria-label="ログイン案内">
            <p className="muted">
              Firestore に記録するには Google
              アカウントでログインしてください。
            </p>
          </section>
          <button className="btn" type="button" onClick={signIn}>
            Googleでログイン
          </button>
        </div>

        <RoutineDialog
          mode="create"
          open={showCreateDialog}
          initialValue={defaultDialogValue}
          submitting={creating}
          onSubmit={handleCreateRoutine}
          onClose={handleCloseCreateDialog}
        />
        <RoutineDialog
          mode="edit"
          open={Boolean(editingRoutine)}
          initialValue={editDialogValue}
          submitting={updatingRoutineId !== null}
          onSubmit={handleUpdateRoutine}
          onClose={handleCloseEditDialog}
        />
      </>
    );
  }

  return (
    <>
      <div className="main-scroll">
        <h1>Today</h1>

        {dataError
          ? (
            <p role="alert" className="sub">
              {dataError}
            </p>
          )
          : null}
        {isLoading
          ? (
            <p className="muted" aria-live="polite">
              Firestore と同期中...
            </p>
          )
          : null}

        <section
          className="routine-list"
          aria-live="polite"
          aria-label="今日のルーティーン"
        >
          {routines.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onToggle={completionsEnabled ? handleToggle : undefined}
              onEdit={handleOpenEditDialog}
              onDelete={handleDeleteRoutine}
              showCompletionButton={completionsEnabled}
              showAutoShare={communityEnabled}
              disabled={isLoading || pendingRoutineIds.has(routine.id) ||
                updatingRoutineId === routine.id ||
                deletingRoutineIds.has(routine.id)}
            />
          ))}
        </section>

        <button
          className="add"
          type="button"
          aria-label="新しいルーティーンを追加"
          onClick={handleOpenCreateDialog}
          disabled={creating || isLoading}
        >
          <span className="plus" aria-hidden="true">
            ＋
          </span>
          <span>{creating ? "登録中..." : "新しいルーティーンを追加"}</span>
        </button>

        {deletedSummaries.length > 0
          ? (
            <section
              className="deleted-section"
              aria-label="削除予定のルーティーン"
            >
              <h2>削除予定のルーティーン</h2>
              <ul className="deleted-list">
                {deletedSummaries.map((item) => (
                  <li key={item.id} className="deleted-card">
                    <div className="deleted-title">{item.title}</div>
                    <div className="deleted-meta">
                      削除予定: {item.deletedAtLabel}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
          : null}
      </div>

      {completionsEnabled
        ? (
          <footer className="footer" aria-label="今日の達成率">
            <span
              aria-hidden="true"
              className="flame"
              style={{ transform: `scale(${flameScale})` }}
            >
              🔥
            </span>
            <span className="muted">今日の達成率</span>
            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completion.rate}
              aria-label="今日の完了率"
            >
              <span style={{ transform: `scaleX(${completion.rate / 100})` }}>
              </span>
              <span className="visually-hidden">
                {`${completion.rate}% 完了`}
              </span>
            </div>
            <span className="rate">{`${completion.rate}%`}</span>
          </footer>
        )
        : (
          <footer className="footer" aria-label="開発モード案内">
            <span className="muted">完了チェックは開発環境では非表示です</span>
          </footer>
        )}

      <RoutineDialog
        mode="create"
        open={showCreateDialog}
        initialValue={defaultDialogValue}
        submitting={creating}
        onSubmit={handleCreateRoutine}
        onClose={handleCloseCreateDialog}
      />
      <RoutineDialog
        mode="edit"
        open={Boolean(editingRoutine)}
        initialValue={editDialogValue}
        submitting={updatingRoutineId !== null}
        onSubmit={handleUpdateRoutine}
        onClose={handleCloseEditDialog}
      />
    </>
  );
}
