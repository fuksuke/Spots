import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";

import "../styles/components/SpotDetailSheet.css";

import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { SpotMediaGallery } from "./SpotMediaGallery";
import { ModernHero, ModernHeroPlaceholder } from "./ModernHero";
import { ModernDetailList } from "./ModernDetailList";
import { Spot } from "../types";
import {
  buildExternalLinks,
  buildSpotCatchCopy,
  buildSpotDetailItems,
  formatSpotSchedule,
  splitSpotTitle
} from "../lib/spotPresentation";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const PEEK_TRANSLATE = 50;
const REPORT_CATEGORIES = [
  { value: "spam", label: "スパム・宣伝" },
  { value: "misinfo", label: "誤った情報" },
  { value: "inappropriate", label: "不適切な内容" },
  { value: "safety", label: "安全上の問題" },
  { value: "other", label: "その他" }
] as const;
const EXPAND_THRESHOLD = 18;
const CLOSE_THRESHOLD = 70;
const CLOSE_ANIMATION_MS = 240;
const SCROLL_TOP_EPSILON = 2;
const DRAG_ACTIVATION_THRESHOLD = 4;
const WHEEL_PULL_SENSITIVITY = 0.55;
const WHEEL_SETTLE_DELAY_MS = 140;

export type SpotDetailSheetProps = {
  spot: Spot | null;
  isOpen: boolean;
  onClose: () => void;
  onLike?: (spotId: string) => void;
  onShare?: (spot: Spot) => void;
  onOverlayToggle?: (open: boolean) => void;
};

