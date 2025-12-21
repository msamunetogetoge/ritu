import { type JSX, useEffect, useState } from "react";
import {
  type NotificationSettings,
  getMyProfile,
  linkLineLogin,
  updateMyProfile,
} from "../services/user-service.ts";
import { getLineConfig } from "../services/api-client.ts";
import { getLineLoginToken } from "../lib/line-login.ts";
import { useAuth } from "../context/AuthContext.tsx";

export default function NotificationSettingsPage(): JSX.Element {
  const { user: authUser } = useAuth();
  const [lineEnabled, setLineEnabled] = useState(false);
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [baseNotificationSettings, setBaseNotificationSettings] = useState<
    NotificationSettings | null
  >(null);
  const [autoLinkAttempted, setAutoLinkAttempted] = useState(false);
  const [lineConfig, setLineConfig] = useState<
    { friendUrl: string; friendQr: string } | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) return;
    loadSettings();
  }, [authUser]);

  useEffect(() => {
    if (!authUser || autoLinkAttempted || linking) return;
    if (!hasLineLoginParams()) {
      setAutoLinkAttempted(true);
      return;
    }
    setAutoLinkAttempted(true);
    handleLineLogin();
  }, [authUser, autoLinkAttempted, linking]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [u, config] = await Promise.all([
        getMyProfile(),
        getLineConfig().catch(() => ({ friendUrl: "", friendQr: "" })),
      ]);
      // u.notificationSettings might be undefined
      const settings = u.notificationSettings || {
        emailEnabled: false,
        lineEnabled: false,
        lineUserId: null,
      };
      setBaseNotificationSettings(settings);
      setLineEnabled(settings.lineEnabled ?? false);
      setLineUserId(settings.lineUserId ?? null);
      setLineConfig(config);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError(String(e));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (lineEnabled && !lineUserId) {
      setError("LINEログインで連携してください。");
      setSaving(false);
      return;
    }
    try {
      const mergedSettings: NotificationSettings = {
        ...(baseNotificationSettings ?? {
          emailEnabled: false,
          lineEnabled: false,
          lineUserId: null,
        }),
        lineEnabled,
        lineUserId,
      };
      await updateMyProfile({ notificationSettings: mergedSettings });
      setBaseNotificationSettings(mergedSettings);
      alert("設定を保存しました");
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError(String(e));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLineLogin = async () => {
    setLinking(true);
    setError(null);
    try {
      const { idToken, lineLoginContext } = await getLineLoginToken();
      const result = await linkLineLogin(idToken, lineLoginContext);
      setLineUserId(result.lineUserId);
      setLineEnabled(true);
      setBaseNotificationSettings((prev) => ({
        ...(prev ?? {
          emailEnabled: false,
          lineEnabled: false,
          lineUserId: null,
        }),
        lineEnabled: true,
        lineUserId: result.lineUserId,
        lineLoginContext: lineLoginContext ?? prev?.lineLoginContext,
      }));
      clearLineLoginParams();
      alert("LINEと連携しました。必要に応じて他の設定も保存してください。");
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError(String(e));
      }
    } finally {
      setLinking(false);
    }
  };

  const hasLineLoginParams = () => {
    const search = globalThis.location?.search ?? "";
    if (!search) return false;
    const params = new URLSearchParams(search);
    return ["code", "state", "liffClientId", "liffRedirectUri"].some((key) =>
      params.has(key)
    );
  };

  const clearLineLoginParams = () => {
    if (!globalThis.history || !globalThis.location) return;
    const url = new URL(globalThis.location.href);
    url.search = "";
    globalThis.history.replaceState({}, "", url.toString());
  };

  if (loading) return <div className="p-4">読み込み中...</div>;
  if (!authUser) return <div className="p-4">ログインしてください</div>;

  return (
    <div className="main-scroll">
      <div className="settings-container">
        <h1>通知設定</h1>
        {error && <p className="error">{error}</p>}

        <form onSubmit={handleSave} className="settings-form">
          <div className="setting-group">
            <h3>LINE通知</h3>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={lineEnabled}
                onChange={(e) => setLineEnabled(e.target.checked)}
              />
              有効にする
            </label>

            <div className="line-status">
              <div>
                <p className="note">
                  {lineUserId ? "連携済み" : "LINEログインで連携してください。"}
                </p>
                {!lineUserId && (
                  <p className="note">
                    LINE通知をオンにするには連携が必要です。
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn-outline"
                onClick={handleLineLogin}
                disabled={linking}
              >
                {linking
                  ? "連携中..."
                  : lineUserId
                  ? "LINE再連携"
                  : "LINEログインして連携"}
              </button>
            </div>

            {lineConfig && (
              <div className="line-friend-section">
                {lineConfig.friendQr && (
                  <div className="qr-container">
                    <img
                      src={lineConfig.friendQr}
                      alt="LINE QR Code"
                      className="qr-code"
                    />
                  </div>
                )}
                {lineConfig.friendUrl && (
                  <a
                    href={lineConfig.friendUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-line"
                  >
                    LINEで友だち追加
                  </a>
                )}
                {!lineConfig.friendUrl && !lineConfig.friendQr && (
                  <p className="note">LINE連携設定が読み込めませんでした</p>
                )}
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "保存中..." : "保存する"}
          </button>
        </form>
      </div>

      <style>
        {`
        .settings-container { padding: 1rem; max-width: 600px; margin: 0 auto; }
        .settings-form { display: flex; flex-direction: column; gap: 2rem; }
        .setting-group { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; background: #222; border-radius: 8px; }
        .setting-group h3 { margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #ddd; }
        .toggle-label { display: flex; align-items: center; gap: 0.5rem; }
        .line-friend-section { margin-top: 1rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; padding-top: 1rem; border-top: 1px solid #444; }
        .line-status { display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; margin-top: 0.5rem; }
        .btn-outline { background: transparent; color: #06c755; border: 1px solid #06c755; padding: 0.5rem 1rem; border-radius: 10px; font-weight: bold; cursor: pointer; }
        .btn-outline:disabled { opacity: 0.6; cursor: not-allowed; }
        .qr-container { background: white; padding: 0.5rem; border-radius: 8px; }
        .qr-code { width: 150px; height: 150px; object-fit: contain; display: block; }
        .btn-line { background: #06c755; color: white; border: none; padding: 0.7rem 1.5rem; border-radius: 20px; text-decoration: none; font-weight: bold; font-size: 0.9rem; display: inline-block; }
        .btn-primary { background: #fee804; color: black; border: none; padding: 1rem; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 1.1rem; }
        .main-scroll { padding-bottom: 5rem; }
        .note { color: #888; font-size: 0.8rem; }
      `}
      </style>
    </div>
  );
}
