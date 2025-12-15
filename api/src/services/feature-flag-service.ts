
export const FeatureFlags = {
  BILLING: "billing",
  NOTIFICATIONS: "notifications",
  LINE_INTEGRATION: "line_integration",
  COMMUNITY: "community", // Non-MVP
  PROFILE_DETAILS: "profile_details",
  COMPLETIONS: "completions",
};

export class FeatureFlagService {
  getFlags(_userId: string): Promise<Record<string, boolean>> {
    // In a real app, this would check DB or LaunchDarkly.
    // For MVP, values come from env vars to keep deployment simple.
    return Promise.resolve({
      [FeatureFlags.BILLING]: readFlag("FEATURE_FLAG_BILLING", false),
      [FeatureFlags.NOTIFICATIONS]: readFlag("FEATURE_FLAG_NOTIFICATIONS", false),
      [FeatureFlags.LINE_INTEGRATION]: readFlag("FEATURE_FLAG_LINE_INTEGRATION", false),
      [FeatureFlags.COMMUNITY]: readFlag("FEATURE_FLAG_COMMUNITY", false),
      [FeatureFlags.PROFILE_DETAILS]: readFlag("FEATURE_FLAG_PROFILE_DETAILS", true),
      [FeatureFlags.COMPLETIONS]: readFlag("FEATURE_FLAG_COMPLETIONS", false),
    });
  }
}

function readFlag(envName: string, fallback: boolean): boolean {
  const raw = Deno.env.get(envName);
  if (raw === undefined) return fallback;
  return raw.toLowerCase() === "true";
}
