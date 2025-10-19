import type { RoutineRecord } from "../../services/routines/types.ts";
import type { RoutineDialogValue } from "./types.ts";

export function extractScheduledTime(
  schedule: RoutineRecord["schedule"],
): string | undefined {
  if (!schedule || typeof schedule !== "object") {
    return undefined;
  }
  const maybeTime = (schedule as { readonly time?: unknown }).time;
  if (typeof maybeTime !== "string") {
    return undefined;
  }
  const trimmed = maybeTime.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeDialogValue(
  value: RoutineDialogValue,
): RoutineDialogValue {
  return {
    title: value.title.trim(),
    scheduledTime: normalizeTime(value.scheduledTime ?? null),
    autoShare: value.autoShare,
  };
}

export function normalizeTime(input: string | null): string | undefined {
  if (!input) {
    return undefined;
  }
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
