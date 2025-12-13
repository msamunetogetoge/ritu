import { assertEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { InMemoryCommunityRepository } from "../repositories/in-memory.ts";
import { CommunityService } from "./community-service.ts";

Deno.test("CommunityService createPost adds post to feed", async () => {
    const repository = new InMemoryCommunityRepository();
    const service = new CommunityService({ repository });
    
    const post = await service.createPost("user-1", {
        routineId: "routine-1",
        text: "Did it!"
    });
    
    assertEquals(post.userId, "user-1");
    assertEquals(post.text, "Did it!");
    assertEquals(post.likeCount, 0);
    
    const feed = await service.getFeed("user-2");
    assertEquals(feed.length, 1);
    assertEquals(feed[0].id, post.id);
});

Deno.test("CommunityService toggleLike increments and decrements likes", async () => {
    const repository = new InMemoryCommunityRepository();
    const service = new CommunityService({ repository });
    
    const post = await service.createPost("user-1", { routineId: "r1", text: "Hi" });
    
    // Like
    const res1 = await service.toggleLike("user-2", post.id);
    assert(res1.liked);
    
    // Check feed for updated count (note: InMemoryRepo might need refresh logic check)
    // InMemory implementation usually updates object reference or stored data.
    const feed1 = await service.getFeed("user-1");
    assertEquals(feed1[0].likeCount, 1);
    
    // Unlike
    const res2 = await service.toggleLike("user-2", post.id);
    assert(!res2.liked);
    
    const feed2 = await service.getFeed("user-1");
    assertEquals(feed2[0].likeCount, 0);
});

Deno.test("CommunityService comments flow", async () => {
    const repository = new InMemoryCommunityRepository();
    const service = new CommunityService({ repository });
    
    const post = await service.createPost("user-1", { routineId: "r1", text: "Hi" });
    
    const comment = await service.addComment("user-2", post.id, { text: "Nice!" });
    assertEquals(comment.text, "Nice!");
    assertEquals(comment.userId, "user-2");
    
    const comments = await service.listComments(post.id);
    assertEquals(comments.length, 1);
    assertEquals(comments[0].text, "Nice!");
    
    // Check post comment count
    const feed = await service.getFeed("user-1");
    assertEquals(feed[0].commentCount, 1);
});
