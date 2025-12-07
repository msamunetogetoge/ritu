import { fetchWithAuth } from "./api-client.ts";

export interface User {
  id: string;
  displayName: string;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserUpdateInput {
  displayName?: string;
  photoUrl?: string | null;
}

export async function getMyProfile(): Promise<User> {
  const response = await fetchWithAuth("/users/me");
  if (!response.ok) {
     if (response.status === 404) {
         // Should we throw or return null?
         // App logic: invalid profile -> redirect to setup?
         throw new Error("Profile not found");
     }
     throw new Error(await response.text());
  }
  return await response.json() as User;
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
