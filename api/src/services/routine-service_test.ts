import { assertEquals } from "https://deno.land/std@0.208.0/assert/assert_equals.ts";
import { InMemoryRoutineRepository } from "../repositories/in-memory.ts";
import { calculateStreaks, RoutineService } from "./routine-service.ts";

Deno.test("calculateStreaks returns zero when no dates", () => {
  const result = calculateStreaks([]);
  assertEquals(result, { current: 0, max: 0 });
});

Deno.test("calculateStreaks handles consecutive streaks ending today", () => {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const dayBefore = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

  const dates = [
    formatDate(dayBefore),
    formatDate(yesterday),
    formatDate(today),
  ];

  const result = calculateStreaks(dates);
  assertEquals(result.current, 3);
  assertEquals(result.max, 3);
});

Deno.test("calculateStreaks handles gaps and trailing streak", () => {
  const dates = ["2024-04-01", "2024-04-02", "2024-04-05", "2024-04-06"];
  const result = calculateStreaks(dates);
  assertEquals(result, { current: 2, max: 2 });
});

Deno.test("RoutineService create and restore flow", async () => {
  const repository = new InMemoryRoutineRepository();
  const service = new RoutineService({ repository });
  const userId = "user-a";

  const created = await service.createRoutine(userId, {
    title: "朝ラン",
    schedule: { type: "daily" },
  });
  assertEquals(created.title, "朝ラン");

  const list = await service.listRoutines(userId, { page: 1, limit: 10 });
  assertEquals(list.items.length, 1);

  await service.deleteRoutine(userId, created.id);
  const restored = await service.restoreRoutine(userId, created.id);
  assertEquals(restored.deletedAt, null);
});

Deno.test("RoutineService completion lifecycle", async () => {
  const repository = new InMemoryRoutineRepository();
  const service = new RoutineService({ repository });
  const userId = "user-b";
  const routine = await service.createRoutine(userId, {
    title: "読書",
    schedule: { type: "daily" },
  });

  const completion = await service.addCompletion(userId, routine.id, {
    date: "2024-05-01",
  });
  assertEquals(completion.date, "2024-05-01");

  const listed = await service.listCompletions(userId, routine.id, {});
  assertEquals(listed.length, 1);

  await service.removeCompletion(userId, routine.id, "2024-05-01");
  const after = await service.listCompletions(userId, routine.id, {});
  assertEquals(after.length, 0);
});

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
