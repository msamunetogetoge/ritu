import { fetchWithAuth } from "./api-client.ts";

export interface Post {
  id: string;
  userId: string;
  routineId: string;
  text: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Like {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
}

export async function getFeed(): Promise<Post[]> {
  const response = await fetchWithAuth("/feed");
  if (!response.ok) throw new Error(await response.text());
  const json = await response.json() as { items: Post[] };
  return json.items;
}

export async function createPost(routineId: string, text?: string): Promise<Post> {
  const response = await fetchWithAuth("/posts", {
    method: "POST",
    body: JSON.stringify({ routineId, text }),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as Post;
}

export async function toggleLike(postId: string): Promise<{ liked: boolean; like?: Like }> {
  const response = await fetchWithAuth(`/posts/${postId}/likes`, {
    method: "POST",
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as { liked: boolean; like?: Like };
}

export async function getComments(postId: string): Promise<Comment[]> {
  const response = await fetchWithAuth(`/posts/${postId}/comments`);
  if (!response.ok) throw new Error(await response.text());
  const json = await response.json() as { items: Comment[] };
  return json.items;
}

export async function addComment(postId: string, text: string): Promise<Comment> {
  const response = await fetchWithAuth(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as Comment;
}
