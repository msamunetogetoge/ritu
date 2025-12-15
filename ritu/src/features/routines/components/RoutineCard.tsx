import type { Routine } from "../types.ts";
import { ActionButton } from "./ActionButton.tsx";

interface RoutineCardProps {
  readonly routine: Routine;
  readonly disabled?: boolean;
  readonly onToggle?: (id: Routine["id"]) => void;
  readonly onEdit: (id: Routine["id"]) => void;
  readonly onDelete: (id: Routine["id"]) => void;
  readonly showCompletionButton?: boolean;
  readonly showAutoShare?: boolean;
}

export function RoutineCard(
  {
    routine,
    disabled,
    onToggle,
    onEdit,
    onDelete,
    showCompletionButton = true,
    showAutoShare = true,
  }: RoutineCardProps,
): JSX.Element {
  const isComplete = routine.status === "complete";
  const cardClassName = `card${isComplete ? " is-complete" : ""}`;
  const canToggle = Boolean(onToggle) && showCompletionButton;

  return (
    <section className={cardClassName} aria-label={routine.title}>
      <div className="row title-row">
        <div className="left">
          <div className="check" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="name">{routine.title}</div>
        </div>
        {showAutoShare && routine.autoShare
          ? (
            <div className="auto-pill" aria-label="自動投稿ON">
              A&nbsp;Auto
            </div>
          )
          : null}
      </div>

      {routine.streakLabel || routine.scheduledTime
        ? (
          <div className="row sub" aria-label="継続情報">
            {routine.streakLabel ? <span>{routine.streakLabel}</span> : null}
            {routine.streakLabel && routine.scheduledTime
              ? <span className="dot" aria-hidden="true"></span>
              : null}
            {routine.scheduledTime
              ? (
                <span className="time">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="8"></circle>
                    <path d="M12 8v4l3 1.5"></path>
                  </svg>
                  <strong>{routine.scheduledTime}</strong>
                </span>
              )
              : null}
          </div>
        )
        : null}

      <div className="sub action-row">
        {canToggle && onToggle
          ? (
            <button
              className="btn"
              type="button"
              aria-pressed={isComplete}
              aria-label={isComplete
                ? `${routine.title} の完了を取り消す`
                : `${routine.title} を完了`}
              onClick={() => onToggle(routine.id)}
              disabled={disabled}
            >
              {isComplete ? "完了済み" : "完了"}
            </button>
          )
          : null}
        <ActionButton
          variant="secondary"
          onClick={() => onEdit(routine.id)}
          disabled={disabled}
        >
          編集
        </ActionButton>
        <ActionButton
          variant="danger"
          onClick={() => onDelete(routine.id)}
          disabled={disabled}
        >
          削除
        </ActionButton>
      </div>
    </section>
  );
}
