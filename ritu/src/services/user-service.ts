import { fetchWithAuth } from "./api-client.ts";

export interface NotificationSettings {
  emailEnabled: boolean;
  lineEnabled: boolean;
  lineUserId?: string | null;
  scheduleTime?: string;
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

export async function linkLineLogin(idToken: string): Promise<LineLinkResult> {
  const response = await fetchWithAuth("/line/login", {
    method: "POST",
    body: JSON.stringify({ idToken }),
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
