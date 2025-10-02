import { User } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Comment, FavoriteMutationResult, FollowMutationResult, LikeMutationResult, Spot } from "../types";
import { SpotCommentsSection } from "./SpotCommentsSection";

type PendingFlags = {
  like: boolean;
  favorite: boolean;
  follow: boolean;
};

export type SpotDetailSheetProps = {
  spot: Spot | null;
  isOpen: boolean;
  authToken?: string;
  currentUser: User | null;
  onClose: () => void;
  onNotify?: (spot: Spot) => void;
  onShare?: (spot: Spot) => void;
  onSpotUpdated?: (spotId: string, updates: Partial<Spot>) => void;
  onProfileMutate?: () => void;
  onRequireAuth?: () => void;
  onRevalidateSpots?: () => void;
  onFeedback?: (message: string) => void;
};

export const SpotDetailSheet = ({
  spot,
  isOpen,
  authToken,
  currentUser,
  onClose,
  onNotify,
  onShare,
  onSpotUpdated,
  onProfileMutate,
  onRequireAuth,
  onRevalidateSpots,
  onFeedback
}: SpotDetailSheetProps) => {
  const timeRange = useMemo(() => {
    if (!spot) return "";
    const formatter = new Intl.DateTimeFormat("ja-JP", {
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
    return `${formatter.format(new Date(spot.startTime))} - ${formatter.format(new Date(spot.endTime))}`;
  }, [spot]);

  const [pending, setPending] = useState<PendingFlags>({ like: false, favorite: false, follow: false });
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setPending({ like: false, favorite: false, follow: false });
    setActionError(null);
  }, [spot?.id, isOpen]);

  const ensureAuthenticated = useCallback(() => {
    if (!authToken) {
      setActionError("この操作にはログインが必要です。");
      onRequireAuth?.();
      return false;
    }
    return true;
  }, [authToken, onRequireAuth]);

  const applySpotUpdate = useCallback(
    (updates: Partial<Spot>) => {
      if (spot) {
        onSpotUpdated?.(spot.id, updates);
      }
    },
    [onSpotUpdated, spot]
  );

  const handleToggleLike = useCallback(async () => {
    if (!spot) return;
    if (!ensureAuthenticated()) {
      return;
    }
    setPending((flags) => ({ ...flags, like: true }));
    setActionError(null);
    const isLiked = spot.likedByViewer ?? false;
    const endpoint = isLiked ? "/api/unlike_spot" : "/api/like_spot";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ spot_id: spot.id })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "いいね操作に失敗しました");
      }

      const result = (await response.json()) as LikeMutationResult;
      applySpotUpdate({ likes: result.likes, likedByViewer: result.liked });
      onRevalidateSpots?.();
      if (result.liked) {
        onFeedback?.("いいねしました");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "予期せぬエラーが発生しました";
      setActionError(message);
    } finally {
      setPending((flags) => ({ ...flags, like: false }));
    }
  }, [applySpotUpdate, authToken, ensureAuthenticated, onFeedback, onRevalidateSpots, spot]);

  const handleToggleFavorite = useCallback(async () => {
    if (!spot) return;
    if (!ensureAuthenticated()) {
      return;
    }
    setPending((flags) => ({ ...flags, favorite: true }));
    setActionError(null);
    const isFavorite = spot.favoritedByViewer ?? false;
    const endpoint = isFavorite ? "/api/unfavorite_spot" : "/api/favorite_spot";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ spot_id: spot.id })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "お気に入り操作に失敗しました");
      }

      const result = (await response.json()) as FavoriteMutationResult;
      applySpotUpdate({ favoritedByViewer: result.favorited });
      onRevalidateSpots?.();
      onFeedback?.(result.favorited ? "お気に入りに追加しました" : "お気に入りを解除しました");
    } catch (error) {
      const message = error instanceof Error ? error.message : "予期せぬエラーが発生しました";
      setActionError(message);
    } finally {
      setPending((flags) => ({ ...flags, favorite: false }));
    }
  }, [applySpotUpdate, authToken, ensureAuthenticated, onFeedback, onRevalidateSpots, spot]);

  const handleToggleFollow = useCallback(async () => {
    if (!spot) return;
    if (!ensureAuthenticated()) {
      return;
    }
    setPending((flags) => ({ ...flags, follow: true }));
    setActionError(null);
    const ownerId = spot.ownerId;
    const isFollowing = spot.followedByViewer ?? false;
    const endpoint = isFollowing ? "/api/unfollow_user" : "/api/follow_user";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ target_user_id: ownerId })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "フォロー操作に失敗しました");
      }

      const result = (await response.json()) as FollowMutationResult;
      applySpotUpdate({ followedByViewer: result.following });
      onProfileMutate?.();
      onRevalidateSpots?.();
      onFeedback?.(result.following ? "フォローしました" : "フォローを解除しました");
    } catch (error) {
      const message = error instanceof Error ? error.message : "予期せぬエラーが発生しました";
      setActionError(message);
    } finally {
      setPending((flags) => ({ ...flags, follow: false }));
    }
  }, [applySpotUpdate, authToken, ensureAuthenticated, onFeedback, onProfileMutate, onRevalidateSpots, spot]);

  const handleCommentCreated = useCallback(
    (_comment: Comment) => {
      applySpotUpdate({ commentsCount: (spot?.commentsCount ?? 0) + 1 });
      onRevalidateSpots?.();
      onFeedback?.("コメントを追加しました");
    },
    [applySpotUpdate, onFeedback, onRevalidateSpots, spot]
  );

  const isOwner = spot && currentUser ? spot.ownerId === currentUser.uid : false;
  const likeLabel = spot?.likedByViewer ? "いいね済み" : "いいね";
  const favoriteLabel = spot?.favoritedByViewer ? "保存済み" : "保存";
  const followLabel = spot?.followedByViewer ? "フォロー中" : "フォロー";

  return (
    <div className={`spot-detail-sheet ${isOpen ? "open" : ""}`.trim()} role="dialog" aria-hidden={!isOpen}>
      <div className="sheet-scrim" aria-hidden="true" onClick={onClose} />
      <section className="sheet-body">
        <div className="sheet-header">
          <div>
            <h2>{spot?.title ?? "イベント詳細"}</h2>
            {spot ? <p className="sheet-subtitle">#{spot.category} ・ {timeRange}</p> : null}
          </div>
          <div className="sheet-actions">
            {spot ? (
              <button type="button" className="icon-button" onClick={() => onNotify?.(spot)} aria-label="通知設定">
                🔔
              </button>
            ) : null}
            {spot ? (
              <button type="button" className="icon-button" onClick={() => onShare?.(spot)} aria-label="共有">
                🔗
              </button>
            ) : null}
            <button type="button" className="icon-button" onClick={onClose} aria-label="閉じる">
              ✕
            </button>
          </div>
        </div>
        {spot?.imageUrl ? (
          <div className="sheet-media">
            <img src={spot.imageUrl} alt={spot.title} loading="lazy" />
          </div>
        ) : null}
        {spot ? (
          <div className="sheet-content">
            <p className="sheet-description">{spot.description}</p>
            <div className="sheet-actions-row">
              <button
                type="button"
                className={`action-chip ${spot.likedByViewer ? "active" : ""}`.trim()}
                onClick={() => void handleToggleLike()}
                disabled={pending.like}
              >
                👍 {likeLabel} ({spot.likes})
              </button>
              <button
                type="button"
                className={`action-chip ${spot.favoritedByViewer ? "active" : ""}`.trim()}
                onClick={() => void handleToggleFavorite()}
                disabled={pending.favorite}
              >
                ⭐ {favoriteLabel}
              </button>
              {!isOwner && (
                <button
                  type="button"
                  className={`action-chip ${spot.followedByViewer ? "active" : ""}`.trim()}
                  onClick={() => void handleToggleFollow()}
                  disabled={pending.follow}
                >
                  🤝 {followLabel}
                </button>
              )}
            </div>
            {actionError && <p className="status error">{actionError}</p>}
            <dl className="sheet-info">
              <div>
                <dt>開催時間</dt>
                <dd>{timeRange}</dd>
              </div>
              <div>
                <dt>投稿者</dt>
                <dd>{spot.ownerDisplayName ?? spot.ownerId}</dd>
              </div>
              <div>
                <dt>場所</dt>
                <dd>
                  {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
                </dd>
              </div>
              <div>
                <dt>反応</dt>
                <dd>
                  👍 {spot.likes} ・ 💬 {spot.commentsCount}
                </dd>
              </div>
            </dl>
            <SpotCommentsSection
              spot={spot}
              authToken={authToken}
              onCommentCreated={handleCommentCreated}
              onRequireAuth={onRequireAuth}
            />
          </div>
        ) : (
          <div className="sheet-placeholder">イベントを選択してください。</div>
        )}
      </section>
    </div>
  );
};
