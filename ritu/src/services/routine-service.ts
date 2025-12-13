import type { Unsubscribe } from "firebase/firestore";
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

// Lazy load gateway to avoid top-level Firebase initialization
let _gateway: RoutineGateway | undefined;

async function getGateway(): Promise<RoutineGateway> {
  if (_gateway) return _gateway;

  const routineDataMode = import.meta.env.VITE_ROUTINE_DATA_MODE;
  const useBackend = routineDataMode === "backend";

  if (useBackend) {
     const { createBackendGateway, resolveBackendOptions } = await import("./routines/backend-gateway.ts");
     _gateway = createBackendGateway(resolveBackendOptions());
  } else {
     const { createFirestoreGateway } = await import("./routines/firestore-gateway.ts");
     _gateway = createFirestoreGateway();
  }
  return _gateway;
}

export function subscribeRoutines(
  userId: string,
  options: SubscribeOptions<RoutineRecord>,
): Unsubscribe {
  // Subscriptions are synchronous in return type (Unsubscribe), but dynamic import is async.
  // We need a wrapper.
  let unsubscribe: Unsubscribe = () => {};
  let isUnsubscribed = false;

  getGateway().then(gw => {
    if (isUnsubscribed) return;
    const unsub = gw.subscribeRoutines(userId, options);
    unsubscribe = () => {
        unsub();
        isUnsubscribed = true;
    };
  }).catch(err => {
    console.error("Failed to load gateway", err);
    options.onError?.(err);
  });

  return () => {
    isUnsubscribed = true;
    unsubscribe();
  };
}

export function subscribeTodayCompletions(
  userId: string,
  isoDate: string,
  options: SubscribeOptions<CompletionRecord>,
): Unsubscribe {
    let unsubscribe: Unsubscribe = () => {};
    let isUnsubscribed = false;

    getGateway().then(gw => {
      if (isUnsubscribed) return;
      const unsub = gw.subscribeTodayCompletions(userId, isoDate, options);
      unsubscribe = () => {
          unsub();
          isUnsubscribed = true;
      };
    }).catch(err => {
      console.error("Failed to load gateway", err);
      options.onError?.(err);
    });
  
    return () => {
      isUnsubscribed = true;
      unsubscribe();
    };
}

export async function createRoutine(
  userId: string,
  input: CreateRoutineInput,
): Promise<string> {
  const gw = await getGateway();
  return gw.createRoutine(userId, input);
}

export async function updateRoutine(
  routineId: string,
  input: UpdateRoutineInput,
): Promise<void> {
  const gw = await getGateway();
  return gw.updateRoutine(routineId, input);
}

export async function setTodayCompletion(
  options: SetCompletionOptions,
): Promise<void> {
  const gw = await getGateway();
  return gw.setTodayCompletion(options);
}

export async function deleteRoutine(routineId: string): Promise<void> {
  const gw = await getGateway();
  return gw.deleteRoutine(routineId);
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
