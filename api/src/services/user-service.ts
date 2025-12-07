import type { User, UserUpdateInput } from "../types.ts";
import type { UserRepository } from "../repositories/user-repository.ts";
import { notFound, validationError } from "./errors.ts";

export interface UserServiceOptions {
  repository: UserRepository;
}

export class UserService {
  #repository: UserRepository;

  constructor(options: UserServiceOptions) {
    this.#repository = options.repository;
  }

  async getMe(userId: string): Promise<User> {
    const user = await this.#repository.getById(userId);
    if (!user) {
      // For a "getMe", if user doesn't exist yet but has token, maybe we return null or create provisional?
      // Spec says "get profile". If not found, it's 404 or maybe 200 with empty?
      // Usually auth user should have a profile created on signup or first login.
      // If we don't have auto-creation trigger, we might throw 404.
      // But let's assume we might need to handle "not found" gracefully or let FE handle it.
      // For now, throw NotFound.
      throw notFound("user profile not found");
    }
    return user;
  }

  async updateMe(userId: string, input: UserUpdateInput): Promise<User> {
    if (input.displayName !== undefined && input.displayName.trim().length === 0) {
      throw validationError("display name must not be empty");
    }

    const existing = await this.#repository.getById(userId);
    if (!existing) {
      // Create if not exists (upsert)
      // We need mandatory fields for creation. "displayName" is required.
      if (!input.displayName) {
         throw notFound("user profile not found and display name required for creation");
      }
      return this.#repository.create(userId, {
        displayName: input.displayName,
        photoUrl: input.photoUrl ?? null,
      });
    }

    const updated = await this.#repository.update(userId, {
      ...input,
      displayName: input.displayName?.trim(),
    });
    
    if (!updated) {
       throw notFound("user profile update failed"); // Should not happen if we checked existing
    }
    return updated;
  }
}
