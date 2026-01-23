import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyedMutator } from "swr";
import { FavoriteMutationResult, FollowMutationResult, LikeMutationResult, Spot } from "../../types";
import { SpotOwnerBadge } from "../../components/ui/SpotOwnerBadge";

type SpotFeedProps = {
  spots: Spot[];
  isLoading: boolean;
  error: unknown;
  onSpotSelect?: (spot: Spot) => void;
  onSpotView?: (spot: Spot) => void;
  mutate: KeyedMutator<Spot[]>;
  authToken: string;
  isFollowedView?: boolean;
  onProfileUpdated?: () => void;
};

export const SpotFeed = ({
  spots,
  isLoading,
  error,
  onSpotSelect,
  onSpotView,
  mutate,
  authToken,
  isFollowedView = false,
  onProfileUpdated
}: SpotFeedProps) => {
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat("ja-JP", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
    []
  );

  const sortedSpots = useMemo(() => {
    return [...spots].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [spots]);

  const [likedSpotIds, setLikedSpotIds] = useState<Set<string>>(() => new Set());
  const [pendingSpotIds, setPendingSpotIds] = useState<Set<string>>(() => new Set());
  const [followedOwnerIds, setFollowedOwnerIds] = useState<Set<string>>(() => new Set());
  const [pendingFollowOwnerIds, setPendingFollowOwnerIds] = useState<Set<string>>(() => new Set());
  const [favoriteSpotIds, setFavoriteSpotIds] = useState<Set<string>>(() => new Set());
  const [pendingFavoriteSpotIds, setPendingFavoriteSpotIds] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const nextLiked = new Set<string>();
    for (const spot of sortedSpots) {
      if (spot.likedByViewer) {
        nextLiked.add(spot.id);
      }
    }
    setLikedSpotIds(nextLiked);
  }, [sortedSpots]);

  useEffect(() => {
    const nextFollowed = new Set<string>();
    for (const spot of sortedSpots) {
      if (spot.followedByViewer) {
        nextFollowed.add(spot.ownerId);
      }
    }
    setFollowedOwnerIds(nextFollowed);
  }, [sortedSpots]);

  useEffect(() => {
    const nextFavorites = new Set<string>();
    for (const spot of sortedSpots) {
      if (spot.favoritedByViewer) {
        nextFavorites.add(spot.id);
      }
    }
    setFavoriteSpotIds(nextFavorites);
  }, [sortedSpots]);

  const handleToggleLike = useCallback(
    async (spot: Spot) => {
      if (!authToken) {
        setActionError("Firebase IDトークンを入力してください。");
        return;
      }

      setActionError(null);
      setPendingSpotIds((prev) => {
        const next = new Set(prev);
        next.add(spot.id);
        return next;
      });

      const isCurrentlyLiked = likedSpotIds.has(spot.id);
      const endpoint = isCurrentlyLiked ? "/api/unlike_spot" : "/api/like_spot";

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

        setLikedSpotIds((prev) => {
          const next = new Set(prev);
          if (result.liked) {
            next.add(spot.id);
          } else {
            next.delete(spot.id);
          }
          return next;
        });

        await mutate((current) => {
          if (!current) return current;
          return current.map((item) =>
            item.id === spot.id
              ? {
                ...item,
                likes: result.likes,
                likedByViewer: result.liked
              }
              : item
          );
        }, { revalidate: false });

        void mutate();
      } catch (mutationError) {
        const message = mutationError instanceof Error ? mutationError.message : "予期せぬエラーが発生しました";
        setActionError(message);
      } finally {
        setPendingSpotIds((prev) => {
          const next = new Set(prev);
          next.delete(spot.id);
          return next;
        });
      }
    },
    [authToken, likedSpotIds, mutate]
  );

  const handleToggleFollow = useCallback(
    async (spot: Spot) => {
      if (!authToken) {
        setActionError("Firebase IDトークンを入力してください。");
        return;
      }

      setActionError(null);
      const ownerId = spot.ownerId;
      const isFollowing = followedOwnerIds.has(ownerId);
      const endpoint = isFollowing ? "/api/unfollow_user" : "/api/follow_user";

      setPendingFollowOwnerIds((prev) => {
        const next = new Set(prev);
        next.add(ownerId);
        return next;
      });

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

        setFollowedOwnerIds((prev) => {
          const next = new Set(prev);
          if (result.following) {
            next.add(ownerId);
          } else {
            next.delete(ownerId);
          }
          return next;
        });

        await mutate((current) => {
          if (!current) return current;
          const mapped = current.map((item) =>
            item.ownerId === ownerId
              ? {
                ...item,
                followedByViewer: result.following
              }
              : item
          );

          if (isFollowedView && !result.following) {
            return mapped.filter((item) => item.ownerId !== ownerId);
          }

          return mapped;
        }, { revalidate: false });

        void mutate();
        onProfileUpdated?.();
      } catch (mutationError) {
        const message = mutationError instanceof Error ? mutationError.message : "予期せぬエラーが発生しました";
        setActionError(message);
      } finally {
        setPendingFollowOwnerIds((prev) => {
          const next = new Set(prev);
          next.delete(ownerId);
          return next;
        });
      }
    },
    [authToken, followedOwnerIds, mutate, isFollowedView, onProfileUpdated]
  );

  const handleToggleFavorite = useCallback(
    async (spot: Spot) => {
      if (!authToken) {
        setActionError("Firebase IDトークンを入力してください。");
        return;
      }

      setActionError(null);
      setPendingFavoriteSpotIds((prev) => {
        const next = new Set(prev);
        next.add(spot.id);
        return next;
      });

      const isFavorite = favoriteSpotIds.has(spot.id);
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

        setFavoriteSpotIds((prev) => {
          const next = new Set(prev);
          if (result.favorited) {
            next.add(spot.id);
          } else {
            next.delete(spot.id);
          }
          return next;
        });

        await mutate((current) => {
          if (!current) return current;
          return current.map((item) =>
            item.id === spot.id
              ? {
                ...item,
                favoritedByViewer: result.favorited
              }
              : item
          );
        }, { revalidate: false });

        void mutate();
        onProfileUpdated?.();
      } catch (mutationError) {
        const message = mutationError instanceof Error ? mutationError.message : "予期せぬエラーが発生しました";
        setActionError(message);
      } finally {
        setPendingFavoriteSpotIds((prev) => {
          const next = new Set(prev);
          next.delete(spot.id);
          return next;
        });
      }
    },
    [authToken, favoriteSpotIds, mutate, onProfileUpdated]
  );

  if (isLoading) {
    return <div className="panel">読み込み中...</div>;
  }

  if (error) {
    const message = error instanceof Error ? error.message : "スポット情報の取得に失敗しました。";
    return <div className="panel error">{message}</div>;
  }

  return (
    <div className="panel">
      <h2>最新のスポット</h2>
      {actionError && <p className="status error">{actionError}</p>}
      <ul className="spot-list">
        {sortedSpots.map((spot) => (
          <li key={spot.id} className="spot-card">
            <div className="spot-card-main">
              <p className="badge">{spot.category.toUpperCase()}</p>
              <h3>{spot.title}</h3>
              <div className="spot-owner-row">
                <SpotOwnerBadge
                  ownerId={spot.ownerId}
                  displayName={spot.ownerDisplayName}
                  photoUrl={spot.ownerPhotoUrl}
                  phoneVerified={spot.ownerPhoneVerified}
                />
                <button
                  type="button"
                  className={`button subtle follow-button ${followedOwnerIds.has(spot.ownerId) ? "active" : ""}`}
                  disabled={pendingFollowOwnerIds.has(spot.ownerId)}
                  onClick={() => void handleToggleFollow(spot)}
                >
                  {followedOwnerIds.has(spot.ownerId) ? "フォロー中" : "フォロー"}
                </button>
              </div>
              <p className="spot-description">{spot.description}</p>
              <div className="spot-meta">
                <button
                  type="button"
                  className={`button subtle like-button ${likedSpotIds.has(spot.id) ? "active" : ""}`}
                  disabled={pendingSpotIds.has(spot.id)}
                  onClick={() => void handleToggleLike(spot)}
                >
                  👍 {spot.likes}
                </button>
                <span>💬 {spot.commentsCount}</span>
                <button
                  type="button"
                  className={`button subtle bookmark-button ${favoriteSpotIds.has(spot.id) ? "active" : ""}`}
                  disabled={pendingFavoriteSpotIds.has(spot.id)}
                  onClick={() => void handleToggleFavorite(spot)}
                >
                  {favoriteSpotIds.has(spot.id) ? "★" : "☆"}
                </button>
              </div>
            </div>
            <div className="spot-card-actions">
              <time className="time-range">
                {formatter.format(new Date(spot.startTime))} -
                <br />
                {formatter.format(new Date(spot.endTime))}
              </time>
              <button
                type="button"
                className="button subtle"
                onClick={() => {
                  onSpotView?.(spot);
                  onSpotSelect?.(spot);
                }}
              >
                地図で見る
              </button>
            </div>
          </li>
        ))}
        {sortedSpots.length === 0 && <li>まだ投稿がありません。</li>}
      </ul>
    </div>
  );
};
