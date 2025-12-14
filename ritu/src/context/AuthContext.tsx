import { lazy, type ReactNode, Suspense } from "react";

// Lazy load providers to avoid importing firebase sdk in mock mode
const FirebaseAuthProvider = lazy(
  () =>
    import("./FirebaseAuthProvider.tsx").then((m) => ({
      default: m.FirebaseAuthProvider,
    })),
);
const MockAuthProvider = lazy(() =>
  import("./MockAuthProvider.tsx").then((m) => ({
    default: m.MockAuthProvider,
  }))
);

const useMock = import.meta.env.VITE_USE_MOCK_AUTH === "true";

export function AuthProvider({ children }: { children: ReactNode }) {
  if (useMock) {
    return (
      <Suspense fallback={null}>
        <MockAuthProvider>{children}</MockAuthProvider>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <FirebaseAuthProvider>{children}</FirebaseAuthProvider>
    </Suspense>
  );
}

export { useAuth } from "./useAuth.ts";
