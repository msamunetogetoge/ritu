export async function getBaseUrl(): Promise<string> {
  const baseUrl = import.meta.env.VITE_ROUTINE_API_BASE_URL;
  if (!baseUrl) {
    // If running with local firebase emulator, we might default to api URL?
    // But backend-gateway throws error.
    // For now, follow backend-gateway pattern.
    throw new Error("VITE_ROUTINE_API_BASE_URL is required.");
  }
  return baseUrl.replace(/\/+$/, "");
}

export async function authHeaders(): Promise<HeadersInit> {
  const token = await currentAuthToken();
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

async function currentAuthToken(): Promise<string | null> {
  const useMock = import.meta.env.VITE_USE_MOCK_AUTH === "true";
  if (useMock) {
    return "mock-token";
  }

  const { auth } = await import("../lib/firebase.ts"); // Adjust path if needed. lib is in ../lib (relative to services root) usually?
  // file is in services/api-client.ts. lib is ../lib.
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }
  return await currentUser.getIdToken();
}

export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
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
