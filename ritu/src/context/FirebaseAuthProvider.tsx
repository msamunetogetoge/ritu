import { type ReactNode, useEffect, useState } from "react";
import { type User, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "../lib/firebase.ts";
import { AuthContext } from "./AuthContextObject.ts";

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Sign in failed", error);
      alert("ログインに失敗しました");
    }
  };

  const signOutAction = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed", error);
      alert("ログアウトに失敗しました");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut: signOutAction }}>
      {children}
    </AuthContext.Provider>
  );
}
