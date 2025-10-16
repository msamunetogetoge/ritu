/** @jsxImportSource https://esm.sh/react@18.2.0?target=deno */
import {
  useCallback,
  useMemo,
  useState,
  type JSX,
} from "https://esm.sh/react@18.2.0?target=deno";

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

const INITIAL_ROUTINES = [
  {
    id: "morning-run",
    title: "朝ラン",
    streakLabel: "12日継続中",
    scheduledTime: "07:00",
    autoShare: true,
    status: "pending",
  },
  {
    id: "english-study",
    title: "英語勉強",
    nowLabel: "30分リスニング中",
    autoShare: false,
    status: "pending",
  },
  {
    id: "stretch",
    title: "ナイトストレッチ",
    streakLabel: "5日継続中",
    scheduledTime: "22:30",
    autoShare: false,
    status: "complete",
  },
] satisfies ReadonlyArray<Routine>;

function computeCompletion(routines: ReadonlyArray<Routine>): CompletionSummary {
  const total = routines.length;
  const completed = routines.filter((routine) => routine.status === "complete").length;
  const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, rate };
}

interface RoutineCardProps {
  readonly routine: Routine;
  readonly onToggle: (id: Routine["id"]) => void;
}

function RoutineCard({ routine, onToggle }: RoutineCardProps): JSX.Element {
  const isComplete = routine.status === "complete";
  const cardClassName = `card${isComplete ? " is-complete" : ""}`;

  return (
    <section className={cardClassName} aria-label={routine.title}>
      <div className="row title-row">
        <div className="left">
          <div className="check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
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
          {routine.streakLabel && routine.scheduledTime ? (
            <span className="dot" aria-hidden="true"></span>
          ) : null}
          {routine.scheduledTime ? (
            <span className="time">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
      >
        {isComplete ? "完了済み" : "完了"}
      </button>
    </section>
  );
}

function generateRoutineId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `routine-${Date.now()}`;
}

function normalizeTime(input: string | null): string | undefined {
  if (!input) {
    return undefined;
  }
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default function App(): JSX.Element {
  const [routines, setRoutines] = useState<ReadonlyArray<Routine>>(INITIAL_ROUTINES);

  const completion = useMemo(() => computeCompletion(routines), [routines]);

  const handleToggle = useCallback((id: Routine["id"]) => {
    setRoutines((prev) =>
      prev.map((routine) =>
        routine.id === id
          ? {
              ...routine,
              status: routine.status === "complete" ? "pending" : "complete",
            }
          : routine,
      ),
    );
  }, []);

  const handleAddRoutine = useCallback(() => {
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

    const nextRoutine: Routine = {
      id: generateRoutineId(),
      title: trimmedName,
      streakLabel: "0日継続中",
      scheduledTime: time,
      autoShare: wantsAutoShare,
      status: "pending",
    };

    setRoutines((prev) => [...prev, nextRoutine]);
  }, []);

  return (
    <main className="phone" role="main" aria-label="RITU Today">
      <div className="content">
        <header className="brand" aria-label="アプリ ヘッダー">
          <div className="brand-left">
            <div className="logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="8"></circle>
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v4M2 12h4M12 22v-4M22 12h-4"></path>
              </svg>
            </div>
            <p className="brand-title">RITU</p>
          </div>
          <div className="avatar" aria-label="プロフィール">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14Z"></path>
            </svg>
          </div>
        </header>

        <h1>Today</h1>

        <section className="routine-list" aria-live="polite" aria-label="今日のルーティーン">
          {routines.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} onToggle={handleToggle} />
          ))}
        </section>

        <button
          className="add"
          type="button"
          aria-label="新しいルーティーンを追加"
          onClick={handleAddRoutine}
        >
          <span className="plus" aria-hidden="true">
            ＋
          </span>
          <span>新しいルーティーンを追加</span>
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

