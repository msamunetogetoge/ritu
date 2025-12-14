import { type ReactNode, useEffect, useState } from "react";
import { AuthContext } from "./AuthContextObject.ts";
import type { User } from "firebase/auth";

// Mock User object satisfying firebase/auth User interface partially
// We only need basic fields for now
const MOCK_USER: Partial<User> = {
  uid: "mock-user-id",
  displayName: "Mock User",
  email: "mock@example.com",
  photoURL: null,
  getIdToken: () => Promise.resolve("mock-token"),
  emailVerified: true,
  isAnonymous: false,
  metadata: {},
  providerData: [],
  refreshToken: "mock-refresh-token",
  tenantId: null,
  delete: async () => {},
  toJSON: () => ({}),
  reload: async () => {},
};

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate initial check
    const stored = localStorage.getItem("mock_auth_user");
    if (stored) {
      setUser(MOCK_USER as User);
    }
    setLoading(false);
  }, []);

  const signIn = async () => {
    // Simulate login delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    localStorage.setItem("mock_auth_user", "true");
    const u = MOCK_USER as User;
    setUser(u);
  };

  const signOutAction = async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    localStorage.removeItem("mock_auth_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signOut: signOutAction }}
    >
      {children}
    </AuthContext.Provider>
  );
}
