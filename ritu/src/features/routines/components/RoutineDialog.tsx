import { type JSX, useEffect, useRef, useState } from "react";
import type { RoutineDialogValue } from "../types.ts";
import { normalizeDialogValue } from "../utils.ts";
import { useFeatureFlags } from "../../../context/FeatureFlagContext.tsx";

interface RoutineDialogProps {
  readonly mode: "create" | "edit";
  readonly open: boolean;
  readonly initialValue: RoutineDialogValue;
  readonly submitting: boolean;
  readonly onSubmit: (value: RoutineDialogValue) => void;
  readonly onClose: () => void;
}

export function RoutineDialog(
  { mode, open, initialValue, submitting, onSubmit, onClose }: RoutineDialogProps,
): JSX.Element | null {
  const [formValue, setFormValue] = useState<RoutineDialogValue>(initialValue);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const { isEnabled } = useFeatureFlags();

  useEffect(() => {
    if (open) {
      setFormValue(initialValue);
    }
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === dialogRef.current) {
      onClose();
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = normalizeDialogValue(formValue);
    if (value.title.length === 0) {
      globalThis.alert("タイトルを入力してください。");
      return;
    }
    onSubmit(value);
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="dialog-backdrop"
      ref={(node) => {
        dialogRef.current = node;
      }}
      onMouseDown={handleBackdropClick}
      role="presentation"
    >
      <form
        className="dialog"
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
      >
        <h2>
          {mode === "create" ? "ルーティーンを追加" : "ルーティーンを編集"}
        </h2>

        <div className="field">
          <label htmlFor="routine-title">タイトル</label>
          <input
            id="routine-title"
            name="title"
            type="text"
            placeholder="例: 朝ラン"
            value={formValue.title}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setFormValue((prev) => ({
                ...prev,
                title: value,
              }));
            }}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="routine-time">予定時刻</label>
          <input
            id="routine-time"
            name="scheduledTime"
            type="time"
            value={formValue.scheduledTime ?? ""}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setFormValue((prev) => ({
                ...prev,
                scheduledTime: value,
                notify: value ? prev.notify : false,
              }));
            }}
          />
          <p className="hint">入力すると Today のリマインドに表示されます。</p>
        </div>

        <div className="checkbox-row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={Boolean(formValue.notify)}
              onChange={(event) => {
                const { checked } = event.currentTarget;
                setFormValue((prev) => ({
                  ...prev,
                  notify: checked,
                }));
              }}
              disabled={!formValue.scheduledTime}
            />
            LINE通知を受け取る
          </label>
          {!formValue.scheduledTime && <p className="hint">通知するには時刻を設定してください。</p>}
        </div>

        {isEnabled("community") && (
          <>
            <div className="checkbox-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={formValue.autoShare}
                  onChange={(event) => {
                    const { checked } = event.currentTarget;
                    setFormValue((prev) => ({
                      ...prev,
                      autoShare: checked,
                    }));
                  }}
                />
                自動共有をオンにする
              </label>
            </div>

            <div className="field">
              <label htmlFor="routine-visibility">公開範囲</label>
              <div className="select-wrapper">
                <select
                  id="routine-visibility"
                  name="visibility"
                  value={formValue.visibility}
                  onChange={(event) => {
                    const value = event.currentTarget.value as
                      | "private"
                      | "public"
                      | "followers";
                    setFormValue((prev) => ({
                      ...prev,
                      visibility: value,
                    }));
                  }}
                >
                  <option value="private">自分のみ (Private)</option>
                  <option value="followers">フォロワーのみ</option>
                  <option value="public">全体公開 (Public)</option>
                </select>
              </div>
            </div>
          </>
        )}

        <div className="dialog-actions">
          <button
            type="button"
            className="dialog-button secondary"
            onClick={onClose}
            disabled={submitting}
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="dialog-button primary"
            disabled={submitting}
          >
            {submitting ? "保存中..." : mode === "create" ? "追加する" : "更新する"}
          </button>
        </div>
      </form>
    </div>
  );
}
