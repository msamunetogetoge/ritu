/* formatIsoDateはYYYY-MM-DD形式の文字列を返す。 */
export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toFirestoreSchedule(
  scheduledTime?: string,
): Record<string, unknown> {
  const schedule: Record<string, unknown> = { type: "daily" };
  if (scheduledTime && scheduledTime.trim().length > 0) {
    schedule.time = scheduledTime.trim();
  }
  return schedule;
}

export function normalizeRoutineTitle(title: string): string {
  return title.trim();
}
