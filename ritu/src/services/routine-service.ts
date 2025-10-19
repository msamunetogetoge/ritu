import type { Unsubscribe } from "firebase/firestore";
import {
  createBackendGateway,
  resolveBackendOptions,
} from "./routines/backend-gateway.ts";
import { createFirestoreGateway } from "./routines/firestore-gateway.ts";
import type {
  CompletionRecord,
  CreateRoutineInput,
  RoutineGateway,
  RoutineRecord,
  RoutineVisibility,
  SetCompletionOptions,
  SubscribeOptions,
  UpdateRoutineInput,
} from "./routines/types.ts";

type RoutineDataMode = "firestore" | "backend";

const routineDataMode: RoutineDataMode = (() => {
  const raw = import.meta.env.VITE_ROUTINE_DATA_MODE;
  if (raw === "backend" || raw === "firestore") {
    return raw;
  }
  return "firestore";
})();

const firestoreGateway = createFirestoreGateway();
const backendGateway: RoutineGateway | null = routineDataMode === "backend"
  ? createBackendGateway(resolveBackendOptions())
  : null;

const gateway: RoutineGateway = backendGateway ?? firestoreGateway;

export function subscribeRoutines(
  userId: string,
  options: SubscribeOptions<RoutineRecord>,
): Unsubscribe {
  return gateway.subscribeRoutines(userId, options);
}

export function subscribeTodayCompletions(
  userId: string,
  isoDate: string,
  options: SubscribeOptions<CompletionRecord>,
): Unsubscribe {
  return gateway.subscribeTodayCompletions(userId, isoDate, options);
}

export function createRoutine(
  userId: string,
  input: CreateRoutineInput,
): Promise<string> {
  return gateway.createRoutine(userId, input);
}

export function updateRoutine(
  routineId: string,
  input: UpdateRoutineInput,
): Promise<void> {
  return gateway.updateRoutine(routineId, input);
}

export function setTodayCompletion(
  options: SetCompletionOptions,
): Promise<void> {
  return gateway.setTodayCompletion(options);
}

export function deleteRoutine(routineId: string): Promise<void> {
  return gateway.deleteRoutine(routineId);
}

export { formatIsoDate } from "./routines/helpers.ts";

export type {
  CompletionRecord,
  CreateRoutineInput,
  RoutineRecord,
  RoutineVisibility,
  SetCompletionOptions,
  SubscribeOptions,
  UpdateRoutineInput,
};
