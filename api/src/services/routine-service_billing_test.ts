import { assertEquals, assertRejects } from "@std/assert";
import {
  InMemoryRoutineRepository,
  InMemoryUserRepository,
} from "../repositories/in-memory.ts";
import { RoutineService } from "./routine-service.ts";

Deno.test("RoutineService billing limit", async () => {
  const repository = new InMemoryRoutineRepository();
  const userRepository = new InMemoryUserRepository();
  const service = new RoutineService({ repository, userRepository });
  const userId = "user-c";
  await userRepository.create(userId, {
    displayName: "User C",
    isPremium: false,
    photoUrl: null,
  });

  // Create 2 routines (allowed)
  await service.createRoutine(userId, { title: "One", schedule: {} });
  await service.createRoutine(userId, { title: "Two", schedule: {} });

  // 3rd should fail
  await assertRejects(
    async () => {
      await service.createRoutine(userId, { title: "Three", schedule: {} });
    },
    Error,
    "Free plan limit reached",
  );

  // Upgrade user
  await userRepository.update(userId, { isPremium: true });

  // 3rd should succeed now
  const three = await service.createRoutine(userId, {
    title: "Three",
    schedule: {},
  });
  assertEquals(three.title, "Three");
  assertEquals(three.title, "Three");
});
