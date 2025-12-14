import { type JSX, useEffect, useState } from "react";
import {
  addComment,
  type Comment,
  getComments,
  getFeed,
  type Post,
  toggleLike,
} from "../services/community-service.ts";
import { useAuth } from "../context/AuthContext.tsx";

function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false); // Optimistic UI
  const [likes, setLikes] = useState(post.likeCount);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const commentTotal = comments.length > 0 ? comments.length : post.commentCount;

  const handleLike = async () => {
    // Optimistic
    const next = !liked;
    setLiked(next);
    setLikes((prev) => next ? prev + 1 : prev - 1);
    try {
      const res = await toggleLike(post.id);
      // Sync with server result if needed
      setLiked(res.liked);
      // Re-fetch post or adjust count?
      // We don't get count back from toggleLike easily without fetching post.
      // Rely on optimistic or re-fetch feed. For MVP, stick to optimistic.
    } catch {
      // Revert
      setLiked(!next);
      setLikes((prev) => !next ? prev + 1 : prev - 1);
    }
  };

  const loadComments = async () => {
    if (!showComments) {
      const list = await getComments(post.id);
      setComments(list);
    }
    setShowComments(!showComments);
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const c = await addComment(post.id, newComment);
      setComments([...comments, c]);
      setNewComment("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <article className="post-card">
      <div className="post-header">
        <span className="post-user">{post.userId.slice(0, 6)}...</span>
        <span className="post-date">{new Date(post.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="post-content">{post.text}</div>
      <div className="post-actions">
        <button type="button" onClick={handleLike} className={liked ? "liked" : ""}>
          {liked ? "❤️" : "♡"} {likes}
        </button>
        <button type="button" onClick={loadComments}>
          💬 {commentTotal}
        </button>
      </div>
      {showComments && (
        <div className="comments-section">
          <ul>
            {comments.map((c) => (
              <li key={c.id}>
                <small>{c.userId.slice(0, 6)}</small>: {c.text}
              </li>
            ))}
          </ul>
          <form onSubmit={submitComment}>
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="コメント..."
            />
            <button type="submit">送信</button>
          </form>
        </div>
      )}
      <style>
        {`
                .post-card { border: 1px solid #333; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; background: #222; }
                .post-header { font-size: 0.8rem; color: #888; display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
                .post-actions { display: flex; gap: 1rem; margin-top: 1rem; }
                .post-actions button { background: none; border: none; color: white; cursor: pointer; }
                .post-actions button.liked { color: red; }
                .comments-section { margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid #444; }
                .comments-section ul { list-style: none; padding: 0; }
                .comments-section form { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
            `}
      </style>
    </article>
  );
}

export default function Community(): JSX.Element {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    try {
      const list = await getFeed();
      setPosts(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <p>ログインしてください</p>;

  return (
    <div className="main-scroll">
      <h1>コミュニティ</h1>
      {loading ? <p>読み込み中...</p> : (
        <div className="feed">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
          {posts.length === 0 && <p className="muted">まだ投稿がありません。</p>}
        </div>
      )}
    </div>
  );
}
