import type { Comment, CommentCreateInput, Like, Post, PostCreateInput } from "../types.ts";
import type { CommunityRepository } from "../repositories/community-repository.ts";
import { notFound, validationError } from "./errors.ts";

export interface CommunityServiceOptions {
  repository: CommunityRepository;
}

export class CommunityService {
  #repository: CommunityRepository;

  constructor(options: CommunityServiceOptions) {
    this.#repository = options.repository;
  }

  async createPost(userId: string, input: PostCreateInput): Promise<Post> {
    if (!input.routineId) {
      throw validationError("routineId is required");
    }
    return this.#repository.createPost(userId, input);
  }

  async getFeed(userId: string): Promise<Post[]> {
    // For now, simple global feed. Future: personalize.
    return this.#repository.listPosts(50);
  }

  async toggleLike(userId: string, postId: string): Promise<{ liked: boolean; like?: Like }> {
     const existing = await this.#repository.getLike(userId, postId);
     if (existing) {
       await this.#repository.removeLike(userId, postId);
       return { liked: false };
     } else {
       const like = await this.#repository.addLike(userId, postId);
       if (!like) throw notFound("post not found");
       return { liked: true, like };
     }
  }

  async addComment(userId: string, postId: string, input: CommentCreateInput): Promise<Comment> {
    if (!input.text || input.text.trim().length === 0) {
      throw validationError("comment text required");
    }
    const comment = await this.#repository.addComment(userId, postId, input);
    if (!comment) throw notFound("post not found");
    return comment;
  }
  
  async listComments(postId: string): Promise<Comment[]> {
    return this.#repository.listComments(postId);
  }
}
