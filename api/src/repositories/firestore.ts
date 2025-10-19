import type {
  Completion,
  CompletionCreateInput,
  Paginated,
  Pagination,
  Routine,
  RoutineCreateInput,
  RoutineUpdateInput,
} from "../types.ts";
import type { RoutineRepository } from "./routine-repository.ts";
import {
  decodeValue,
  documentName,
  encodeValue,
  extractDocumentId,
  FirestoreClient,
  type FirestoreDocument,
} from "../lib/firestore-client.ts";

interface FirestoreRoutineRepositoryOptions {
  client: FirestoreClient;
}

const ROUTINE_COLLECTION = "routines";

export class FirestoreRoutineRepository implements RoutineRepository {
  #client: FirestoreClient;

  constructor(options: FirestoreRoutineRepositoryOptions) {
    this.#client = options.client;
  }

  async listByUser(
    userId: string,
    pagination: Pagination,
  ): Promise<Paginated<Routine>> {
    const page = Math.max(1, pagination.page);
    const limit = Math.min(Math.max(1, pagination.limit), 100);
    const offset = (page - 1) * limit;

    const where = {
      compositeFilter: {
        op: "AND",
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: "userId" },
              op: "EQUAL",
              value: { stringValue: userId },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "deletedAt" },
              op: "EQUAL",
              value: { nullValue: null },
            },
          },
        ],
      },
    };

    const [aggregation] = await this.#client.runAggregationQuery({
      structuredAggregationQuery: {
        aggregations: [{
          alias: "total",
          count: {},
        }],
        structuredQuery: {
          from: [{ collectionId: ROUTINE_COLLECTION }],
          where,
        },
      },
    });
    const total = parseInt(
      aggregation?.result?.aggregateFields?.total?.integerValue ?? "0",
      10,
    );

    const responses = await this.#client.runQuery({
      structuredQuery: {
        from: [{ collectionId: ROUTINE_COLLECTION }],
        where,
        orderBy: [
          { field: { fieldPath: "createdAt" }, direction: "DESCENDING" },
        ],
        offset,
        limit,
      },
    });
    const items = responses
      .map((entry) => entry.document)
      .filter((doc): doc is FirestoreDocument => Boolean(doc))
      .map((doc) => this.#toRoutine(doc));

    return { items, page, limit, total };
  }

  async getById(userId: string, routineId: string): Promise<Routine | null> {
    try {
      const doc = await this.#client.getDocument(
        documentName(this.#client.projectPath, ROUTINE_COLLECTION, routineId),
      );
      const routine = this.#toRoutine(doc);
      if (routine.userId !== userId) {
        return null;
      }
      return routine;
    } catch {
      return null;
    }
  }

  async create(userId: string, input: RoutineCreateInput): Promise<Routine> {
    const now = new Date();
    const doc = await this.#client.createDocument(
      `${this.#client.projectPath}/documents/${ROUTINE_COLLECTION}`,
      {
        userId: { stringValue: userId },
        title: { stringValue: input.title },
        description: encodeValue(input.description ?? null),
        schedule: encodeValue(input.schedule ?? {}),
        autoShare: { booleanValue: input.autoShare ?? false },
        visibility: { stringValue: input.visibility ?? "private" },
        currentStreak: { integerValue: "0" },
        maxStreak: { integerValue: "0" },
        createdAt: { timestampValue: now.toISOString() },
        updatedAt: { timestampValue: now.toISOString() },
        deletedAt: { nullValue: null },
      },
    );
    return this.#toRoutine(doc);
  }

  async update(
    userId: string,
    routineId: string,
    input: RoutineUpdateInput,
  ): Promise<Routine | null> {
    const docPath = documentName(
      this.#client.projectPath,
      ROUTINE_COLLECTION,
      routineId,
    );
    const existing = await this.getById(userId, routineId);
    if (!existing) {
      return null;
    }
    const fields: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (input.title !== undefined) fields.title = input.title;
    if (input.description !== undefined) {
      fields.description = input.description ?? null;
    }
    if (input.schedule !== undefined) fields.schedule = input.schedule ?? {};
    if (input.autoShare !== undefined) fields.autoShare = input.autoShare;
    if (input.visibility !== undefined) fields.visibility = input.visibility;
    const mask = Object.keys(fields);
    const encoded: Record<string, ReturnType<typeof encodeValue>> = {};
    for (const [key, value] of Object.entries(fields)) {
      encoded[key] = encodeValue(value);
    }
    const doc = await this.#client.patchDocument(docPath, encoded, mask);
    return this.#toRoutine(doc);
  }

  async updateStreaks(
    userId: string,
    routineId: string,
    streaks: { currentStreak: number; maxStreak: number },
  ): Promise<Routine | null> {
    const existing = await this.getById(userId, routineId);
    if (!existing) {
      return null;
    }
    const docPath = documentName(
      this.#client.projectPath,
      ROUTINE_COLLECTION,
      routineId,
    );
    const now = new Date().toISOString();
    const doc = await this.#client.patchDocument(
      docPath,
      {
        currentStreak: { integerValue: streaks.currentStreak.toString() },
        maxStreak: { integerValue: streaks.maxStreak.toString() },
        updatedAt: { timestampValue: now },
      },
      ["currentStreak", "maxStreak", "updatedAt"],
    );
    return this.#toRoutine(doc);
  }

  async softDelete(
    userId: string,
    routineId: string,
    deletedAt: Date,
  ): Promise<Routine | null> {
    const existing = await this.getById(userId, routineId);
    if (!existing) {
      return null;
    }
    const docPath = documentName(
      this.#client.projectPath,
      ROUTINE_COLLECTION,
      routineId,
    );
    const doc = await this.#client.patchDocument(
      docPath,
      {
        deletedAt: { timestampValue: deletedAt.toISOString() },
        updatedAt: { timestampValue: deletedAt.toISOString() },
      },
      ["deletedAt", "updatedAt"],
    );
    return this.#toRoutine(doc);
  }

  async restore(userId: string, routineId: string): Promise<Routine | null> {
    const existing = await this.getById(userId, routineId);
    if (!existing) {
      return null;
    }
    const now = new Date().toISOString();
    const docPath = documentName(
      this.#client.projectPath,
      ROUTINE_COLLECTION,
      routineId,
    );
    const doc = await this.#client.patchDocument(
      docPath,
      {
        deletedAt: { nullValue: null },
        updatedAt: { timestampValue: now },
      },
      ["deletedAt", "updatedAt"],
    );
    return this.#toRoutine(doc);
  }

  async listCompletions(
    userId: string,
    routineId: string,
    range?: { from?: string; to?: string },
  ): Promise<Completion[]> {
    const routine = await this.getById(userId, routineId);
    if (!routine) {
      return [];
    }
    const parentDoc = documentName(
      this.#client.projectPath,
      ROUTINE_COLLECTION,
      routineId,
    );

    const filters = [
      {
        fieldFilter: {
          field: { fieldPath: "userId" },
          op: "EQUAL",
          value: { stringValue: userId },
        },
      },
    ];

    if (range?.from) {
      filters.push({
        fieldFilter: {
          field: { fieldPath: "date" },
          op: "GREATER_THAN_OR_EQUAL",
          value: { stringValue: range.from },
        },
      });
    }
    if (range?.to) {
      filters.push({
        fieldFilter: {
          field: { fieldPath: "date" },
          op: "LESS_THAN_OR_EQUAL",
          value: { stringValue: range.to },
        },
      });
    }

    const structuredQuery: Record<string, unknown> = {
      from: [{ collectionId: "completions" }],
      orderBy: [{ field: { fieldPath: "date" }, direction: "ASCENDING" }],
    };
    if (filters.length === 1) {
      structuredQuery.where = filters[0];
    } else {
      structuredQuery.where = {
        compositeFilter: {
          op: "AND",
          filters,
        },
      };
    }

    const responses = await this.#client.runQuery({ structuredQuery }, parentDoc);
    return responses
      .map((entry) => entry.document)
      .filter((doc): doc is FirestoreDocument => Boolean(doc))
      .map((doc) => this.#toCompletion(doc, routineId));
  }

  async addCompletion(
    userId: string,
    routineId: string,
    input: CompletionCreateInput,
  ): Promise<Completion | null> {
    const routine = await this.getById(userId, routineId);
    if (!routine) {
      return null;
    }
    const now = new Date().toISOString();
    const doc = await this.#client.patchDocument(
      documentName(
        this.#client.projectPath,
        `${ROUTINE_COLLECTION}/${routineId}/completions`,
        input.date,
      ),
      {
        userId: { stringValue: userId },
        routineId: { stringValue: routineId },
        date: { stringValue: input.date },
        createdAt: { timestampValue: now },
      },
      ["userId", "routineId", "date", "createdAt"],
    );
    return this.#toCompletion(doc, routineId);
  }

  async removeCompletion(
    userId: string,
    routineId: string,
    date: string,
  ): Promise<boolean> {
    const routine = await this.getById(userId, routineId);
    if (!routine) {
      return false;
    }
    try {
      await this.#client.deleteDocument(
        documentName(
          this.#client.projectPath,
          `${ROUTINE_COLLECTION}/${routineId}/completions`,
          date,
        ),
      );
      return true;
    } catch {
      return false;
    }
  }

  #toRoutine(doc: FirestoreDocument): Routine {
    const fields = doc.fields ?? {};
    return {
      id: extractDocumentId(doc),
      userId: decodeValue(fields.userId) as string,
      title: decodeValue(fields.title) as string,
      description: (decodeValue(fields.description) as string | null | undefined) ?? null,
      schedule: (decodeValue(fields.schedule) as Record<string, unknown>) ?? {},
      autoShare: Boolean(decodeValue(fields.autoShare)),
      visibility: (decodeValue(fields.visibility) as Routine["visibility"]) ??
        "private",
      currentStreak: Number(decodeValue(fields.currentStreak) ?? 0),
      maxStreak: Number(decodeValue(fields.maxStreak) ?? 0),
      createdAt: (decodeValue(fields.createdAt) as string) ??
        doc.createTime ?? new Date().toISOString(),
      updatedAt: (decodeValue(fields.updatedAt) as string) ??
        doc.updateTime ?? new Date().toISOString(),
      deletedAt: (decodeValue(fields.deletedAt) as string | null | undefined) ??
        null,
    };
  }

  #toCompletion(doc: FirestoreDocument, routineId: string): Completion {
    const fields = doc.fields ?? {};
    return {
      id: extractDocumentId(doc),
      routineId,
      userId: decodeValue(fields.userId) as string,
      date: decodeValue(fields.date) as string,
      createdAt: (decodeValue(fields.createdAt) as string) ??
        doc.createTime ?? new Date().toISOString(),
    };
  }
}
