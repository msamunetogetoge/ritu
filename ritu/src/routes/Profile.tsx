import { type JSX, useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "../services/user-service.ts";
import { useAuth } from "../context/AuthContext.tsx";
import { ProtectedFeature } from "../context/FeatureFlagContext.tsx";

export default function Profile(): JSX.Element {
  const { user: authUser } = useAuth();
  /* const [profile, setProfile] = useState<User | null>(null); */
  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) return;
    loadProfile();
  }, [authUser]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const u = await getMyProfile();
      // setProfile(u);
      setDisplayName(u.displayName);
      setPhotoUrl(u.photoUrl ?? "");
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("not found")) {
        // New user, prefill from auth
        setDisplayName(authUser?.displayName ?? "");
        setPhotoUrl(authUser?.photoURL ?? "");
      } else {
        setError(e instanceof Error ? e.message : String(e));
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
        displayName,
        photoUrl: photoUrl || null,
      });
      // setProfile(updated);
      alert("プロフィールを保存しました");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!authUser) return <p>ログインしてください</p>;
  if (loading) return <p>読み込み中...</p>;

  return (
    <div className="main-scroll">
      <h1>プロフィール</h1>
      <div className="profile-actions">
        <ProtectedFeature flag="notifications">
          <a href="/settings/notifications" className="btn-link">通知設定</a>
        </ProtectedFeature>
        <ProtectedFeature flag="billing">
          <a href="/billing" className="btn-link">プラン管理</a>
        </ProtectedFeature>
      </div>
      <form onSubmit={handleSave} className="profile-form">
        {error && <p className="error">{error}</p>}
        <div className="form-group">
          <label>名前</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>アイコンURL</label>
          <input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />
        </div>
        {photoUrl && (
          <img
            src={photoUrl}
            alt="Preview"
            className="avatar-preview"
            style={{ width: 64, height: 64, borderRadius: "50%" }}
          />
        )}
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "保存中..." : "保存する"}
        </button>
      </form>
      <style>
        {`
          .profile-actions { display: flex; gap: 0.75rem; padding: 0 1rem; margin-bottom: 1rem; }
          .btn-link { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.9rem; background: #222; border-radius: 12px; color: white; text-decoration: none; font-weight: bold; }
          .profile-form { padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
          .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
          .form-group input { padding: 0.5rem; font-size: 1rem; }
          .error { color: red; }
      `}
      </style>
    </div>
  );
}
