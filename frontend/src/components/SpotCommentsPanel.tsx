import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSpotComments } from "../hooks/useSpotComments";
import { Comment, CommentLikeMutationResult, Spot } from "../types";

type SpotCommentsPanelProps = {
  spot: Spot;
  authToken?: string;
  onClose: () => void;
  onCommentCreated?: (comment: Comment) => void;
};

export const SpotCommentsPanel = ({
  spot,
  authToken,
  onClose,
  onCommentCreated
}: SpotCommentsPanelProps) => {
  const { comments, error, isLoading, isLoadingMore, hasMore, loadMore, mutate } = useSpotComments(spot.id, authToken);
  const [text, setText] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingCommentLikeIds, setPendingCommentLikeIds] = useState<Set<string>>(() => new Set());

  const sortedComments = useMemo(() => comments, [comments]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setErrorMessage(null);
      setStatusMessage(null);

      if (!authToken) {
        setErrorMessage("コメントするにはログインが必要です。");
        return;
      }

      if (!text.trim()) {
        setErrorMessage("コメントを入力してください。");
        return;
      }

      setIsSubmitting(true);
      try {
        const payload = {
          text: text.trim()
        };

        const response = await fetch(`/api/spots/${spot.id}/comments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.message ?? "コメント投稿に失敗しました");
        }

        const comment = (await response.json()) as Comment;

        await mutate((currentPages) => {
          if (!currentPages || currentPages.length === 0) {
            return [
              {
                comments: [comment],
                nextCursor: undefined
              }
            ];
          }

          const [first, ...rest] = currentPages;
          return [
            {
              comments: [comment, ...first.comments],
              nextCursor: first.nextCursor
            },
            ...rest
          ];
        }, { revalidate: false });

        onCommentCreated?.(comment);
        setStatusMessage("コメントを投稿しました。");
        setText("");
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : "予期せぬエラーが発生しました";
        setErrorMessage(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [authToken, mutate, onCommentCreated, spot.id, text]
  );

  const handleToggleCommentLike = useCallback(
    async (comment: Comment) => {
      if (!authToken) {
        setErrorMessage("いいねするにはログインが必要です。");
        return;
      }

      setErrorMessage(null);
      setPendingCommentLikeIds((prev) => {
        const next = new Set(prev);
        next.add(comment.id);
        return next;
      });

      const isLiked = comment.likedByViewer ?? false;
      const endpoint = isLiked ? `/api/comments/${comment.id}/unlike` : `/api/comments/${comment.id}/like`;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          }
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.message ?? "コメントへのいいね操作に失敗しました");
        }

        const result = (await response.json()) as CommentLikeMutationResult;

        await mutate(
          (pages) => {
            if (!pages) return pages;
            return pages.map((page) => ({
              ...page,
              comments: page.comments.map((item) =>
                item.id === comment.id
                  ? {
                      ...item,
                      likes: result.likes,
                      likedByViewer: result.liked
                    }
                  : item
              )
            }));
          },
          { revalidate: false }
        );

        void mutate();
      } catch (toggleError) {
        const message = toggleError instanceof Error ? toggleError.message : "予期せぬエラーが発生しました";
        setErrorMessage(message);
      } finally {
        setPendingCommentLikeIds((prev) => {
          const next = new Set(prev);
          next.delete(comment.id);
          return next;
        });
      }
    },
    [authToken, mutate]
  );

  return (
    <div className="comments-panel" role="dialog" aria-labelledby="comments-title">
      <header className="comments-header">
        <div>
          <p className="comments-category">{spot.category.toUpperCase()}</p>
          <h3 id="comments-title">{spot.title}</h3>
          <p className="comments-description">{spot.description}</p>
        </div>
        <button type="button" className="button subtle" onClick={onClose}>
          閉じる
        </button>
      </header>
      <section className="comments-body">
        {isLoading && <p>読み込み中...</p>}
        {error && <p className="status error">コメントの取得に失敗しました。</p>}
        {!isLoading && !error && sortedComments.length === 0 && <p className="hint">まだコメントがありません。</p>}
        <ul className="comment-list">
          {sortedComments.map((comment) => {
            const date = new Date(comment.timestamp);
            return (
              <li key={comment.id} className="comment-item">
                <div className="comment-meta">
                  <span className="comment-owner">{comment.ownerId}</span>
                  <time dateTime={comment.timestamp}>{date.toLocaleString("ja-JP")}</time>
                </div>
                <p className="comment-text">{comment.text}</p>
                <button
                  type="button"
                  className={`button subtle like-button ${comment.likedByViewer ? "active" : ""}`}
                  onClick={() => void handleToggleCommentLike(comment)}
                  disabled={pendingCommentLikeIds.has(comment.id)}
                >
                  👍 {comment.likes}
                </button>
              </li>
            );
          })}
        </ul>
        {hasMore && (
          <button
            type="button"
            className="button subtle load-more"
            onClick={() => void loadMore()}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "読み込み中..." : "さらに読み込む"}
          </button>
        )}
      </section>
      <section className="comments-form-section">
        <form onSubmit={handleSubmit} className="comments-form">
          <h4>新しいコメント</h4>
          <label className="form-group">
            <span>コメント</span>
            <textarea
              className="textarea"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="雰囲気やメモなどを共有しましょう"
              rows={3}
              required
            />
          </label>
          {statusMessage && <p className="status success">{statusMessage}</p>}
          {errorMessage && <p className="status error">{errorMessage}</p>}
          <button type="submit" className="button primary" disabled={isSubmitting || !authToken}>
            {isSubmitting ? "投稿中..." : "投稿する"}
          </button>
          {!authToken && <p className="hint">ログインするとコメントを投稿できます。</p>}
        </form>
      </section>
    </div>
  );
};
