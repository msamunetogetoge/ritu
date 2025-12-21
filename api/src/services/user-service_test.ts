import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { InMemoryUserRepository } from "../repositories/in-memory.ts";
import { UserService } from "./user-service.ts";

Deno.test("UserService getMe throws if user not found", async () => {
  const repository = new InMemoryUserRepository();
  const service = new UserService({ repository });
  await assertRejects(
    async () => await service.getMe("non-existent"),
    Error,
    "user profile not found",
  );
});

Deno.test("UserService updateMe creates user if not exists", async () => {
  const repository = new InMemoryUserRepository();
  const service = new UserService({ repository });
  const userId = "new-user";

  const updated = await service.updateMe(userId, {
    displayName: "New User",
    photoUrl: "http://example.com/photo.jpg",
  });

  assertEquals(updated.id, userId);
  assertEquals(updated.displayName, "New User");

  const fetched = await service.getMe(userId);
  assertEquals(fetched, updated);
});

Deno.test("UserService updateMe updates existing user", async () => {
  const repository = new InMemoryUserRepository();
  const service = new UserService({ repository });
  const userId = "existing-user";

  await service.updateMe(userId, { displayName: "Old Name" });
  const updated = await service.updateMe(userId, { displayName: "New Name" });

  assertEquals(updated.displayName, "New Name");
});

Deno.test("UserService linkLineUserId creates user if not exists", async () => {
  const repository = new InMemoryUserRepository();
  const service = new UserService({ repository });
  const userId = "line-user-create";

  const linked = await service.linkLineUserId(userId, "U-line-id");

  assertEquals(linked.id, userId);
  assertEquals(linked.displayName, "LINE User");
  assertEquals(linked.photoUrl, null);
  assertEquals(linked.notificationSettings?.lineUserId, "U-line-id");
  assertEquals(linked.notificationSettings?.lineEnabled, true);
});

Deno.test("UserService linkLineUserId stores id and keeps existing settings", async () => {
  const repository = new InMemoryUserRepository();
  const service = new UserService({ repository });
  const userId = "line-user";

  await service.updateMe(userId, {
    displayName: "Line User",
    notificationSettings: {
      emailEnabled: true,
      lineEnabled: false,
      scheduleTime: "09:00",
    },
  });

  const linked = await service.linkLineUserId(userId, "U-line-id", {
    code: "code-123",
    state: "state-456",
    liffClientId: "liff-789",
    liffRedirectUri: "http://localhost:5173/settings/notifications",
  });

  assertEquals(linked.notificationSettings?.lineUserId, "U-line-id");
  assertEquals(linked.notificationSettings?.lineEnabled, true);
  assertEquals(linked.notificationSettings?.emailEnabled, true);
  assertEquals(linked.notificationSettings?.scheduleTime, "09:00");
  assertEquals(linked.notificationSettings?.lineLoginContext?.code, "code-123");
});
