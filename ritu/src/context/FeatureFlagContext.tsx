import { createContext, useContext, useEffect, useState, type JSX, type ReactNode } from "react";
import { useAuth } from "./AuthContext.tsx";

// Default flags matching API (override with VITE_FF_* env vars)
const DEFAULT_FLAGS: Record<string, boolean> = resolveDefaultFlags();

interface FeatureFlagContextType {
  flags: Record<string, boolean>;
  loading: boolean;
  isEnabled: (flag: string) => boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

export function FeatureFlagProvider({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useAuth();
  const [flags, setFlags] = useState<Record<string, boolean>>(DEFAULT_FLAGS);
  useEffect(() => {
    // In the future, fetch from API: GET /flags
    // for now, use defaults or logic based on user
    // if (user) { ... }
    setFlags(DEFAULT_FLAGS);
  }, [user]);

  const isEnabled = (flag: string) => !!flags[flag];
  const loading = false;

  return (
    <FeatureFlagContext.Provider value={{ flags, loading, isEnabled }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (context === undefined) {
    throw new Error("useFeatureFlags must be used within a FeatureFlagProvider");
  }
  return context;
}

export function ProtectedFeature(
  { flag, children, fallback }: { flag: string; children: ReactNode; fallback?: ReactNode },
): JSX.Element | null {
  const { isEnabled } = useFeatureFlags();
  if (!isEnabled(flag)) {
    return fallback ? <>{fallback}</> : null;
  }
  return <>{children}</>;
}

function resolveDefaultFlags(): Record<string, boolean> {
  return {
    billing: envFlag("VITE_FF_BILLING", false),
    notifications: envFlag("VITE_FF_NOTIFICATIONS", false),
    line_integration: envFlag("VITE_FF_LINE_INTEGRATION", false),
    community: envFlag("VITE_FF_COMMUNITY", false),
    profile_details: envFlag("VITE_FF_PROFILE_DETAILS", true),
    completions: envFlag("VITE_FF_COMPLETIONS", false),
  };
}

function envFlag(envName: string, fallback: boolean): boolean {
  const raw = import.meta.env[envName];
  if (raw === undefined) return fallback;
  return raw === true || raw === "true";
}
