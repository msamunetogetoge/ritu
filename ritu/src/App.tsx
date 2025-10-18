import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
} from "react";
import { auth } from "./lib/firebase.ts";
import {
  createRoutine,
  formatIsoDate,
  setTodayCompletion,
  subscribeRoutines,
  subscribeTodayCompletions,
  type RoutineRecord,
} from "./services/routine-service.ts";

export type RoutineStatus = "pending" | "complete";

export interface Routine {
  readonly id: string;
  readonly title: string;
  readonly streakLabel?: string;
  readonly scheduledTime?: string;
  readonly nowLabel?: string;
  readonly autoShare: boolean;
  readonly status: RoutineStatus;
}

export interface CompletionSummary {
  readonly total: number;
  readonly completed: number;
  readonly rate: number;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function computeCompletion(routines: ReadonlyArray<Routine>): CompletionSummary {
  const total = routines.length;
  const completed = routines.filter((routine) => routine.status === "complete").length;
  const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, rate };
}

interface RoutineCardProps {
  readonly routine: Routine;
  readonly onToggle: (id: Routine["id"]) => void;
  readonly disabled?: boolean;
}

function RoutineCard({ routine, onToggle, disabled }: RoutineCardProps): JSX.Element {
  const isComplete = routine.status === "complete";
  const cardClassName = `card${isComplete ? " is-complete" : ""}`;

  return (
    <section className={cardClassName} aria-label={routine.title}>
      <div className="row title-row">
        <div className="left">
          <div className="check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="name">{routine.title}</div>
        </div>
        {routine.autoShare ? (
          <div className="auto-pill" aria-label="自動投稿ON">
            A&nbsp;Auto
          </div>
        ) : null}
      </div>

      {routine.streakLabel || routine.scheduledTime ? (
        <div className="row sub" aria-label="継続情報">
          {routine.streakLabel ? <span>{routine.streakLabel}</span> : null}
          {routine.streakLabel && routine.scheduledTime ? <span className="dot" aria-hidden="true"></span> : null}
          {routine.scheduledTime ? (
            <span className="time">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="8"></circle>
                <path d="M12 8v4l3 1.5"></path>
              </svg>
              <strong>{routine.scheduledTime}</strong>
            </span>
          ) : null}
        </div>
      ) : null}

      {routine.nowLabel ? <div className="sub">{routine.nowLabel}</div> : null}

      <button
        className="btn"
        type="button"
        aria-pressed={isComplete}
        aria-label={isComplete ? `${routine.title} の完了を取り消す` : `${routine.title} を完了`}
        onClick={() => onToggle(routine.id)}
        disabled={disabled}
      >
        {isComplete ? "完了済み" : "完了"}
      </button>
    </section>
  );
}

