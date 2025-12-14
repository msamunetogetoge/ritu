import { formatIsoDate } from "./helpers.ts";
import type {
  BackendGatewayOptions,
  CompletionRecord,
  CreateRoutineInput,
  RoutineGateway,
  RoutineRecord,
  SetCompletionOptions,
  SubscribeOptions,
  UpdateRoutineInput,
} from "./types.ts";

interface RestRoutine {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  schedule?: Record<string, unknown> | null;
  autoShare: boolean;
  visibility: string;
  currentStreak: number;
  maxStreak: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

interface RestCompletion {
  id: string;
  routineId: string;
  userId: string;
  date: string;
  createdAt?: string;
}

export function createBackendGateway(
  options: BackendGatewayOptions,
): RoutineGateway {
  let cachedRoutines: RoutineRecord[] = [];
  const setCache = (routines: RoutineRecord[]) => {
    cachedRoutines = routines;
  };
  const getCache = () => cachedRoutines;

  return {
    subscribeRoutines: (userId, subscribeOptions) =>
      pollRoutines(userId, subscribeOptions, options, setCache),
    subscribeTodayCompletions: (userId, isoDate, subscribeOptions) =>
      pollCompletions(
        userId,
        isoDate,
        subscribeOptions,
        options,
        getCache,
        setCache,
      ),
    createRoutine: (userId, input) => createRoutine(userId, input, options),
    updateRoutine: (routineId, input) =>
      updateRoutine(routineId, input, options),
    setTodayCompletion: (payload) => setTodayCompletion(payload, options),
    deleteRoutine: (routineId) => deleteRoutine(routineId, options),
  };
}

export function resolveBackendOptions(): BackendGatewayOptions {
  const baseUrl = import.meta.env.VITE_ROUTINE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("VITE_ROUTINE_API_BASE_URL is required for backend mode.");
  }
  const pollMsRaw = import.meta.env.VITE_ROUTINE_API_POLL_MS;
  const pollIntervalMs = pollMsRaw ? Number.parseInt(pollMsRaw, 10) : 0;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    pollIntervalMs: Number.isFinite(pollIntervalMs) && pollIntervalMs > 0
      ? pollIntervalMs
      : 0,
  };
}

function pollRoutines(
  _userId: string,
  options: SubscribeOptions<RoutineRecord>,
  gatewayOptions: BackendGatewayOptions,
  setCache: (routines: RoutineRecord[]) => void,
): () => void {
  let stopped = false;

  const fetchOnce = async () => {
    try {
      const response = await fetch(`${gatewayOptions.baseUrl}/routines`, {
        headers: await authHeaders(),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const json = await response.json() as {
        items: RestRoutine[];
      };
      const routines = json.items.map(convertRoutine);
      setCache(routines);
      options.onData(routines);
    } catch (error) {
      options.onError?.(error);
    }
  };

  fetchOnce();
  const timer = gatewayOptions.pollIntervalMs > 0
    ? setInterval(fetchOnce, gatewayOptions.pollIntervalMs)
    : null;

  return () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearInterval(timer);
  };
}

function pollCompletions(
  _userId: string,
  isoDate: string,
  options: SubscribeOptions<CompletionRecord>,
  gatewayOptions: BackendGatewayOptions,
  getCache: () => RoutineRecord[],
  setCache: (routines: RoutineRecord[]) => void,
): () => void {
  let stopped = false;

  const fetchOnce = async () => {
    try {
      let routines = getCache();

      if (!routines.length) {
        const response = await fetch(
          `${gatewayOptions.baseUrl}/routines?limit=200`,
          { headers: await authHeaders() },
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const json = await response.json() as { items: RestRoutine[] };
        routines = json.items.map(convertRoutine);
        setCache(routines);
      }

      const completions: CompletionRecord[] = [];
      for (const routine of routines) {
        const res = await fetch(
          `${gatewayOptions.baseUrl}/routines/${routine.id}/completions?from=${isoDate}&to=${isoDate}`,
          { headers: await authHeaders() },
        );
        if (!res.ok) {
          if (res.status === 404 || res.status === 400) {
            // routine is gone or invalid; drop from cache to avoid repeated 400s
            setCache(routines.filter((item) => item.id !== routine.id));
            continue;
          }
          throw new Error(await res.text());
        }
        const data = await res.json() as { items: RestCompletion[] };
        completions.push(
          ...data.items.map((item) => ({
            id: item.id,
            routineId: item.routineId,
            userId: item.userId,
            date: item.date,
          })),
        );
      }
      options.onData(completions);
    } catch (error) {
      options.onError?.(error);
    }
  };

  fetchOnce();
  const timer = gatewayOptions.pollIntervalMs > 0
    ? setInterval(fetchOnce, gatewayOptions.pollIntervalMs)
    : null;

  return () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearInterval(timer);
  };
}

async function createRoutine(
  _userId: string,
  input: CreateRoutineInput,
  options: BackendGatewayOptions,
): Promise<string> {
  const response = await fetch(`${options.baseUrl}/routines`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({
      title: input.title,
      schedule: input.schedule,
      autoShare: input.autoShare,
      visibility: input.visibility,
    }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const json = await response.json() as RestRoutine;
  return json.id;
}

async function updateRoutine(
  routineId: string,
  input: UpdateRoutineInput,
  options: BackendGatewayOptions,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.autoShare !== undefined) patch.autoShare = input.autoShare;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.schedule !== undefined) {
    patch.schedule = input.schedule ?? null;
  }
  const response = await fetch(`${options.baseUrl}/routines/${routineId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function setTodayCompletion(
  options: SetCompletionOptions,
  gatewayOptions: BackendGatewayOptions,
): Promise<void> {
  const date = formatIsoDate(options.completedAt);
  if (options.complete) {
    const response = await fetch(
      `${gatewayOptions.baseUrl}/routines/${options.routine.id}/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({ date }),
      },
    );
    if (!response.ok) {
      throw new Error(await response.text());
    }
  } else {
    const response = await fetch(
      `${gatewayOptions.baseUrl}/routines/${options.routine.id}/completions/${date}`,
      {
        method: "DELETE",
        headers: await authHeaders(),
      },
    );
    if (!response.ok) {
      throw new Error(await response.text());
    }
  }
}

async function deleteRoutine(
  routineId: string,
  options: BackendGatewayOptions,
): Promise<void> {
  const response = await fetch(`${options.baseUrl}/routines/${routineId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(await response.text());
  }
}

function convertRoutine(routine: RestRoutine): RoutineRecord {
  return {
    id: routine.id,
    userId: routine.userId,
    title: routine.title,
    description: routine.description ?? null,
    schedule: routine.schedule ?? null,
    autoShare: routine.autoShare,
    visibility: (routine.visibility as RoutineRecord["visibility"]) ??
      "private",
    currentStreak: routine.currentStreak ?? 0,
    maxStreak: routine.maxStreak ?? 0,
    createdAt: routine.createdAt ? new Date(routine.createdAt) : null,
    updatedAt: routine.updatedAt ? new Date(routine.updatedAt) : null,
    deletedAt: routine.deletedAt ? new Date(routine.deletedAt) : null,
  };
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await currentAuthToken();
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

async function currentAuthToken(): Promise<string | null> {
  const useMock = import.meta.env.VITE_USE_MOCK_AUTH === "true";
  if (useMock) {
    return "mock-token";
  }

  const { auth } = await import("../../lib/firebase.ts");
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }
  return await currentUser.getIdToken();
}
