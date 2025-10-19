import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { documentName, FirestoreClient } from "../lib/firestore-client.ts";
import { FirestoreRoutineRepository } from "./firestore.ts";

const emulatorHost = Deno.env.get("FIRESTORE_EMULATOR_HOST");
const projectId = Deno.env.get("FIRESTORE_PROJECT_ID") ??
  Deno.env.get("GOOGLE_CLOUD_PROJECT");

Deno.test({
  name: "FirestoreRoutineRepository works with Firestore emulator",
  ignore: !emulatorHost || !projectId,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    if (!emulatorHost || !projectId) {
      throw new Error("Emulator host or projectId missing.");
    }
    const client = new FirestoreClient({
      projectId,
      emulatorHost,
    });
    const repository = new FirestoreRoutineRepository({ client });
    const userId = `ut-${crypto.randomUUID()}`;
    const routine = await repository.create(userId, {
      title: "朝ラン",
      schedule: { type: "daily" },
      autoShare: false,
      visibility: "private",
    });

    const cleanupPath: string | null = documentName(
      client.projectPath,
      "routines",
      routine.id,
    );

    try {
      assertExists(routine.id);
      assertEquals(routine.userId, userId);

      const fetched = await repository.getById(userId, routine.id);
      assertExists(fetched);
      assertEquals(fetched.title, "朝ラン");

      const listed = await repository.listByUser(userId, {
        page: 1,
        limit: 10,
      });
      assertEquals(listed.items.length, 1);
      assertEquals(listed.total, 1);

      const updated = await repository.update(userId, routine.id, {
        title: "朝ランニング",
      });
      assertExists(updated);
      assertEquals(updated.title, "朝ランニング");

      const completion = await repository.addCompletion(userId, routine.id, {
        date: "2024-05-01",
      });
      assertExists(completion);

      const completions = await repository.listCompletions(
        userId,
        routine.id,
        {},
      );
      assertEquals(completions.length, 1);

      const removed = await repository.removeCompletion(
        userId,
        routine.id,
        "2024-05-01",
      );
      assertEquals(removed, true);

      const completionsAfter = await repository.listCompletions(
        userId,
        routine.id,
        {},
      );
      assertEquals(completionsAfter.length, 0);

      const deleted = await repository.softDelete(
        userId,
        routine.id,
        new Date(),
      );
      assertExists(deleted?.deletedAt);

      const listedAfterDelete = await repository.listByUser(userId, {
        page: 1,
        limit: 10,
      });
      assertEquals(listedAfterDelete.items.length, 0);

      const restored = await repository.restore(userId, routine.id);
      assertExists(restored);
      assertEquals(restored.deletedAt, null);
    } finally {
      if (cleanupPath) {
        try {
          await client.deleteDocument(cleanupPath);
        } catch {
          // ignore
        }
      }
    }
  },
});