function normalizeTime(input: string | null): string | undefined {
  if (!input) {
    return undefined;
  }
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractScheduledTime(schedule: RoutineRecord["schedule"]): string | undefined {
  if (!schedule || typeof schedule !== "object") {
    return undefined;
  }
  const maybeTime = (schedule as { readonly time?: unknown }).time;
  if (typeof maybeTime !== "string") {
    return undefined;
  }
  const trimmed = maybeTime.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function createStreakLabel(currentStreak: number): string | undefined {
  return currentStreak > 0 ? `${currentStreak}日継続中` : undefined;
}

function mapRoutine(record: RoutineRecord, completions: ReadonlySet<string>): Routine {
  const scheduledTime = extractScheduledTime(record.schedule);
  const status: RoutineStatus = completions.has(record.id) ? "complete" : "pending";
  return {
    id: record.id,
    title: record.title,
    streakLabel: createStreakLabel(record.currentStreak),
    scheduledTime,
    nowLabel: status === "complete" ? "今日の記録済み" : undefined,
    autoShare: record.autoShare,
    status,
  };
}

export default function App(): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [routineRecords, setRoutineRecords] = useState<ReadonlyArray<RoutineRecord>>([]);
  const [routinesLoaded, setRoutinesLoaded] = useState(false);
  const [completionIds, setCompletionIds] = useState<ReadonlyArray<string>>([]);
  const [completionsLoaded, setCompletionsLoaded] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingRoutineIds, setPendingRoutineIds] = useState<Set<string>>(() => new Set<string>());

  const today = useMemo(() => formatIsoDate(new Date()), []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setPendingRoutineIds(new Set<string>());
    if (!user) {
      setRoutineRecords([]);
      setRoutinesLoaded(false);
      return;
    }

    setDataError(null);
    setRoutinesLoaded(false);
    const unsubscribe = subscribeRoutines(user.uid, {
      onData: (rows) => {
        setDataError(null);
        setRoutineRecords(rows);
        setRoutinesLoaded(true);
      },
      onError: (error) => {
        console.error("Failed to subscribe routines", error);
        setDataError("ルーティーンの取得に失敗しました。");
      },
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCompletionIds([]);
      setCompletionsLoaded(false);
      return;
    }

    setCompletionsLoaded(false);
    const unsubscribe = subscribeTodayCompletions(user.uid, today, {
      onData: (rows) => {
        setDataError(null);
        setCompletionIds(rows.map((row) => row.routineId));
        setCompletionsLoaded(true);
      },
      onError: (error) => {
        console.error("Failed to subscribe completions", error);
        setDataError("完了状況の取得に失敗しました。");
      },
    });
    return unsubscribe;
  }, [user, today]);

  const completionSet = useMemo(() => new Set(completionIds), [completionIds]);
  const routines = useMemo(
    () => routineRecords.map((record) => mapRoutine(record, completionSet)),
    [routineRecords, completionSet],
  );
  const completion = useMemo(() => computeCompletion(routines), [routines]);
  const isLoading = authLoading || (user !== null && (!routinesLoaded || !completionsLoaded));

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
      window.alert("ログアウトに失敗しました。時間をおいて再度お試しください。");
    }
  }, []);

  const handleAddRoutine = useCallback(async () => {
    if (!user) {
      window.alert("Firestore に保存するにはログインが必要です。");
      return;
    }

    const name = window.prompt("ルーティーン名を入力してください");
    if (!name) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    const time = normalizeTime(window.prompt("開始時刻 (例: 07:30) ※省略可"));
    const wantsAutoShare = window.confirm("自動投稿を有効にしますか？ (OKでON)");

    setCreating(true);
    try {
      await createRoutine(user.uid, {
        title: trimmedName,
        scheduledTime: time,
        autoShare: wantsAutoShare,
      });
    } catch (error) {
      console.error("Failed to create routine", error);
      window.alert("ルーティーンの作成に失敗しました。");
    } finally {
      setCreating(false);
    }
  }, [user]);

  const handleToggle = useCallback(
    async (id: Routine["id"]) => {
      if (!user) {
        window.alert("Firestore に保存するにはログインが必要です。");
        return;
      }
      if (pendingRoutineIds.has(id)) {
        return;
      }
      const routineRecord = routineRecords.find((item) => item.id === id);
      if (!routineRecord) {
        return;
      }

      const nextComplete = !completionSet.has(id);
      setPendingRoutineIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      try {
        await setTodayCompletion({
          routine: routineRecord,
          userId: user.uid,
          complete: nextComplete,
          completedAt: new Date(),
        });
      } catch (error) {
        console.error("Failed to update completion", error);
        window.alert("完了状態の更新に失敗しました。");
      } finally {
        setPendingRoutineIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [user, routineRecords, completionSet, pendingRoutineIds],
  );

  if (!authLoading && !user) {
    return (
      <main className="phone" role="main" aria-label="RITU Today">
        <div className="content">
          <header className="brand" aria-label="アプリ ヘッダー">
            <div className="brand-left">
              <div className="logo" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="8"></circle>
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M12 2v4M2 12h4M12 22v-4M22 12h-4"></path>
                </svg>
              </div>
              <p className="brand-title">RITU</p>
            </div>
          </header>

          <h1>Today</h1>
          <section className="routine-list" aria-label="ログイン案内">
            <p className="muted">Firestore に記録するには Google アカウントでログインしてください。</p>
          </section>
          <button className="btn" type="button" onClick={handleSignIn}>
            Googleでログイン
          </button>
        </div>
        <div className="home-indicator" aria-hidden="true"></div>
      </main>
    );
  }

  return (
    <main className="phone" role="main" aria-label="RITU Today">
      <div className="content">
        <header className="brand" aria-label="アプリ ヘッダー">
          <div className="brand-left">
            <div className="logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="8"></circle>
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v4M2 12h4M12 22v-4M22 12h-4"></path>
              </svg>
            </div>
            <p className="brand-title">RITU</p>
          </div>
          <div className="avatar" aria-label={user?.displayName ?? "プロフィール"}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName ?? "プロフィール"} referrerPolicy="no-referrer" />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14Z"></path>
              </svg>
            )}
          </div>
          <button className="btn" type="button" onClick={handleSignOut} disabled={isLoading}>
            ログアウト
          </button>
        </header>

        <h1>Today</h1>

        {dataError ? (
          <p role="alert" className="sub">
            {dataError}
          </p>
        ) : null}
        {isLoading ? (
          <p className="muted" aria-live="polite">
            Firestore と同期中...
          </p>
        ) : null}

        <section className="routine-list" aria-live="polite" aria-label="今日のルーティーン">
          {routines.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onToggle={handleToggle}
              disabled={isLoading || pendingRoutineIds.has(routine.id)}
            />
          ))}
        </section>

        <button
          className="add"
          type="button"
          aria-label="新しいルーティーンを追加"
          onClick={handleAddRoutine}
          disabled={creating || isLoading}
        >
          <span className="plus" aria-hidden="true">
            ＋
          </span>
          <span>{creating ? "追加中..." : "新しいルーティーンを追加"}</span>
        </button>

        <footer className="footer" aria-label="今日の達成率">
          <span aria-hidden="true">🔥</span>
          <span className="muted">今日の達成率</span>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completion.rate}
            aria-label="今日の完了率"
          >
            <span style={{ transform: `scaleX(${completion.rate / 100})` }}></span>
            <span className="visually-hidden">{`${completion.rate}% 完了`}</span>
          </div>
          <span className="rate">{`${completion.rate}%`}</span>
        </footer>
      </div>

      <div className="home-indicator" aria-hidden="true"></div>
    </main>
  );
}
