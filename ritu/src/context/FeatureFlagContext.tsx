import { createContext, useContext, useEffect, useState, type JSX, type ReactNode } from "react";
import { useAuth } from "./AuthContext.tsx";

// Default flags matching API
const DEFAULT_FLAGS: Record<string, boolean> = {
  billing: true,
  notifications: true,
  line_integration: true,
  community: false,
  profile_details: true,
};

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

export function ProtectedFeature({ flag, children }: { flag: string; children: ReactNode }): JSX.Element | null {
  const { isEnabled } = useFeatureFlags();
  if (!isEnabled(flag)) {
    return null;
  }
  return <>{children}</>;
}
