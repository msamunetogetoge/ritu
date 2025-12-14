import { type Context, Hono } from "hono";
import { validator } from "hono/validator";
import type { AppEnv } from "../middlewares/auth.ts";
import type { CommunityService } from "../services/community-service.ts";
import type { CommentCreateInput, PostCreateInput } from "../types.ts";

export function registerCommunityRoutes(app: Hono<AppEnv>, service: CommunityService) {
  app.get("/v1/feed", async (c: Context<AppEnv>) => {
    const userId = c.get("userId");
    const posts = await service.getFeed(userId);
    return c.json({ items: posts }); // Wrap in items for consistency? Or just array. Spec said "items, page...". sticking to simple array for feed now or Paginated.
    // Spec: "List endpoints return { items, page... }"
    // Feed currently returns Post[]. I should probably wrap it.
    // For now: items: posts.
  });

  app.post(
    "/v1/posts",
    validator("json", (body: unknown, c: Context<AppEnv>) => {
      if (!body || typeof body !== "object") {
        return c.json({ message: "invalid body" }, 400);
      }
      const payload = body as Partial<PostCreateInput>;
      if (!payload.routineId || typeof payload.routineId !== "string") {
        return c.json({ message: "routineId is required" }, 400);
      }
      if (payload.text !== undefined && typeof payload.text !== "string") {
        return c.json({ message: "text must be string" }, 400);
      }
      return payload as PostCreateInput;
    }),
    async (c: Context<AppEnv, any, { out: { json: PostCreateInput } }>) => {
      const userId = c.get("userId");
      const body = c.req.valid("json");
      const post = await service.createPost(userId, body);
      return c.json(post);
    },
  );

  // Like (Toggle)
  app.post("/v1/posts/:postId/likes", async (c: Context<AppEnv>) => {
    const userId = c.get("userId");
    const postId = c.req.param("postId");
    const result = await service.toggleLike(userId, postId);
    return c.json(result);
  });

  // Comments
  app.get("/v1/posts/:postId/comments", async (c: Context<AppEnv>) => {
    const postId = c.req.param("postId");
    const comments = await service.listComments(postId);
    return c.json({ items: comments });
  });

  app.post(
    "/v1/posts/:postId/comments",
    validator("json", (body: unknown, c: Context<AppEnv>) => {
      if (!body || typeof body !== "object") {
        return c.json({ message: "invalid body" }, 400);
      }
      const payload = body as Partial<CommentCreateInput>;
      if (!payload.text || typeof payload.text !== "string" || payload.text.trim().length === 0) {
        return c.json({ message: "text is required" }, 400);
      }
      return payload as CommentCreateInput;
    }),
    async (c: Context<AppEnv, any, { out: { json: CommentCreateInput } }>) => {
      const userId = c.get("userId");
      const postId = c.req.param("postId");
      const body = c.req.valid("json");
      const comment = await service.addComment(userId, postId, body);
      return c.json(comment);
    },
  );
}
