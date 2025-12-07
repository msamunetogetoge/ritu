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

interface StoredRoutine extends Routine {
  completions: Map<string, Completion>;
}

/* インメモリ実装はテスト用スタブであり、Firestore実装と同じインターフェースを提供する。 */
export class InMemoryRoutineRepository implements RoutineRepository {
  #routines = new Map<string, StoredRoutine>();

  listByUser(
    userId: string,
    pagination: Pagination,
  ): Promise<Paginated<Routine>> {
    const page = Math.max(1, pagination.page);
    const limit = Math.min(Math.max(1, pagination.limit), 100);
    const all = Array.from(this.#routines.values())
      .filter((routine) =>
        routine.userId === userId && routine.deletedAt === null
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const start = (page - 1) * limit;
    const items = all.slice(start, start + limit).map((routine) => ({
      ...routine,
    }));
    return Promise.resolve({
      items,
      page,
      limit,
      total: all.length,
    });
  }

  getById(userId: string, routineId: string): Promise<Routine | null> {
    const routine = this.#routines.get(routineId);
    if (!routine || routine.userId !== userId) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ ...routine });
  }

  create(userId: string, input: RoutineCreateInput): Promise<Routine> {
    const now = new Date();
    const routine: StoredRoutine = {
      id: crypto.randomUUID(),
      userId,
      title: input.title,
      description: input.description ?? null,
      schedule: input.schedule ?? {},
      autoShare: input.autoShare ?? false,
      visibility: input.visibility ?? "private",
      currentStreak: 0,
      maxStreak: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deletedAt: null,
      completions: new Map(),
    };
    this.#routines.set(routine.id, routine);
    return Promise.resolve({ ...routine });
  }

  update(
    userId: string,
    routineId: string,
    input: RoutineUpdateInput,
  ): Promise<Routine | null> {
    const routine = this.#routines.get(routineId);
    if (!routine || routine.userId !== userId) {
      return Promise.resolve(null);
    }
    if (input.title !== undefined) routine.title = input.title;
    if (input.description !== undefined) {
      routine.description = input.description ?? null;
    }
    if (input.schedule !== undefined) routine.schedule = input.schedule ?? {};
    if (input.autoShare !== undefined) routine.autoShare = input.autoShare;
    if (input.visibility !== undefined) routine.visibility = input.visibility;
    routine.updatedAt = new Date().toISOString();
    this.#routines.set(routine.id, routine);
    return Promise.resolve({ ...routine });
  }

  updateStreaks(
    userId: string,
    routineId: string,
    streaks: { currentStreak: number; maxStreak: number },
  ): Promise<Routine | null> {
    const routine = this.#routines.get(routineId);
    if (!routine || routine.userId !== userId) {
      return Promise.resolve(null);
    }
    routine.currentStreak = streaks.currentStreak;
    routine.maxStreak = streaks.maxStreak;
    routine.updatedAt = new Date().toISOString();
    this.#routines.set(routine.id, routine);
    return Promise.resolve({ ...routine });
  }

  softDelete(
    userId: string,
    routineId: string,
    deletedAt: Date,
  ): Promise<Routine | null> {
    const routine = this.#routines.get(routineId);
    if (!routine || routine.userId !== userId) {
      return Promise.resolve(null);
    }
    routine.deletedAt = deletedAt.toISOString();
    routine.updatedAt = routine.deletedAt;
    this.#routines.set(routine.id, routine);
    return Promise.resolve({ ...routine });
  }

  restore(userId: string, routineId: string): Promise<Routine | null> {
    const routine = this.#routines.get(routineId);
    if (!routine || routine.userId !== userId) {
      return Promise.resolve(null);
    }
    routine.deletedAt = null;
    routine.updatedAt = new Date().toISOString();
    this.#routines.set(routine.id, routine);
    return Promise.resolve({ ...routine });
  }

