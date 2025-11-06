import { User } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { Avatar } from "./Avatar";
import { SpotCommentsSection } from "./SpotCommentsSection";
import { Comment, FavoriteMutationResult, FollowMutationResult, LikeMutationResult, Spot, SpotExternalLink } from "../types";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const PEEK_TRANSLATE = 45;
const EXPAND_THRESHOLD = 18;
const CLOSE_THRESHOLD = 70;
const CLOSE_ANIMATION_MS = 240;

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
  const sheetRef = useRef<HTMLElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const dragStateRef = useRef<{ startY: number; startTranslate: number; pointerId: number | null }>({
    startY: 0,
    startTranslate: PEEK_TRANSLATE,
    pointerId: null
  });
  const [sheetTranslate, setSheetTranslate] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const mediaScrollRef = useRef<HTMLDivElement | null>(null);
  const mediaItems = useMemo(() => {
    if (!spot) return [] as string[];
    if (spot.mediaUrls && spot.mediaUrls.length > 0) {
      return spot.mediaUrls;
    }
    if (spot.imageUrl) {
      return [spot.imageUrl];
    }
    return [] as string[];
  }, [spot]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  useEffect(() => {
    setActiveMediaIndex(0);
  }, [spot?.id]);

  useEffect(() => {
    const container = mediaScrollRef.current;
    if (!container) return;
    container.scrollTo({ left: 0, behavior: "auto" });
  }, [spot?.id]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setPending({ like: false, favorite: false, follow: false });
    setActionError(null);
  }, [spot?.id, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSheetTranslate(100);
      setIsDragging(false);
      return;
    }

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        setSheetTranslate(PEEK_TRANSLATE);
      });
      return;
    }

    setSheetTranslate(PEEK_TRANSLATE);
  }, [isOpen]);

  useEffect(() => {
    if (spot && isOpen) {
      setSheetTranslate(PEEK_TRANSLATE);
      setIsDragging(false);
    }
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

  const closeSheet = useCallback(() => {
    setSheetTranslate(100);
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      onClose();
    }, CLOSE_ANIMATION_MS);
  }, [onClose]);

  const scrollToMediaIndex = useCallback(
    (index: number) => {
      const container = mediaScrollRef.current;
      if (!container || mediaItems.length === 0) return;
      const targetIndex = clamp(index, 0, mediaItems.length - 1);
      const { width } = container.getBoundingClientRect();
      container.scrollTo({ left: width * targetIndex, behavior: "smooth" });
      setActiveMediaIndex(targetIndex);
    },
    [mediaItems.length]
  );

  const handlePrevMedia = useCallback(() => {
    if (mediaItems.length < 2) return;
    const nextIndex = activeMediaIndex === 0 ? mediaItems.length - 1 : activeMediaIndex - 1;
    scrollToMediaIndex(nextIndex);
  }, [activeMediaIndex, mediaItems.length, scrollToMediaIndex]);

  const handleNextMedia = useCallback(() => {
    if (mediaItems.length < 2) return;
    const nextIndex = activeMediaIndex === mediaItems.length - 1 ? 0 : activeMediaIndex + 1;
    scrollToMediaIndex(nextIndex);
  }, [activeMediaIndex, mediaItems.length, scrollToMediaIndex]);

  useEffect(() => {
    const container = mediaScrollRef.current;
    if (!container || mediaItems.length < 2) return;

    const handleScroll = () => {
      const { width } = container.getBoundingClientRect();
      if (width <= 0) return;
      const tentativeIndex = Math.round(container.scrollLeft / width);
      setActiveMediaIndex((current) => {
        const normalized = clamp(tentativeIndex, 0, mediaItems.length - 1);
        return current === normalized ? current : normalized;
      });
    };

    const opts: AddEventListenerOptions = { passive: true };
    container.addEventListener("scroll", handleScroll, opts);
    return () => {
      container.removeEventListener("scroll", handleScroll, opts);
    };
  }, [mediaItems.length]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isOpen) return;
      if (event.pointerType === "mouse" && event.buttons !== 1) return;
      dragStateRef.current = {
        startY: event.clientY,
        startTranslate: sheetTranslate,
        pointerId: event.pointerId
      };
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [isOpen, sheetTranslate]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      if (dragStateRef.current.pointerId !== event.pointerId) return;

      const sheetEl = sheetRef.current;
      if (!sheetEl) return;

      const deltaY = event.clientY - dragStateRef.current.startY;
      const sheetHeight = sheetEl.getBoundingClientRect().height || 1;
      const deltaPercent = (deltaY / sheetHeight) * 100;
      const next = clamp(dragStateRef.current.startTranslate + deltaPercent, 0, 100);
      setSheetTranslate(next);
    },
    [isDragging]
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      if (dragStateRef.current.pointerId !== event.pointerId) return;

      event.currentTarget.releasePointerCapture(event.pointerId);
      setIsDragging(false);

      const sheetEl = sheetRef.current;
      const sheetHeight = sheetEl?.getBoundingClientRect().height || 1;
      const deltaY = event.clientY - dragStateRef.current.startY;
      const deltaPercent = (deltaY / sheetHeight) * 100;
      const current = clamp(dragStateRef.current.startTranslate + deltaPercent, 0, 100);

      dragStateRef.current.pointerId = null;

      if (current > CLOSE_THRESHOLD) {
        closeSheet();
        return;
      }
      if (current < EXPAND_THRESHOLD) {
        setSheetTranslate(0);
        return;
      }
      setSheetTranslate(PEEK_TRANSLATE);
    },
    [closeSheet, isDragging]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSheet();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeSheet, isOpen]);

  const isOwner = spot && currentUser ? spot.ownerId === currentUser.uid : false;
  const likeLabel = spot?.likedByViewer ? "いいね済み" : "いいね";
  const favoriteLabel = spot?.favoritedByViewer ? "保存済み" : "保存";
  const followLabel = spot?.followedByViewer ? "フォロー中" : "フォロー";

  const handleDirections = useCallback(() => {
    if (!spot) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [spot]);

  const externalLinks = useMemo<SpotExternalLink[]>(() => {
    if (!spot || !spot.externalLinks) return [];
    return spot.externalLinks.filter((link) => Boolean(link?.url)).map((link) => ({
      label: link.label,
      url: link.url,
      icon: link.icon ?? null
    }));
  }, [spot]);

  const renderMedia = () => {
    if (!spot || mediaItems.length === 0) return null;
    if (mediaItems.length === 1) {
      return (
        <div className="sheet-media single" aria-label="イベント画像">
          <img src={mediaItems[0]} alt={spot.title} loading="lazy" />
        </div>
      );
    }

    return (
      <div className="sheet-media carousel" aria-roledescription="carousel">
        <div className="media-scroll" ref={mediaScrollRef} aria-live="polite">
          {mediaItems.map((url, index) => (
            <figure className="media-slide" key={`${url}-${index}`} aria-label={`${index + 1}/${mediaItems.length}`}>
              <img src={url} alt={`${spot.title} ${index + 1}`} loading="lazy" />
            </figure>
          ))}
        </div>
        <button type="button" className="media-nav prev" onClick={handlePrevMedia} aria-label="前の画像">
          ‹
        </button>
        <button type="button" className="media-nav next" onClick={handleNextMedia} aria-label="次の画像">
          ›
        </button>
        <div className="media-indicators" role="tablist" aria-label="画像選択">
          {mediaItems.map((_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={activeMediaIndex === index}
              className={`indicator ${activeMediaIndex === index ? "active" : ""}`.trim()}
              onClick={() => scrollToMediaIndex(index)}
            />
          ))}
        </div>
      </div>
    );
  };

  const sheetMode = sheetTranslate <= EXPAND_THRESHOLD ? "expanded" : sheetTranslate >= 99 ? "closed" : "peek";

  return (
    <div
      className={`spot-detail-sheet ${isOpen ? "open" : ""}`.trim()}
      role="dialog"
      aria-modal={false}
      aria-hidden={!isOpen}
      aria-labelledby={spot ? `spot-detail-${spot.id}` : undefined}
    >
      <section
        ref={sheetRef}
        className={`sheet-body ${sheetMode} ${isDragging ? "dragging" : ""}`.trim()}
        role="document"
        style={{ transform: `translateY(${sheetTranslate}%)` }}
      >
        {spot ? (
          <>
            <div
              className={`sheet-handle ${isDragging ? "active" : ""}`.trim()}
              aria-hidden="true"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            />
            <header className="sheet-top-bar">
              <div className="sheet-owner">
                <Avatar name={spot.ownerDisplayName ?? spot.ownerId} photoUrl={spot.ownerPhotoUrl ?? undefined} size={36} />
                <div className="sheet-owner-meta">
                  <p className="sheet-owner-name">
                    {spot.ownerDisplayName ?? spot.ownerId}
                    {spot.ownerPhoneVerified ? (
                      <span className="spot-owner-verified" title="SMS認証済み" aria-label="SMS認証済み">
                        ✅
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="sheet-actions">
                <button type="button" className="icon-button" onClick={closeSheet} aria-label="閉じる">
                  ✕
                </button>
              </div>
            </header>

            {renderMedia()}

            <div className="sheet-content">
              <section className="sheet-section">
                <header className="sheet-section-header">
                  <div className="sheet-section-heading">
                    <h2 className="sheet-event-title" id={`spot-detail-${spot.id}`}>
                      {spot.title}
                    </h2>
                  </div>
                  <p className="sheet-period">{timeRange}</p>
                </header>
                <p className="sheet-description">{spot.description}</p>
              </section>

              <section className="sheet-section">
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
              </section>

              <section className="sheet-section">
                <button type="button" className="button primary directions" onClick={handleDirections}>
                  Google マップで経路を表示
                </button>
              </section>

              {externalLinks.length > 0 ? (
                <section className="sheet-section">
                  <h3>関連リンク</h3>
                  <ul className="sheet-links">
                    {externalLinks.map((link) => (
                      <li key={`${link.label}-${link.url}`}>
                        <a href={link.url} target="_blank" rel="noopener noreferrer">
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="sheet-section comments">
                <SpotCommentsSection
                  spot={spot}
                  authToken={authToken}
                  onCommentCreated={handleCommentCreated}
                  onRequireAuth={onRequireAuth}
                />
              </section>
            </div>
          </>
        ) : (
          <div className="sheet-placeholder">イベントを選択してください。</div>
        )}
      </section>
    </div>
  );
};
