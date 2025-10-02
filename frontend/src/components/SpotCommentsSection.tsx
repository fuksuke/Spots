import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Comment, CommentLikeMutationResult, Spot } from "../types";
import { useSpotComments } from "../hooks/useSpotComments";
import { uploadImageFile } from "../lib/storage";

export type SpotCommentsSectionProps = {
  spot: Spot;
  authToken?: string;
  onCommentCreated?: (comment: Comment) => void;
  onRequireAuth?: () => void;
};

export const SpotCommentsSection = ({ spot, authToken, onCommentCreated, onRequireAuth }: SpotCommentsSectionProps) => {
  const {
    comments,
    error,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    mutate,
    isValidating
  } = useSpotComments(spot.id, authToken);

  const sortedComments = useMemo(() => comments, [comments]);

  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingCommentLikeIds, setPendingCommentLikeIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setText("");
    setImageUrl("");
    setImageFile(null);
    setImagePreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
    setStatusMessage(null);
    setErrorMessage(null);
    setPendingCommentLikeIds(new Set());
  }, [spot.id]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageFileChange = useCallback((file: File | null) => {
    setImageFile(file);
    setImagePreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return file ? URL.createObjectURL(file) : null;
    });
    if (file) {
      setImageUrl("");
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setErrorMessage(null);
      setStatusMessage(null);

      if (!authToken) {
        setErrorMessage("コメントするにはログインが必要です。");
        onRequireAuth?.();
        return;
      }

      if (!text.trim()) {
        setErrorMessage("コメントを入力してください。");
        return;
      }

      setIsSubmitting(true);
      try {
        let uploadedImageUrl: string | undefined;
        if (imageFile) {
          try {
            uploadedImageUrl = await uploadImageFile(imageFile, "comments");
          } catch (uploadError) {
            throw new Error("画像のアップロードに失敗しました。再度お試しください。");
          }
        } else if (imageUrl.trim()) {
          uploadedImageUrl = imageUrl.trim();
        }

        const payload = {
          text: text.trim(),
          imageUrl: uploadedImageUrl
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

        await mutate(
          (pages) => {
            if (!pages || pages.length === 0) {
              return [
                {
                  comments: [comment],
                  nextCursor: undefined
                }
              ];
            }
            const [first, ...rest] = pages;
            return [
              {
                comments: [comment, ...first.comments],
                nextCursor: first.nextCursor
              },
              ...rest
            ];
          },
          { revalidate: false }
        );

        onCommentCreated?.(comment);
        setStatusMessage("コメントを投稿しました。");
        setText("");
        setImageUrl("");
        handleImageFileChange(null);
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : "予期せぬエラーが発生しました";
        setErrorMessage(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [authToken, handleImageFileChange, imageFile, imageUrl, mutate, onCommentCreated, onRequireAuth, spot.id, text]
  );

  const handleToggleCommentLike = useCallback(
    async (comment: Comment) => {
      if (!authToken) {
        setErrorMessage("いいねするにはログインが必要です。");
        onRequireAuth?.();
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
    [authToken, mutate, onRequireAuth]
  );

  return (
    <section className="comments-section">
      <header className="comments-section-header">
        <h3>コミュニティの声</h3>
        <span className="comments-count">{isValidating ? "更新中..." : `${sortedComments.length}件`}</span>
      </header>
      <div className="comments-body">
        {isLoading && <p className="hint">コメントを読み込み中...</p>}
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
                {comment.imageUrl && <img src={comment.imageUrl} alt="コメント画像" className="comment-image" loading="lazy" />}
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
          <button type="button" className="button subtle load-more" onClick={() => void loadMore()} disabled={isLoadingMore}>
            {isLoadingMore ? "読み込み中..." : "さらに読み込む"}
          </button>
        )}
      </div>
      <form className="comments-form" onSubmit={handleSubmit}>
        <h4>コメントを投稿</h4>
        <label className="form-group">
          <span>コメント</span>
          <textarea
            className="textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="感想や最新情報を共有しましょう"
            rows={3}
            required
          />
        </label>
        <label className="form-group">
          <span>画像URL（任意）</span>
          <input className="input" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://" />
        </label>
        <label className="form-group">
          <span>画像をアップロード（任意）</span>
          <input type="file" accept="image/*" onChange={(event) => handleImageFileChange(event.target.files?.[0] ?? null)} />
          {imagePreview && <img src={imagePreview} alt="選択中の画像プレビュー" className="image-preview" />}
        </label>
        {statusMessage && <p className="status success">{statusMessage}</p>}
        {errorMessage && <p className="status error">{errorMessage}</p>}
        <button type="submit" className="button primary" disabled={isSubmitting}>
          {isSubmitting ? "投稿中..." : "投稿する"}
        </button>
        {!authToken && <p className="hint">ログインするとコメントを投稿できます。</p>}
      </form>
    </section>
  );
};
