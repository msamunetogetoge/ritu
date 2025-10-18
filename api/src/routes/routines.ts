import { Hono } from "hono";
import { validator } from "hono/validator";
import type { RoutineService } from "../services/routine-service.ts";
import type { AppEnv } from "../middlewares/auth.ts";
import type { RoutineCreateInput, RoutineUpdateInput } from "../types.ts";

/* registerRoutineRoutesはRoutineServiceをHTTPエンドポイントへ公開する。 */
export function registerRoutineRoutes(app: Hono<AppEnv>, routineService: RoutineService) {
  app.get("/v1/routines", async (c) => {
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

  app.post(
    "/v1/routines",
    validator("json", (body, c) => {
      if (!body || typeof body !== "object") {
        return c.json({ message: "invalid body" }, 400);
      }
      return body as RoutineCreateInput;
    }),
    async (c) => {
      const userId = c.get("userId");
      const input = c.req.valid("json");
      const created = await routineService.createRoutine(userId, input);
      return c.json(created, 201);
    },
  );

  app.get("/v1/routines/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const routine = await routineService.getRoutine(userId, id);
    return c.json(routine);
  });

  app.patch(
    "/v1/routines/:id",
    validator("json", (body, c) => {
      if (!body || typeof body !== "object") {
        return c.json({ message: "invalid body" }, 400);
      }
      return body as RoutineUpdateInput;
    }),
    async (c) => {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const input = c.req.valid("json");
      const updated = await routineService.updateRoutine(userId, id, input);
      return c.json(updated);
    },
  );

  app.delete("/v1/routines/:id", async (c) => {
    const userId = c.get("userId");
    await routineService.deleteRoutine(userId, c.req.param("id"));
    return c.body(null, 204);
  });

  app.post("/v1/routines/:id/restore", async (c) => {
    const userId = c.get("userId");
    const restored = await routineService.restoreRoutine(userId, c.req.param("id"));
    return c.json(restored);
  });

  app.get("/v1/routines/:id/completions", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const { from, to } = c.req.query();
    const items = await routineService.listCompletions(userId, id, { from, to });
    return c.json({ items });
  });

  app.post(
    "/v1/routines/:id/completions",
    validator("json", (body, c) => {
      if (!body || typeof body !== "object") {
        return c.json({ message: "invalid body" }, 400);
      }
      if (!("date" in body)) {
        return c.json({ message: "date is required" }, 400);
      }
      return body as { date: string };
    }),
    async (c) => {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const completion = await routineService.addCompletion(userId, id, c.req.valid("json"));
      return c.json(completion, 201);
    },
  );

  app.delete("/v1/routines/:id/completions/:date", async (c) => {
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
