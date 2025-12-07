/* formatIsoDateはYYYY-MM-DD形式の文字列を返す。 */
export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}



export function normalizeRoutineTitle(title: string): string {
  return title.trim();
}