export const SpotDetailSheet = ({
  spot,
  isOpen,
  onClose,
  onLike,
  onShare,
  onOverlayToggle
}: SpotDetailSheetProps) => {

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
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<string>(REPORT_CATEGORIES[0].value);
  const [reportDetails, setReportDetails] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

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
    if (!isOpen) {
      return;
    }
    setSheetTranslate(PEEK_TRANSLATE);
    setIsDragging(false);
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "auto" });
    setIsReportModalOpen(false);
    setReportDetails("");
    setReportCategory(REPORT_CATEGORIES[0].value);
  }, [isOpen, spot?.id]);

  useEffect(() => {
    onOverlayToggle?.(isReportModalOpen);
  }, [isReportModalOpen, onOverlayToggle]);

  useEffect(() => {
    return () => {
      onOverlayToggle?.(false);
    };
  }, [onOverlayToggle]);

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

  const shouldIgnoreDragTarget = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    return isInteractiveElement(event.target);
  }, [isInteractiveElement]);

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
        if (event.cancelable) event.preventDefault();
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
      if (event.cancelable) event.preventDefault();
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

  /**
   * Launch Apple Maps with the destination pre-filled. Many users on iOS
   * prefer Apple Maps so we offer this alongside Google Maps. When no
   * location data is present the button simply does nothing.
   */
  const handleAppleDirections = useCallback(() => {
    if (!spot) return;
    const url = `https://maps.apple.com/?daddr=${spot.lat},${spot.lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [spot]);

  const handleSubmitReport = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!spot || isSubmittingReport) return;
      setIsSubmittingReport(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 600));
        console.info("Report submitted", {
          spotId: spot.id,
          reportCategory,
          reportDetails
        });
        setIsReportModalOpen(false);
        setReportDetails("");
        setReportCategory(REPORT_CATEGORIES[0].value);
      } finally {
        setIsSubmittingReport(false);
      }
    },
    [isSubmittingReport, reportCategory, reportDetails, spot]
  );

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

  const hasMedia = mediaGalleryUrls.length > 0;
  const detailItems = useMemo(() => buildSpotDetailItems(spot), [spot]);
  const externalLinks = useMemo(() => buildExternalLinks(spot), [spot]);
  const scheduleLabel = useMemo(() => formatSpotSchedule(spot?.startTime, spot?.endTime ?? null), [spot?.endTime, spot?.startTime]);
  const { mainTitle, subTitle } = useMemo(() => splitSpotTitle(spot?.title ?? ""), [spot?.title]);
  const catchCopy = useMemo(() => buildSpotCatchCopy(spot), [spot]);

  const sheetMode = sheetTranslate <= EXPAND_THRESHOLD ? "expanded" : sheetTranslate >= 99 ? "closed" : "peek";

  const sheetClassName = [
    "spot-detail-sheet",
    isOpen ? "open" : "",
    isReportModalOpen ? "overlay-active" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={sheetClassName}
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
                  <Avatar name={spot.ownerDisplayName ?? spot.ownerId} photoUrl={spot.ownerPhotoUrl ?? undefined} size={28} />
                  <p className="sheet-owner-name">
                    {spot.ownerDisplayName ?? spot.ownerId}
                    {spot.ownerPhoneVerified ? (
                      <span className="spot-owner-verified" title="SMS認証済み" aria-label="SMS認証済み">
                        <Icon name="sealCheck" size={16} color="#a3e635" label={undefined} />
                      </span>
                    ) : null}
                  </p>
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
              <div className={`sheet-content ${hasMedia ? "has-media" : "no-media"}`.trim()}>
                <ModernHero
                  media={
                    hasMedia ? (
                      <SpotMediaGallery
                        title={spot.title}
                        mediaUrls={mediaGalleryUrls}
                        className="modern-hero-gallery"
                      />
                    ) : (
                      <ModernHeroPlaceholder label={(spot.category ?? "EVENT").toUpperCase()} />
                    )
                  }
                  socialButton={
                    <button type="button" className="modern-hero-social" aria-label="Instagram">
                      <Icon name="camera" size={22} />
                    </button>
                  }
                />

                <div className="modern-content">
                  <div className="modern-title-row">
                    <div className="modern-titles">
                      <h2 className="modern-title" id={`spot-detail-${spot.id}`}>
                        {mainTitle || spot.title}
                      </h2>
                      {subTitle ? <p className="modern-subtitle">{subTitle}</p> : null}
                    </div>
                    <div className="modern-stats">
                      <div className="metric view" aria-label="閲覧数">
                        <Icon name="eyesFill" size={18} />
                        <span>{(spot.viewCount ?? 0).toLocaleString("ja-JP")}</span>
                      </div>
                      <button
                        type="button"
                        className={`metric like ${spot.likedByViewer ? "liked" : ""}`.trim()}
                        aria-label="いいね"
                        onClick={() => onLike?.(spot.id)}
                      >
                        <Icon name="heart" size={18} color={spot.likedByViewer ? "#ef4444" : undefined} />
                        <span>{(spot.likes ?? 0).toLocaleString("ja-JP")}</span>
                      </button>
                    </div>
                  </div>
                  <div className="modern-schedule">{scheduleLabel}</div>
                  {catchCopy ? <div className="modern-catchcopy">{catchCopy}</div> : null}
                  {spot.description ? <p className="modern-description">{spot.description}</p> : null}
                  <div className="modern-map-buttons">
                    <button type="button" className="modern-google" onClick={handleDirections}>
                      Google Mapで経路を検索
                    </button>
                    <button type="button" className="modern-apple" onClick={handleAppleDirections}>
                      Apple Mapで経路を検索
                    </button>
                  </div>
                  {detailItems.length > 0 ? (
                    <>
                      <div className="modern-section-title">詳細</div>
                      <ModernDetailList items={detailItems} />
                    </>
                  ) : null}
                  {externalLinks.length > 0 ? (
                    <>
                      <div className="modern-section-title">関連リンク</div>
                      <div className="modern-social-icons">
                        {externalLinks.map((link) => (
                          <a
                            key={`${link.label}-${link.url}`}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                    </>
                  ) : null}
                  <div className="modern-bottom-actions">
                    <button type="button" onClick={() => onShare?.(spot)}>共有</button>
                    <button type="button" onClick={() => setIsReportModalOpen(true)}>通報</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="sheet-placeholder">イベントを選択してください。</div>
        )}
      </section>
      {isReportModalOpen ? (
        <div className="sheet-report-modal" role="dialog" aria-modal>
          <div className="sheet-report-modal__body">
            <header className="sheet-report-modal__header">
              <h3>このイベントを通報</h3>
              <button type="button" className="icon-button" onClick={() => setIsReportModalOpen(false)} aria-label="閉じる">
                ✕
              </button>
            </header>
            <form className="sheet-report-form" onSubmit={handleSubmitReport}>
              <label className="sheet-report-field">
                <span>カテゴリ</span>
                <select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}>
                  {REPORT_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sheet-report-field">
                <span>詳細 (任意)</span>
                <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} rows={3} />
              </label>
              <div className="sheet-report-actions">
                <button type="button" className="button subtle" onClick={() => setIsReportModalOpen(false)}>
                  キャンセル
                </button>
                <button type="submit" className="button danger" disabled={isSubmittingReport}>
                  {isSubmittingReport ? "送信中..." : "送信"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};
