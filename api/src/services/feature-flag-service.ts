
export const FeatureFlags = {
  BILLING: "billing",
  NOTIFICATIONS: "notifications",
  LINE_INTEGRATION: "line_integration",
  COMMUNITY: "community", // Non-MVP
  PROFILE_DETAILS: "profile_details",
};

export class FeatureFlagService {
  getFlags(_userId: string): Promise<Record<string, boolean>> {
    // In a real app, this would check DB or LaunchDarkly.
    // For MVP, we hardcode defaults based on user request.
    return Promise.resolve({
      [FeatureFlags.BILLING]: true,
      [FeatureFlags.NOTIFICATIONS]: true,
      [FeatureFlags.LINE_INTEGRATION]: true,
      [FeatureFlags.COMMUNITY]: false, // Hidden for refined MVP
      [FeatureFlags.PROFILE_DETAILS]: true, // Needed for settings
    });
  }
}
