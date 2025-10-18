import { assertEquals } from "https://deno.land/std@0.208.0/assert/assert_equals.ts";
import { createApp } from "../app.ts";
import { InMemoryRoutineRepository } from "../repositories/in-memory.ts";
import { RoutineService } from "../services/routine-service.ts";

function createTestApp() {
  const repository = new InMemoryRoutineRepository();
  const routineService = new RoutineService({ repository });
  const app = createApp({ routineService });
  return { app, repository };
}

const headers = {
  Authorization: "Bearer test-user",
};

Deno.test("POST /v1/routines creates routine", async () => {
  const { app } = createTestApp();
  const response = await app.request("/v1/routines", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "ストレッチ", schedule: { type: "daily" } }),
  });
  assertEquals(response.status, 201);
  const body = await response.json();
  assertEquals(body.title, "ストレッチ");
});

Deno.test("GET /v1/routines lists routines", async () => {
  const { app } = createTestApp();
  await app.request("/v1/routines", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "散歩", schedule: { type: "daily" } }),
  });
  const response = await app.request("/v1/routines", { headers });
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(Array.isArray(body.items), true);
  assertEquals(body.items.length, 1);
});

Deno.test("PATCH /v1/routines/:id updates routine", async () => {
  const { app } = createTestApp();
  const create = await app.request("/v1/routines", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "筋トレ", schedule: { type: "daily" } }),
  });
  const created = await create.json();
  const response = await app.request(`/v1/routines/${created.id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "夜筋トレ" }),
  });
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.title, "夜筋トレ");
});

Deno.test("completion lifecycle endpoints", async () => {
  const { app } = createTestApp();
  const create = await app.request("/v1/routines", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "瞑想", schedule: { type: "daily" } }),
  });
  const routine = await create.json();

  const postCompletion = await app.request(`/v1/routines/${routine.id}/completions`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ date: "2024-05-01" }),
  });
  assertEquals(postCompletion.status, 201);

  const getCompletion = await app.request(`/v1/routines/${routine.id}/completions`, {
    method: "GET",
    headers,
  });
  const completionList = await getCompletion.json();
  assertEquals(completionList.items.length, 1);

  const deleteCompletion = await app.request(
    `/v1/routines/${routine.id}/completions/2024-05-01`,
    {
      method: "DELETE",
      headers,
    },
  );
  assertEquals(deleteCompletion.status, 204);
});
