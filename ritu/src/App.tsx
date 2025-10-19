import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import { RoutineCard } from "./features/routines/components/RoutineCard.tsx";
import { RoutineDialog } from "./features/routines/components/RoutineDialog.tsx";
import { useTodayRoutines } from "./features/routines/hooks/useTodayRoutines.ts";
import { extractScheduledTime } from "./features/routines/utils.ts";
import type { Routine, RoutineDialogValue } from "./features/routines/types.ts";
import { auth } from "./lib/firebase.ts";
import {
  formatIsoDate,
  type RoutineRecord,
} from "./services/routine-service.ts";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/* AppはToday画面全体の状態管理とFirestore/REST購読を統括する。 */
export default function App(): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
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
  } = useTodayRoutines(user, today);

  const defaultDialogValue = useMemo<RoutineDialogValue>(
    () => ({
      title: "",
      scheduledTime: undefined,
      autoShare: false,
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
    };
  }, [editingRoutine, defaultDialogValue]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSignIn = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Failed to sign in", error);
      window.alert("Google ログインに失敗しました。もう一度お試しください。");
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Failed to sign out", error);
      window.alert(
        "ログアウトに失敗しました。時間をおいて再度お試しください。",
      );
    }
  }, []);

  const handleOpenCreateDialog = useCallback(() => {
    if (!user) {
      window.alert("Firestore に保存するにはログインが必要です。");
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
        window.alert("ルーティーンの作成に失敗しました。");
      }
    },
    [createRoutineAction],
  );

  const handleOpenEditDialog = useCallback(
    (id: Routine["id"]) => {
      if (!user) {
        window.alert("Firestore に保存するにはログインが必要です。");
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
        window.alert("ルーティーンの更新に失敗しました。");
      }
    },
    [editingRoutine, updateRoutineAction],
  );

  const handleToggle = useCallback(async (id: Routine["id"]) => {
    try {
      await toggleCompletion(id);
    } catch (error) {
      console.error("Failed to update completion", error);
      window.alert("完了状態の更新に失敗しました。");
    }
  }, [toggleCompletion]);

  const handleDeleteRoutine = useCallback(async (id: Routine["id"]) => {
    const target = routines.find((routine) => routine.id === id);
    const title = target?.title ?? "このルーティーン";
    const confirmed = window.confirm(
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
      window.alert("ルーティーンの削除に失敗しました。");
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

  const renderHeader = () => (
    <header className="brand" aria-label="アプリ ヘッダー">
      <div className="brand-left">
        <div className="logo" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="8"></circle>
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v4M2 12h4M12 22v-4M22 12h-4"></path>
          </svg>
        </div>
        <p className="brand-title">RITU</p>
      </div>
      {user
        ? (
          <>
            <div
              className="avatar"
              aria-label={user?.displayName ?? "プロフィール"}
            >
              {user?.photoURL
                ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName ?? "プロフィール"}
                    referrerPolicy="no-referrer"
                  />
                )
                : (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14Z">
                    </path>
                  </svg>
                )}
            </div>
            <button
              className="btn"
              type="button"
              onClick={handleSignOut}
              disabled={isLoading}
            >
              ログアウト
            </button>
          </>
        )
        : null}
    </header>
  );

  if (!authLoading && !user) {
    return (
      <>
        <main className="phone" role="main" aria-label="RITU Today">
          <div className="content">
            {renderHeader()}
            <div className="main-scroll">
              <h1>Today</h1>
              <section className="routine-list" aria-label="ログイン案内">
                <p className="muted">
                  Firestore に記録するには Google
                  アカウントでログインしてください。
                </p>
              </section>
              <button className="btn" type="button" onClick={handleSignIn}>
                Googleでログイン
              </button>
            </div>
          </div>
          <div className="home-indicator" aria-hidden="true"></div>
        </main>
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
      <main className="phone" role="main" aria-label="RITU Today">
        <div className="content">
          {renderHeader()}

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
                  onToggle={handleToggle}
                  onEdit={handleOpenEditDialog}
                  onDelete={handleDeleteRoutine}
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
        </div>

        <div className="home-indicator" aria-hidden="true"></div>
      </main>
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
