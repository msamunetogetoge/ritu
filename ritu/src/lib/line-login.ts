export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

/** LINE Login のリダイレクトURLに付与されるパラメータ。 */
export interface LineLoginContext {
  code?: string;
  state?: string;
  liffClientId?: string;
  liffRedirectUri?: string;
}

let liffPromise: Promise<typeof import("@line/liff").default> | null = null;

/** LIFF SDK を遅延ロードして初期化する。 */
async function loadLiff() {
  if (!liffPromise) {
    const liffId = import.meta.env.VITE_LINE_LIFF_ID;
    if (!liffId) {
      throw new Error(
        "VITE_LINE_LIFF_ID is not set. LINE Login cannot be used.",
      );
    }
    liffPromise = import("@line/liff").then(async ({ default: liff }) => {
      await liff.init({ liffId });
      await liff.ready;
      return liff;
    });
  }
  return await liffPromise;
}

/**
 * LINE Login の ID トークンとプロフィールを取得する。
 * 未ログイン時は LINE のログイン画面に遷移する。
 */
export async function getLineLoginToken(): Promise<
  { idToken: string; profile: LineProfile; lineLoginContext?: LineLoginContext }
> {
  const liff = await loadLiff();

  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: globalThis.location.href });
    // ログイン後にリダイレクトされるため、ここではresolveしない。
    return new Promise(() => {});
  }

  const idToken = liff.getIDToken();
  if (!idToken) {
    throw new Error("LINEのIDトークンを取得できませんでした。");
  }

  const profile = await liff.getProfile();
  const lineLoginContext = getLineLoginContextFromUrl();
  return {
    idToken,
    profile: {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl ?? undefined,
      statusMessage: profile.statusMessage ?? undefined,
    },
    lineLoginContext,
  };
}

/** LINE Login のリダイレクトURLから文脈情報を取り出す。 */
function getLineLoginContextFromUrl(): LineLoginContext | undefined {
  const search = globalThis.location?.search ?? "";
  if (!search) return undefined;
  const params = new URLSearchParams(search);
  const code = params.get("code") ?? undefined;
  const state = params.get("state") ?? undefined;
  const liffClientId = params.get("liffClientId") ?? undefined;
  const liffRedirectUri = params.get("liffRedirectUri") ?? undefined;
  if (!code && !state && !liffClientId && !liffRedirectUri) {
    return undefined;
  }
  return { code, state, liffClientId, liffRedirectUri };
}
