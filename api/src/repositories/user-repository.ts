import type { User, UserUpdateInput } from "../types.ts";
import {
  decodeValue,
  documentName,
  encodeValue,
  extractDocumentId,
  FirestoreClient,
  type FirestoreDocument,
} from "../lib/firestore-client.ts";

export interface UserRepository {
  getById(id: string): Promise<User | null>;
  create(id: string, data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;
  update(id: string, data: UserUpdateInput): Promise<User | null>;
}

export class FirestoreUserRepository implements UserRepository {
  #client: FirestoreClient;
  #collectionName = "users";

  constructor(options: { client: FirestoreClient }) {
    this.#client = options.client;
  }

  async getById(id: string): Promise<User | null> {
    try {
      const doc = await this.#client.getDocument(
        documentName(this.#client.projectPath, this.#collectionName, id),
      );
      return this.#toUser(doc);
    } catch {
      return null;
    }
  }

  async create(id: string, data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const now = new Date().toISOString();
    // Use createDocument with documentId query param to set custom ID (auth userId)
    const doc = await this.#client.createDocument(
      `${this.#client.projectPath}/documents/${this.#collectionName}`,
      {
        displayName: { stringValue: data.displayName },
        photoUrl: encodeValue(data.photoUrl),
        createdAt: { timestampValue: now },
        updatedAt: { timestampValue: now },
      },
      id 
    );
    return this.#toUser(doc);
  }

  async update(id: string, data: UserUpdateInput): Promise<User | null> {
    const docPath = documentName(
      this.#client.projectPath,
      this.#collectionName,
      id,
    );
    
    // Check existence first? Or let patch fail if not found?
    // Firestore patch creates if not exists unless we use preconditions, but usually we want to update existing.
    // However, for user profile sometimes we might want upsert?
    // The interface implies "update", so let's stick to update logic.
    // If we want implicit creation on first login, that's business logic.
    
    const fields: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (data.displayName !== undefined) fields.displayName = data.displayName;
    if (data.photoUrl !== undefined) fields.photoUrl = data.photoUrl;

    const mask = Object.keys(fields);
    const encoded: Record<string, ReturnType<typeof encodeValue>> = {};
    for (const [key, value] of Object.entries(fields)) {
      encoded[key] = encodeValue(value);
    }

    try {
      const doc = await this.#client.patchDocument(docPath, encoded, mask);
      return this.#toUser(doc);
    } catch {
        return null; // Assume not found or error
    }
  }

  #toUser(doc: FirestoreDocument): User {
    const fields = doc.fields ?? {};
    return {
      id: extractDocumentId(doc),
      displayName: decodeValue(fields.displayName) as string,
      photoUrl: (decodeValue(fields.photoUrl) as string | null | undefined) ?? null,
      createdAt: (decodeValue(fields.createdAt) as string) ??
        doc.createTime ?? new Date().toISOString(),
      updatedAt: (decodeValue(fields.updatedAt) as string) ??
        doc.updateTime ?? new Date().toISOString(),
    };
  }
}
