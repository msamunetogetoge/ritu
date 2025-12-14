import type {
  Comment,
  CommentCreateInput,
  Like,
  Post,
  PostCreateInput,
} from "../types.ts";
import {
  decodeValue,
  documentName,
  encodeValue,
  extractDocumentId,
  FirestoreClient,
  type FirestoreDocument,
} from "../lib/firestore-client.ts";

export interface CommunityRepository {
  createPost(userId: string, input: PostCreateInput): Promise<Post>;
  listPosts(limit?: number, startAfter?: string): Promise<Post[]>;
  getPost(postId: string): Promise<Post | null>;
  // Like
  addLike(userId: string, postId: string): Promise<Like | null>;
  removeLike(userId: string, postId: string): Promise<boolean>;
  getLike(userId: string, postId: string): Promise<Like | null>;
  // Comment
  addComment(
    userId: string,
    postId: string,
    input: CommentCreateInput,
  ): Promise<Comment | null>;
  listComments(postId: string): Promise<Comment[]>;
}

export class FirestoreCommunityRepository implements CommunityRepository {
  #client: FirestoreClient;
  #collectionName = "posts"; // SharedPosts

  constructor(options: { client: FirestoreClient }) {
    this.#client = options.client;
  }

  async createPost(userId: string, input: PostCreateInput): Promise<Post> {
    const now = new Date().toISOString();
    const doc = await this.#client.createDocument(
      `${this.#client.projectPath}/documents/${this.#collectionName}`,
      {
        userId: { stringValue: userId },
        routineId: { stringValue: input.routineId },
        text: encodeValue(input.text ?? ""),
        likeCount: { integerValue: "0" },
        commentCount: { integerValue: "0" },
        createdAt: { timestampValue: now },
        updatedAt: { timestampValue: now },
      },
    );
    return this.#toPost(doc);
  }

  async listPosts(limit = 20): Promise<Post[]> {
    const responses = await this.#client.runQuery({
      structuredQuery: {
        from: [{ collectionId: this.#collectionName }],
        orderBy: [{
          field: { fieldPath: "createdAt" },
          direction: "DESCENDING",
        }],
        limit,
      },
    });
    return responses
      .map((entry) => entry.document)
      .filter((doc): doc is FirestoreDocument => Boolean(doc))
      .map((doc) => this.#toPost(doc));
  }

  async getPost(postId: string): Promise<Post | null> {
    try {
      const doc = await this.#client.getDocument(
        documentName(this.#client.projectPath, this.#collectionName, postId),
      );
      return this.#toPost(doc);
    } catch {
      return null;
    }
  }

  async addLike(userId: string, postId: string): Promise<Like | null> {
    const post = await this.getPost(postId);
    if (!post) return null;

    // Use a deterministic ID for Like to prevent duplicates: {userId}_{postId}
    // Spec doesn't strictly say, but standard practice.
    // However, user can only like once.
    // Subcollection "likes". ID = userId seems appropriate if one like per user.
    const likeId = userId;
    const now = new Date().toISOString();

    // Transactional update would be better for counts, but for now simple 2-step.
    // 1. Create Like
    // 2. Increment count (blind write or read-modify-write)

    // Check existence? createDocument with ID will fail if exists.
    try {
      const doc = await this.#client.createDocument(
        documentName(this.#client.projectPath, this.#collectionName, postId) +
          "/likes",
        {
          userId: { stringValue: userId },
          postId: { stringValue: postId },
          createdAt: { timestampValue: now },
        },
        likeId,
      );

      // Increment count
      // Firestore REST API doesn't allow easy increment in patch without mask or explicit transform?
      // `transform` is available in `commit` or `patch` with field transform.
      // FirestoreClient helper `patch` might not support transform easily.
      // I'll skip count increment for MVP or do read-modify-write if I have time.
      // Actually, I can do read-modify-write on Post.
      await this.#incrementPostCount(postId, "likeCount", 1);

      return this.#toLike(doc, postId);
    } catch (_e) {
      // Assuming conflict (already liked)
      // Check if it exists
      const existing = await this.getLike(userId, postId);
      return existing;
    }
  }

  async removeLike(userId: string, postId: string): Promise<boolean> {
    const likeId = userId;
    const path =
      documentName(this.#client.projectPath, this.#collectionName, postId) +
      "/likes/" + likeId;
    try {
      await this.#client.deleteDocument(path);
      await this.#incrementPostCount(postId, "likeCount", -1);
      return true;
    } catch {
      return false;
    }
  }

  async getLike(userId: string, postId: string): Promise<Like | null> {
    const likeId = userId;
    const path =
      documentName(this.#client.projectPath, this.#collectionName, postId) +
      "/likes/" + likeId;
    try {
      const doc = await this.#client.getDocument(path);
      return this.#toLike(doc, postId);
    } catch {
      return null;
    }
  }

  async addComment(
    userId: string,
    postId: string,
    input: CommentCreateInput,
  ): Promise<Comment | null> {
    const post = await this.getPost(postId);
    if (!post) return null;

    const now = new Date().toISOString();
    const doc = await this.#client.createDocument(
      documentName(this.#client.projectPath, this.#collectionName, postId) +
        "/comments",
      {
        userId: { stringValue: userId },
        postId: { stringValue: postId },
        text: encodeValue(input.text),
        createdAt: { timestampValue: now },
      },
    );
    await this.#incrementPostCount(postId, "commentCount", 1);
    return this.#toComment(doc, postId);
  }

  async listComments(postId: string): Promise<Comment[]> {
    const parent = documentName(
      this.#client.projectPath,
      this.#collectionName,
      postId,
    );
    const responses = await this.#client.runQuery({
      structuredQuery: {
        from: [{ collectionId: "comments" }],
        orderBy: [{
          field: { fieldPath: "createdAt" },
          direction: "ASCENDING",
        }],
      },
    }, parent);
    return responses
      .map((entry) => entry.document)
      .filter((doc): doc is FirestoreDocument => Boolean(doc))
      .map((doc) => this.#toComment(doc, postId));
  }

  async #incrementPostCount(
    postId: string,
    field: "likeCount" | "commentCount",
    delta: number,
  ) {
    // Read-Modify-Write
    // Real would use FieldTransform
    const post = await this.getPost(postId);
    if (!post) return;
    const newVal = (post[field] || 0) + delta;
    const path = documentName(
      this.#client.projectPath,
      this.#collectionName,
      postId,
    );

    // encodeValue integer
    const encodedVal = { integerValue: newVal.toString() };

    await this.#client.patchDocument(
      path,
      { [field]: encodedVal },
      [field],
    );
  }

  #toPost(doc: FirestoreDocument): Post {
    const fields = doc.fields ?? {};
    return {
      id: extractDocumentId(doc),
      userId: decodeValue(fields.userId) as string,
      routineId: decodeValue(fields.routineId) as string,
      text: (decodeValue(fields.text) as string) ?? "",
      likeCount: Number(decodeValue(fields.likeCount) ?? 0),
      commentCount: Number(decodeValue(fields.commentCount) ?? 0),
      createdAt: (decodeValue(fields.createdAt) as string) ??
        doc.createTime ?? new Date().toISOString(),
      updatedAt: (decodeValue(fields.updatedAt) as string) ??
        doc.updateTime ?? new Date().toISOString(),
    };
  }

  #toLike(doc: FirestoreDocument, postId: string): Like {
    const fields = doc.fields ?? {};
    return {
      id: extractDocumentId(doc),
      postId,
      userId: decodeValue(fields.userId) as string,
      createdAt: (decodeValue(fields.createdAt) as string) ??
        doc.createTime ?? new Date().toISOString(),
    };
  }

  #toComment(doc: FirestoreDocument, postId: string): Comment {
    const fields = doc.fields ?? {};
    return {
      id: extractDocumentId(doc),
      postId,
      userId: decodeValue(fields.userId) as string,
      text: decodeValue(fields.text) as string,
      createdAt: (decodeValue(fields.createdAt) as string) ??
        doc.createTime ?? new Date().toISOString(),
    };
  }
}
