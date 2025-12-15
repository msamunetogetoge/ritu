import { Hono, type Context } from "hono";
import { validator } from "hono/validator";
import type { RoutineService } from "../services/routine-service.ts";
import type { AppEnv } from "../middlewares/auth.ts";
import type {
  CompletionCreateInput,
  RoutineCreateInput,
  RoutineUpdateInput,
} from "../types.ts";

/* registerRoutineRoutesはRoutineServiceをHTTPエンドポイントへ公開する。 */
export function registerRoutineRoutes(
  app: Hono<AppEnv>,
  routineService: RoutineService,
) {
  /**
   * GET /v1/routines
   * Lists routines for the authenticated user.
   * Query: ?page=1&limit=20
   */
  app.get("/v1/routines", async (c: Context<AppEnv>) => {
    const userId = c.get("userId");
    const page = parsePositiveInteger(c.req.query("page"), 1);
    const limit = parsePositiveInteger(c.req.query("limit"), 20, 100);
    const result = await routineService.listRoutines(userId, { page, limit });
    return c.json({
      items: result.items,
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  });

  /**
   * POST /v1/routines
   * Creates a new routine.
   * Body: RoutineCreateInput
   */
  app.post(
    "/v1/routines",
    validator("json", (body: unknown, c: Context<AppEnv>) => {
      if (!body || typeof body !== "object") {
        return c.json({ message: "invalid body" }, 400);
      }
      return body as RoutineCreateInput;
    }),
    async (c: Context<AppEnv, any, { out: { json: RoutineCreateInput } }>) => {
      const userId = c.get("userId");
      const input = c.req.valid("json");
      const created = await routineService.createRoutine(userId, input);
      return c.json(created, 201);
    },
  );

  /**
   * GET /v1/routines/:id
   * Gets details of a specific routine.
   */
  app.get("/v1/routines/:id", async (c: Context<AppEnv>) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const routine = await routineService.getRoutine(userId, id);
    return c.json(routine);
  });

  /**
   * PATCH /v1/routines/:id
   * Updates an existing routine.
   * Body: RoutineUpdateInput
   */
  app.patch(
    "/v1/routines/:id",
    validator("json", (body: unknown, c: Context<AppEnv>) => {
      if (!body || typeof body !== "object") {
        return c.json({ message: "invalid body" }, 400);
      }
      return body as RoutineUpdateInput;
    }),
    async (c: Context<AppEnv, any, { out: { json: RoutineUpdateInput } }>) => {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const input = c.req.valid("json");
      const updated = await routineService.updateRoutine(userId, id, input);
      return c.json(updated);
    },
  );

  /**
   * DELETE /v1/routines/:id
   * Soft-deletes a routine.
   */
  app.delete("/v1/routines/:id", async (c: Context<AppEnv>) => {
    const userId = c.get("userId");
    await routineService.deleteRoutine(userId, c.req.param("id"));
    return c.body(null, 204);
  });

  /**
   * POST /v1/routines/:id/restore
   * Restores a soft-deleted routine.
   */
  app.post("/v1/routines/:id/restore", async (c: Context<AppEnv>) => {
    const userId = c.get("userId");
    const restored = await routineService.restoreRoutine(
      userId,
      c.req.param("id"),
    );
    return c.json(restored);
  });

  /**
   * GET /v1/routines/:id/completions
   * Lists completions (history) for a routine.
   * Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  app.get("/v1/routines/:id/completions", async (c: Context<AppEnv>) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const { from, to } = c.req.query();
    const items = await routineService.listCompletions(userId, id, {
      from,
      to,
    });
    return c.json({ items });
  });

  /**
   * POST /v1/routines/:id/completions
   * Marks a routine as completed for a specific date.
   * Body: { date: "YYYY-MM-DD" }
   */
  app.post(
    "/v1/routines/:id/completions",
    validator("json", (body: unknown, c: Context<AppEnv>) => {
      if (!body || typeof body !== "object") {
        return c.json({ message: "invalid body" }, 400);
      }
      if (!("date" in body)) {
        return c.json({ message: "date is required" }, 400);
      }
      return body as { date: string };
    }),
    async (c: Context<AppEnv, any, { out: { json: CompletionCreateInput } }>) => {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const completion = await routineService.addCompletion(
        userId,
        id,
        c.req.valid("json"),
      );
      return c.json(completion, 201);
    },
  );

  /**
   * DELETE /v1/routines/:id/completions/:date
   * Removes a completion for a specific date (un-check).
   */
  app.delete("/v1/routines/:id/completions/:date", async (c: Context<AppEnv>) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const date = c.req.param("date");
    await routineService.removeCompletion(userId, id, date);
    return c.body(null, 204);
  });
}

function parsePositiveInteger(
  value: string | undefined,
  defaultValue: number,
  maxValue?: number,
): number {
  /* UIからの不正値を握りつぶして安全なデフォルトに戻す。 */
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  if (maxValue && parsed > maxValue) {
    return maxValue;
  }
  return parsed;
}
