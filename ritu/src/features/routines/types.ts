export type RoutineStatus = "pending" | "complete";

export interface Routine {
  readonly id: string;
  readonly title: string;
  readonly streakLabel?: string;
  readonly scheduledTime?: string;
  readonly autoShare: boolean;
  readonly status: RoutineStatus;
}

export interface RoutineDialogValue {
  readonly title: string;
  readonly scheduledTime?: string;
  readonly autoShare: boolean;
  readonly visibility: "private" | "public" | "followers";
}
