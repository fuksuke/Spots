import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";

import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { SpotMediaGallery } from "./SpotMediaGallery";
import { Spot, SpotExternalLink } from "../types";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const PEEK_TRANSLATE = 45;
const EXPAND_THRESHOLD = 18;
const CLOSE_THRESHOLD = 70;
const CLOSE_ANIMATION_MS = 240;
const SCROLL_TOP_EPSILON = 2;
const DRAG_ACTIVATION_THRESHOLD = 6;
const WHEEL_PULL_SENSITIVITY = 0.55;
const WHEEL_SETTLE_DELAY_MS = 140;

export type SpotDetailSheetProps = {
  spot: Spot | null;
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (spot: Spot) => void;
  onShare?: (spot: Spot) => void;
};

export const SpotDetailSheet = ({
  spot,
  isOpen,
  onClose,
  onNotify,
  onShare
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

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, []);

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
    if (sheetTranslate > 0) {
      scrollAreaRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [sheetTranslate]);

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
      const atTop = container.scrollTop <= SCROLL_TOP_EPSILON;
      if (!atTop) {
        return;
      }

      const deltaY = event.clientY - scrollDragState.startY;
      const deltaX = event.clientX - scrollDragState.startX;
      if (Math.abs(deltaY) < Math.abs(deltaX)) {
        return;
      }

      const isExpanded = latestTranslateRef.current <= 0;
      if (isExpanded && deltaY < 0) {
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

      if (latestTranslateRef.current <= 0) {
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
      const deltaX = touch.clientX - touchState.startX;
      if (Math.abs(deltaY) < Math.abs(deltaX)) {
        return;
      }

      const isExpanded = latestTranslateRef.current <= 0;
      if (isExpanded && deltaY < 0) {
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
      const atTop = container.scrollTop <= SCROLL_TOP_EPSILON;
      const sheetEl = sheetRef.current;
      if (!sheetEl) return;

      const sheetHeight = sheetEl.getBoundingClientRect().height || 1;
      const magnitude = Math.abs(event.deltaY);
      if (magnitude === 0) {
        return;
      }

      const deltaPercent = (magnitude / sheetHeight) * 100 * WHEEL_PULL_SENSITIVITY;
      let next = latestTranslateRef.current;

      if (event.deltaY < 0) {
        if (next <= 0) {
          return;
        }
        next = clamp(next - deltaPercent, 0, 100);
      } else {
        if (!atTop && next <= 0) {
          return;
        }
        next = clamp(next + deltaPercent, 0, 100);
      }

      if (next === latestTranslateRef.current) {
        return;
      }

      event.preventDefault();
      container.scrollTop = 0;
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

  const handleDirections = useCallback(() => {
    if (!spot) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [spot]);

  const mediaGalleryUrls = useMemo(() => {
    if (!spot) return [];
    const urls: string[] = [];
    if (Array.isArray(spot.mediaUrls)) {
      spot.mediaUrls.forEach((url) => {
        if (typeof url === "string" && url.trim().length > 0) {
          urls.push(url);
        }
      });
    }
    if (urls.length === 0 && typeof spot.imageUrl === "string" && spot.imageUrl.trim().length > 0) {
      urls.push(spot.imageUrl);
    }
    return urls;
  }, [spot]);

  const externalLinks = useMemo<SpotExternalLink[]>(() => {
    if (!spot || !spot.externalLinks) return [];
    return spot.externalLinks.filter((link) => Boolean(link?.url)).map((link) => ({
      label: link.label,
      url: link.url,
      icon: link.icon ?? null
    }));
  }, [spot]);

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
              style={{ overflowY: sheetTranslate <= 0 ? "auto" : "hidden" }}
            >
              <div className="sheet-content">
                {mediaGalleryUrls.length > 0 ? (
                  <SpotMediaGallery title={spot.title} mediaUrls={mediaGalleryUrls} />
                ) : null}

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
