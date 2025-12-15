export async function getBaseUrl(): Promise<string> {
  const baseUrl = import.meta.env.VITE_ROUTINE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("VITE_ROUTINE_API_BASE_URL is required.");
  }
  return baseUrl.replace(/\/+$/, "");
}

export async function authHeaders(): Promise<HeadersInit> {
  const authInfo = await currentAuthContext();
  if (!authInfo) {
    return {};
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authInfo.token}`,
  };
  if (authInfo.uid) {
    headers["X-User-Id"] = authInfo.uid;
  }
  return headers;
}

async function currentAuthContext(): Promise<
  { token: string; uid: string | null } | null
> {
  const useMock = import.meta.env.VITE_USE_MOCK_AUTH === "true";
  if (useMock) {
    return { token: "mock-token", uid: "mock-user-id" };
  }

  const { auth } = await import("../lib/firebase.ts");
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }
  const token = await currentUser.getIdToken();
  return { token, uid: currentUser.uid };
}

export async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const baseUrl = await getBaseUrl();
  const headers = await authHeaders();
  const mergedHeaders = {
    "Content-Type": "application/json",
    ...headers,
    ...options.headers,
  };

  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: mergedHeaders,
  });

  return response;
}

export async function getLineConfig(): Promise<{ friendUrl: string; friendQr: string }> {
  const res = await fetchWithAuth("/line/config");
  if (!res.ok) {
    throw new Error("Failed to fetch LINE config");
  }
  return res.json();
}
