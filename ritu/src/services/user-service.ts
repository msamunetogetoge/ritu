import { fetchWithAuth } from "./api-client.ts";

export interface NotificationSettings {
  emailEnabled: boolean;
  lineEnabled: boolean;
  lineUserId?: string | null;
  scheduleTime?: string;
  lineLoginContext?: LineLoginContext;
}

export interface User {
  id: string;
  displayName: string;
  photoUrl: string | null;
  notificationSettings?: NotificationSettings;
  isPremium?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserUpdateInput {
  displayName?: string;
  photoUrl?: string | null;
  notificationSettings?: NotificationSettings;
  isPremium?: boolean;
}

export interface LineLinkResult {
  lineUserId: string;
  user: User;
  expiresAt?: number;
  issuer?: string;
}

/** LINE Login のリダイレクトURLに付与されるパラメータ。 */
export interface LineLoginContext {
  code?: string;
  state?: string;
  liffClientId?: string;
  liffRedirectUri?: string;
}

export async function getMyProfile(): Promise<User> {
  const response = await fetchWithAuth("/users/me");
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Profile not found");
    }
    throw new Error(await response.text());
  }
  return await response.json() as User;
}

/**
 * LINE Login の ID トークンを送信し、必要ならリダイレクト情報も保存する。
 */
export async function linkLineLogin(
  idToken: string,
  lineLoginContext?: LineLoginContext | null,
): Promise<LineLinkResult> {
  const response = await fetchWithAuth("/line/login", {
    method: "POST",
    body: JSON.stringify({ idToken, lineLoginContext }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return await response.json() as LineLinkResult;
}

export async function updateMyProfile(input: UserUpdateInput): Promise<User> {
  const response = await fetchWithAuth("/users/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return await response.json() as User;
}
