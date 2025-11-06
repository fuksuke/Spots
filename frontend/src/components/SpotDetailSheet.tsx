import { User } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";

import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { SpotCommentsSection } from "./SpotCommentsSection";
import { Comment, FavoriteMutationResult, FollowMutationResult, LikeMutationResult, Spot, SpotExternalLink } from "../types";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const PEEK_TRANSLATE = 45;
const EXPAND_THRESHOLD = 18;
const CLOSE_THRESHOLD = 70;
const CLOSE_ANIMATION_MS = 240;
const SCROLL_TOP_EPSILON = 2;
const DRAG_ACTIVATION_THRESHOLD = 6;
const WHEEL_PULL_SENSITIVITY = 0.55;
const WHEEL_SETTLE_DELAY_MS = 140;

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
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const assignScrollAreaRef = useCallback((node: HTMLDivElement | null) => {
    scrollAreaRef.current = node;
    setScrollElement(node);
  }, []);
  const scrollDragStateRef = useRef<{ pointerId: number | null; startY: number; startX: number; active: boolean }>({
    pointerId: null,
    startY: 0,
    startX: 0,
    active: false
  });
  const touchDragStateRef = useRef<{ identifier: number | null; startY: number; startX: number; active: boolean }>({
    identifier: null,
    startY: 0,
    startX: 0,
    active: false
  });
  const [sheetTranslate, setSheetTranslate] = useState(100);
  const latestTranslateRef = useRef(sheetTranslate);
  const wheelActiveRef = useRef(false);
  const wheelSettleTimeoutRef = useRef<number | null>(null);
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
      scrollAreaRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [spot?.id, isOpen]);

  useEffect(() => {
    latestTranslateRef.current = sheetTranslate;
  }, [sheetTranslate]);

  const closeSheet = useCallback(() => {
    setSheetTranslate(100);
    if (closeTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(closeTimeoutRef.current);
    }
    if (typeof window === "undefined") {
      onClose();
      return;
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      onClose();
    }, CLOSE_ANIMATION_MS);
  }, [onClose]);

  const settleSheetPosition = useCallback(
    (value: number) => {
      const current = clamp(value, 0, 100);
      if (current > CLOSE_THRESHOLD) {
        latestTranslateRef.current = 100;
        closeSheet();
        return;
      }
      if (current < EXPAND_THRESHOLD) {
        setSheetTranslate(0);
        latestTranslateRef.current = 0;
        return;
      }
      setSheetTranslate(PEEK_TRANSLATE);
      latestTranslateRef.current = PEEK_TRANSLATE;
    },
    [closeSheet]
  );

  const clearWheelSettleTimeout = useCallback(() => {
    if (wheelSettleTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(wheelSettleTimeoutRef.current);
      wheelSettleTimeoutRef.current = null;
    }
  }, []);

  const scheduleWheelSettle = useCallback(() => {
    if (typeof window === "undefined") {
      settleSheetPosition(latestTranslateRef.current);
      return;
    }
    clearWheelSettleTimeout();
    wheelSettleTimeoutRef.current = window.setTimeout(() => {
      wheelActiveRef.current = false;
      setIsDragging(false);
      settleSheetPosition(latestTranslateRef.current);
      wheelSettleTimeoutRef.current = null;
    }, WHEEL_SETTLE_DELAY_MS);
  }, [clearWheelSettleTimeout, settleSheetPosition]);

  useEffect(() => {
    return () => {
      clearWheelSettleTimeout();
      wheelActiveRef.current = false;
    };
  }, [clearWheelSettleTimeout]);

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

  const isInteractiveElement = useCallback((target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (!element) return false;
    const interactive = element.closest("button, a, input, textarea, select, [data-prevent-drag]");
    return Boolean(interactive);
  }, []);

  const shouldIgnoreDragTarget = (event: ReactPointerEvent<HTMLElement>) => {
    return isInteractiveElement(event.target);
  };

  const startDrag = useCallback(
    (pointerId: number, startY: number) => {
      if (dragStateRef.current.pointerId !== null) return;
      dragStateRef.current = {
        startY,
        startTranslate: sheetTranslate,
        pointerId
      };
      setIsDragging(true);
    },
    [sheetTranslate]
  );

  const updateDragFromClientY = useCallback((clientY: number) => {
    const dragState = dragStateRef.current;
    if (dragState.pointerId === null) return;

    const sheetEl = sheetRef.current;
    if (!sheetEl) return;

    const deltaY = clientY - dragState.startY;
    const sheetHeight = sheetEl.getBoundingClientRect().height || 1;
    const deltaPercent = (deltaY / sheetHeight) * 100;
    const next = clamp(dragState.startTranslate + deltaPercent, 0, 100);
    setSheetTranslate(next);
    latestTranslateRef.current = next;
  }, []);

  const endActiveDrag = useCallback(() => {
    if (dragStateRef.current.pointerId === null) return;
    setIsDragging(false);
    dragStateRef.current.pointerId = null;
    settleSheetPosition(latestTranslateRef.current);
  }, [settleSheetPosition]);

  const beginDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!isOpen) return;
      if (event.pointerType === "mouse" && event.buttons !== 1) return;
      if (shouldIgnoreDragTarget(event)) return;
      startDrag(event.pointerId, event.clientY);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [isOpen, shouldIgnoreDragTarget, startDrag]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const dragState = dragStateRef.current;
      if (dragState.pointerId !== event.pointerId) return;
      updateDragFromClientY(event.clientY);
    },
    [updateDragFromClientY]
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const dragState = dragStateRef.current;
      if (dragState.pointerId !== event.pointerId) return;

      const currentTarget = event.currentTarget as HTMLElement;
      if (currentTarget.hasPointerCapture?.(event.pointerId)) {
        currentTarget.releasePointerCapture(event.pointerId);
      }
      endActiveDrag();
    },
    [endActiveDrag]
  );

  const resetScrollDragState = useCallback(() => {
    scrollDragStateRef.current = {
      pointerId: null,
      startY: 0,
      startX: 0,
      active: false
    };
  }, []);

  const resetTouchDragState = useCallback(() => {
    touchDragStateRef.current = {
      identifier: null,
      startY: 0,
      startX: 0,
      active: false
    };
  }, []);

  const handleScrollablePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isOpen) return;
      if (dragStateRef.current.pointerId !== null) return;
      if (event.pointerType === "mouse" && event.buttons !== 1) return;
      if (event.pointerType === "touch") return;
      if (shouldIgnoreDragTarget(event)) return;

      resetScrollDragState();
      scrollDragStateRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startX: event.clientX,
        active: false
      };
    },
    [isOpen, resetScrollDragState, shouldIgnoreDragTarget]
  );

  const handleScrollablePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") {
        return;
      }
      if (dragStateRef.current.pointerId === event.pointerId) {
        updateDragFromClientY(event.clientY);
        return;
      }

      const scrollDragState = scrollDragStateRef.current;
      if (scrollDragState.pointerId !== event.pointerId) return;

      const container = event.currentTarget;
      if (container.scrollTop > SCROLL_TOP_EPSILON) {
        return;
      }

      const deltaY = event.clientY - scrollDragState.startY;
      if (deltaY <= 0) {
        return;
      }

      const deltaX = event.clientX - scrollDragState.startX;
      if (Math.abs(deltaY) < Math.abs(deltaX)) {
        return;
      }

      if (!scrollDragState.active && Math.abs(deltaY) < DRAG_ACTIVATION_THRESHOLD) {
        return;
      }

      if (dragStateRef.current.pointerId !== null) {
        return;
      }

      container.scrollTop = 0;
      scrollDragStateRef.current.startY = event.clientY;
      scrollDragStateRef.current.startX = event.clientX;
      scrollDragStateRef.current.active = true;
      if (!container.hasPointerCapture?.(event.pointerId)) {
        container.setPointerCapture(event.pointerId);
      }
      startDrag(event.pointerId, event.clientY);
      updateDragFromClientY(event.clientY);
    },
    [startDrag, updateDragFromClientY]
  );

  const handleScrollablePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") {
        return;
      }
      if (dragStateRef.current.pointerId === event.pointerId) {
        handlePointerEnd(event);
        resetScrollDragState();
        return;
      }

      const scrollDragState = scrollDragStateRef.current;
      if (scrollDragState.pointerId !== event.pointerId) return;

      if (scrollDragState.active) {
        handlePointerEnd(event);
      } else {
        const container = event.currentTarget;
        if (container.hasPointerCapture?.(event.pointerId)) {
          container.releasePointerCapture(event.pointerId);
        }
      }
      resetScrollDragState();
    },
    [handlePointerEnd, resetScrollDragState]
  );

  useEffect(() => {
    const container = scrollElement;
    if (!container) return;

    let active = true;

    const findTouchById = (touches: TouchList, identifier: number) => {
      for (let i = 0; i < touches.length; i += 1) {
        const touch = touches.item(i);
        if (touch && touch.identifier === identifier) {
          return touch;
        }
      }
      return null;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (!active || !isOpen) return;
      if (dragStateRef.current.pointerId !== null) return;
      const primaryTouch = event.touches[0];
      if (!primaryTouch) return;
      if (isInteractiveElement(event.target)) return;

      touchDragStateRef.current = {
        identifier: primaryTouch.identifier,
        startY: primaryTouch.clientY,
        startX: primaryTouch.clientX,
        active: false
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!active || !isOpen) return;
      const touchState = touchDragStateRef.current;
      if (touchState.identifier === null) return;
      const touch = findTouchById(event.touches, touchState.identifier);
      if (!touch) return;

      if (dragStateRef.current.pointerId === touchState.identifier) {
        event.preventDefault();
        updateDragFromClientY(touch.clientY);
        return;
      }

      const containerEl = scrollAreaRef.current;
      if (!containerEl || containerEl.scrollTop > SCROLL_TOP_EPSILON) {
        return;
      }

      const deltaY = touch.clientY - touchState.startY;
      if (deltaY <= 0) {
        return;
      }

      const deltaX = touch.clientX - touchState.startX;
      if (Math.abs(deltaY) < Math.abs(deltaX)) {
        return;
      }

      if (!touchState.active && Math.abs(deltaY) < DRAG_ACTIVATION_THRESHOLD) {
        return;
      }

      touchDragStateRef.current = {
        identifier: touch.identifier,
        startY: touch.clientY,
        startX: touch.clientX,
        active: true
      };
      startDrag(touch.identifier, touch.clientY);
      event.preventDefault();
      updateDragFromClientY(touch.clientY);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const touchState = touchDragStateRef.current;
      if (touchState.identifier === null) return;
      let ended = false;
      for (let i = 0; i < event.changedTouches.length; i += 1) {
        const touch = event.changedTouches.item(i);
        if (touch && touch.identifier === touchState.identifier) {
          ended = true;
          break;
        }
      }
      if (!ended) return;

      resetTouchDragState();
      if (dragStateRef.current.pointerId !== null) {
        endActiveDrag();
      }
    };

    const passiveOptions: AddEventListenerOptions = { passive: false };
    container.addEventListener("touchstart", handleTouchStart, passiveOptions);
    container.addEventListener("touchmove", handleTouchMove, passiveOptions);
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      active = false;
      container.removeEventListener("touchstart", handleTouchStart, passiveOptions);
      container.removeEventListener("touchmove", handleTouchMove, passiveOptions);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [endActiveDrag, isInteractiveElement, isOpen, resetTouchDragState, scrollElement, startDrag, updateDragFromClientY]);

  const handleScrollableWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!isOpen) return;
      if (dragStateRef.current.pointerId !== null) return;
      const container = event.currentTarget;
      if (container.scrollTop > SCROLL_TOP_EPSILON) {
        return;
      }
      if (event.deltaY >= 0) {
        return;
      }
      const sheetEl = sheetRef.current;
      if (!sheetEl) return;

      const sheetHeight = sheetEl.getBoundingClientRect().height || 1;
      const deltaPercent = ((-event.deltaY) / sheetHeight) * 100 * WHEEL_PULL_SENSITIVITY;
      const next = clamp(latestTranslateRef.current + deltaPercent, 0, 100);
      setSheetTranslate(next);
      latestTranslateRef.current = next;

      if (!wheelActiveRef.current) {
        wheelActiveRef.current = true;
        setIsDragging(true);
      }
      scheduleWheelSettle();
    },
    [isOpen, scheduleWheelSettle]
  );

  useEffect(() => {
    if (!isOpen) {
      resetScrollDragState();
      resetTouchDragState();
      dragStateRef.current.pointerId = null;
      wheelActiveRef.current = false;
      clearWheelSettleTimeout();
    }
  }, [clearWheelSettleTimeout, isOpen, resetScrollDragState, resetTouchDragState]);

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
    if (!spot) return null;
    const images = mediaItems.length > 0 ? mediaItems : [spot.imageUrl].filter(Boolean) as string[];
    if (images.length === 0) {
      return (
        <div className="sheet-media single" aria-label="イベント画像">
          <div className="media-title-fallback">
            <p>{spot.title}</p>
          </div>
        </div>
      );
    }

    if (images.length === 1) {
      return (
        <div className="sheet-media single" aria-label="イベント画像">
          <img src={images[0]} alt={spot.title} loading="lazy" />
        </div>
      );
    }

    return (
      <div className="sheet-media carousel" aria-roledescription="carousel">
        <div className="media-scroll" ref={mediaScrollRef} aria-live="polite">
          {images.map((url, index) => (
            <figure className="media-slide" key={`${url}-${index}`} aria-label={`${index + 1}/${images.length}`}>
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
          {images.map((_, index) => (
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
              className={`sheet-drag-region ${isDragging ? "dragging" : ""}`.trim()}
              onPointerDown={beginDrag}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            >
              <div className={`sheet-handle ${isDragging ? "active" : ""}`.trim()} aria-hidden="true" />
              <header className="sheet-top-bar">
                <div className="sheet-owner">
                  <Avatar name={spot.ownerDisplayName ?? spot.ownerId} photoUrl={spot.ownerPhotoUrl ?? undefined} size={36} />
                  <div className="sheet-owner-meta">
                    <p className="sheet-owner-name">
                      {spot.ownerDisplayName ?? spot.ownerId}
                      {spot.ownerPhoneVerified ? (
                        <span className="spot-owner-verified" title="SMS認証済み" aria-label="SMS認証済み">
                          <Icon name="sealCheck" size={18} color="#a3e635" label={undefined} />
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="sheet-actions">
                  <button type="button" className="icon-button" onClick={closeSheet} aria-label="閉じる" data-prevent-drag>
                    ✕
                  </button>
                </div>
              </header>
            </div>
            <div
              ref={assignScrollAreaRef}
              className="sheet-scroll-container"
              onPointerDown={handleScrollablePointerDown}
              onPointerMove={handleScrollablePointerMove}
              onPointerUp={handleScrollablePointerEnd}
              onPointerCancel={handleScrollablePointerEnd}
              onWheel={handleScrollableWheel}
            >
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
            </div>
          </>
        ) : (
          <div className="sheet-placeholder">イベントを選択してください。</div>
        )}
      </section>
    </div>
  );
};