  listCompletions(
    userId: string,
    routineId: string,
    range?: { from?: string; to?: string },
  ): Promise<Completion[]> {
    const routine = this.#routines.get(routineId);
    if (!routine || routine.userId !== userId) {
      return Promise.resolve([]);
    }
    const from = range?.from ? new Date(range.from) : undefined;
    const to = range?.to ? new Date(range.to) : undefined;
    const items = Array.from(routine.completions.values())
      .filter((completion) => {
        const date = new Date(completion.date);
        if (Number.isNaN(date.getTime())) return false;
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((completion) => ({ ...completion }));
    return Promise.resolve(items);
  }

  addCompletion(
    userId: string,
    routineId: string,
    input: CompletionCreateInput,
  ): Promise<Completion | null> {
    const routine = this.#routines.get(routineId);
    if (!routine || routine.userId !== userId) {
      return Promise.resolve(null);
    }
    const key = input.date;
    let completion = routine.completions.get(key);
    if (!completion) {
      const now = new Date();
      completion = {
        id: crypto.randomUUID(),
        routineId,
        userId,
        date: input.date,
        createdAt: now.toISOString(),
      };
      routine.completions.set(key, completion);
    }
    routine.updatedAt = new Date().toISOString();
    this.#routines.set(routine.id, routine);
    return Promise.resolve({ ...completion });
  }

  removeCompletion(
    userId: string,
    routineId: string,
    date: string,
  ): Promise<boolean> {
    const routine = this.#routines.get(routineId);
    if (!routine || routine.userId !== userId) {
      return Promise.resolve(false);
    }
    const removed = routine.completions.delete(date);
    if (removed) {
      routine.updatedAt = new Date().toISOString();
      this.#routines.set(routine.id, routine);
    }
    return Promise.resolve(removed);
  }

  setRoutine(routine: Routine) {
    const stored: StoredRoutine = { ...routine, completions: new Map() };
    this.#routines.set(routine.id, stored);
  }

  reset() {
    this.#routines.clear();
  }
}

import type { User, UserUpdateInput } from "../types.ts";
import type { UserRepository } from "./user-repository.ts";

export class InMemoryUserRepository implements UserRepository {
  #users = new Map<string, User>();

  getById(id: string): Promise<User | null> {
    const user = this.#users.get(id);
    return Promise.resolve(user ? { ...user } : null);
  }

  create(id: string, data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.#users.set(id, user);
    return Promise.resolve({ ...user });
  }

  update(id: string, data: UserUpdateInput): Promise<User | null> {
    const user = this.#users.get(id);
    if (!user) return Promise.resolve(null);

    if (data.displayName !== undefined) user.displayName = data.displayName;
    if (data.photoUrl !== undefined) user.photoUrl = data.photoUrl;
    
    user.updatedAt = new Date().toISOString();
    this.#users.set(id, user);
    return Promise.resolve({ ...user });
  }
  
  reset() {
    this.#users.clear();
  }
}

import type { Comment, CommentCreateInput, Like, Post, PostCreateInput } from "../types.ts";
import type { CommunityRepository } from "./community-repository.ts";

export class InMemoryCommunityRepository implements CommunityRepository {
  #posts = new Map<string, Post>();
  #likes = new Map<string, Like>(); // Key: userId_postId
  #comments = new Map<string, Comment>();

  createPost(userId: string, input: PostCreateInput): Promise<Post> {
    const now = new Date().toISOString();
    const post: Post = {
      id: crypto.randomUUID(),
      userId,
      routineId: input.routineId,
      text: input.text ?? "",
      likeCount: 0,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.#posts.set(post.id, post);
    return Promise.resolve({ ...post });
  }

  listPosts(limit = 20): Promise<Post[]> {
    const all = Array.from(this.#posts.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.resolve(all.slice(0, limit));
  }

  getPost(postId: string): Promise<Post | null> {
    const post = this.#posts.get(postId);
    return Promise.resolve(post ? { ...post } : null);
  }

  addLike(userId: string, postId: string): Promise<Like | null> {
    const post = this.#posts.get(postId);
    if (!post) return Promise.resolve(null);
    
    const id = `${userId}_${postId}`;
    if (this.#likes.has(id)) {
      return Promise.resolve({ ...this.#likes.get(id)! });
    }
    
    const now = new Date().toISOString();
    const like: Like = {
      id: userId, // Match Firestore implementation (id is userId in subcol)
      // But in flat map I need unique key.
      postId,
      userId,
      createdAt: now,
    };
    this.#likes.set(id, like);
    
    post.likeCount++;
    this.#posts.set(postId, post);
    
    return Promise.resolve({ ...like });
  }

  removeLike(userId: string, postId: string): Promise<boolean> {
    const id = `${userId}_${postId}`;
    const post = this.#posts.get(postId);
    if (this.#likes.delete(id)) {
      if (post) {
        post.likeCount--;
        this.#posts.set(postId, post);
      }
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  getLike(userId: string, postId: string): Promise<Like | null> {
    const id = `${userId}_${postId}`;
    const like = this.#likes.get(id);
    return Promise.resolve(like ? { ...like } : null);
  }

  addComment(userId: string, postId: string, input: CommentCreateInput): Promise<Comment | null> {
    const post = this.#posts.get(postId);
    if (!post) return Promise.resolve(null);

    const now = new Date().toISOString();
    const comment: Comment = {
      id: crypto.randomUUID(),
      postId,
      userId,
      text: input.text,
      createdAt: now,
    };
    this.#comments.set(comment.id, comment);
    
    post.commentCount++;
    this.#posts.set(postId, post);

    return Promise.resolve({ ...comment });
  }

  listComments(postId: string): Promise<Comment[]> {
    const all = Array.from(this.#comments.values())
      .filter((c) => c.postId === postId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return Promise.resolve(all);
  }
}
