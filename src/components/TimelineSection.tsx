import { FormEvent, useEffect, useState } from "react";
import type { Post, UserProfile } from "../types";
import { addComment, deletePost, fetchPosts, toggleLike } from "../utils/api";
import { formatRelativeTime } from "../utils/formatTime";

interface TimelineSectionProps {
  profile: UserProfile | null;
  refreshKey: number;
  onRequireProfile: () => void;
}

interface PostCardProps {
  post: Post;
  profile: UserProfile | null;
  onUpdatePost: (post: Post) => void;
  onRemovePost: (postId: string) => void;
  onRequireProfile: () => void;
  onError: (message: string) => void;
}

function PostCard({
  post,
  profile,
  onUpdatePost,
  onRemovePost,
  onRequireProfile,
  onError,
}: PostCardProps): JSX.Element {
  const [commentsOpen, setCommentsOpen] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);

  const handleLike = async (): Promise<void> => {
    try {
      onUpdatePost(await toggleLike(post.id));
    } catch (error) {
      onError(error instanceof Error ? error.message : "いいねに失敗しました。");
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!window.confirm("この投稿を削除しますか？")) {
      return;
    }
    try {
      await deletePost(post.id);
      onRemovePost(post.id);
    } catch (error) {
      onError(error instanceof Error ? error.message : "削除に失敗しました。");
    }
  };

  const handleCommentSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const text: string = commentText.trim();
    if (!text || isSending) {
      return;
    }
    if (!profile) {
      onRequireProfile();
      return;
    }

    setIsSending(true);
    try {
      onUpdatePost(await addComment(post.id, text, profile));
      setCommentText("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "コメントに失敗しました。");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <article className="post-card">
      <header className="post-header">
        <span className="post-avatar" aria-hidden="true">
          {post.author.avatar}
        </span>
        <div className="post-header-text">
          <span className="post-author">{post.author.name}</span>
          <span className="post-time">{formatRelativeTime(post.createdAt)}</span>
        </div>
        {post.mine ? (
          <button type="button" className="post-delete-button" onClick={handleDelete}>
            削除
          </button>
        ) : null}
      </header>
      <img src={post.imageUrl} alt={`${post.author.name}さんの作品`} className="post-image" />
      {post.caption ? <p className="post-caption">{post.caption}</p> : null}
      <div className="post-actions">
        <button
          type="button"
          className={post.likedByMe ? "like-button is-liked" : "like-button"}
          onClick={handleLike}
          aria-pressed={post.likedByMe}
        >
          {post.likedByMe ? "❤️" : "🤍"} {post.likeCount}
        </button>
        <button
          type="button"
          className="comment-toggle-button"
          onClick={() => setCommentsOpen((current) => !current)}
          aria-expanded={commentsOpen}
        >
          💬 {post.comments.length}
        </button>
      </div>
      {commentsOpen ? (
        <div className="post-comments">
          {post.comments.length > 0 ? (
            <ul className="comment-list">
              {post.comments.map((comment) => (
                <li key={comment.id} className="comment-item">
                  <span className="comment-avatar" aria-hidden="true">
                    {comment.author.avatar}
                  </span>
                  <div>
                    <span className="comment-author">{comment.author.name}</span>
                    <span className="post-time"> ・ {formatRelativeTime(comment.createdAt)}</span>
                    <p className="comment-text">{comment.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="helper-text">まだコメントはありません。</p>
          )}
          <form className="comment-form" onSubmit={handleCommentSubmit}>
            <input
              type="text"
              value={commentText}
              maxLength={300}
              placeholder={profile ? "コメントを書く…" : "コメントするには名前の設定が必要です"}
              onChange={(event) => setCommentText(event.target.value)}
            />
            <button
              type="submit"
              className="primary-button"
              disabled={isSending || commentText.trim().length === 0}
            >
              送信
            </button>
          </form>
        </div>
      ) : null}
    </article>
  );
}

export function TimelineSection({
  profile,
  refreshKey,
  onRequireProfile,
}: TimelineSectionProps): JSX.Element {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPosts = async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setPosts(await fetchPosts());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "タイムラインを読み込めませんでした。",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPosts();
    // refreshKey が変わるたび（タブを開いたとき・投稿したとき）に再取得する。
  }, [refreshKey]);

  const updatePost = (updated: Post): void => {
    setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
  };

  const removePost = (postId: string): void => {
    setPosts((current) => current.filter((post) => post.id !== postId));
  };

  return (
    <section className="panel-section" aria-labelledby="timeline-heading">
      <div className="section-heading">
        <h2 id="timeline-heading">みんなの作品</h2>
        <button type="button" className="secondary-button" onClick={() => void loadPosts()}>
          更新
        </button>
      </div>
      {errorMessage ? (
        <p className="error-text" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isLoading ? (
        <p className="helper-text">読み込み中…</p>
      ) : posts.length === 0 && !errorMessage ? (
        <p className="helper-text">
          まだ投稿がありません。「つくる」タブで作品を仕上げて、最初の投稿をしてみましょう！
        </p>
      ) : (
        <div className="timeline-list">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              profile={profile}
              onUpdatePost={updatePost}
              onRemovePost={removePost}
              onRequireProfile={onRequireProfile}
              onError={setErrorMessage}
            />
          ))}
        </div>
      )}
    </section>
  );
}
