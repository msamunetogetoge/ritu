import { type JSX, useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "../services/user-service.ts";
import { getLineConfig } from "../services/api-client.ts";
import { useAuth } from "../context/AuthContext.tsx";

export default function NotificationSettingsPage(): JSX.Element {
  const { user: authUser } = useAuth();
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [lineEnabled, setLineEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [lineConfig, setLineConfig] = useState<{ friendUrl: string; friendQr: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) return;
    loadSettings();
  }, [authUser]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [u, config] = await Promise.all([
        getMyProfile(),
        getLineConfig().catch(() => ({ friendUrl: "", friendQr: "" })),
      ]);
      // u.notificationSettings might be undefined
      const settings = u.notificationSettings || { emailEnabled: false, lineEnabled: false, scheduleTime: "09:00" };
      setEmailEnabled(settings.emailEnabled ?? false);
      setLineEnabled(settings.lineEnabled ?? false);
      setScheduleTime(settings.scheduleTime ?? "09:00");
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
    try {
      await updateMyProfile({
        notificationSettings: {
          emailEnabled,
          lineEnabled,
          scheduleTime,
        },
      });
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

  if (loading) return <div className="p-4">読み込み中...</div>;
  if (!authUser) return <div className="p-4">ログインしてください</div>;

  return (
    <div className="main-scroll">
      <div className="settings-container">
        <h1>通知設定</h1>
        {error && <p className="error">{error}</p>}
        
        <form onSubmit={handleSave} className="settings-form">
          <div className="setting-group">
            <h3>通知タイミング</h3>
            <label>
                毎日
                <input 
                    type="time" 
                    value={scheduleTime} 
                    onChange={(e) => setScheduleTime(e.target.value)} 
                />
                に通知
            </label>
          </div>

          <div className="setting-group">
            <h3>メール通知</h3>
            <label className="toggle-label">
              <input 
                type="checkbox" 
                checked={emailEnabled} 
                onChange={(e) => setEmailEnabled(e.target.checked)} 
              />
              有効にする
            </label>
          </div>

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

            {lineConfig && (
              <div className="line-friend-section">
                {lineConfig.friendQr && (
                    <div className="qr-container">
                        <img src={lineConfig.friendQr} alt="LINE QR Code" className="qr-code" />
                    </div>
                )}
                {lineConfig.friendUrl && (
                    <a href={lineConfig.friendUrl} target="_blank" rel="noopener noreferrer" className="btn-line">
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

      <style>{`
        .settings-container { padding: 1rem; max-width: 600px; margin: 0 auto; }
        .settings-form { display: flex; flex-direction: column; gap: 2rem; }
        .setting-group { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; background: #222; border-radius: 8px; }
        .setting-group h3 { margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #ddd; }
        .toggle-label { display: flex; align-items: center; gap: 0.5rem; }
        .line-friend-section { margin-top: 1rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; padding-top: 1rem; border-top: 1px solid #444; }
        .qr-container { background: white; padding: 0.5rem; border-radius: 8px; }
        .qr-code { width: 150px; height: 150px; object-fit: contain; display: block; }
        .btn-line { background: #06c755; color: white; border: none; padding: 0.7rem 1.5rem; border-radius: 20px; text-decoration: none; font-weight: bold; font-size: 0.9rem; display: inline-block; }
        .btn-primary { background: #fee804; color: black; border: none; padding: 1rem; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 1.1rem; }
        .main-scroll { padding-bottom: 5rem; }
        .note { color: #888; font-size: 0.8rem; }
        input[type="time"] { padding: 0.3rem; border-radius: 4px; border: 1px solid #444; background: #333; color: white; margin: 0 0.5rem; }
      `}</style>
    </div>
  );
}
