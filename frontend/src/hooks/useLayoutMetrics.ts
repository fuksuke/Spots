import { MutableRefObject, useEffect, useRef } from "react";

type UseLayoutMetricsOptions = {
  dependencies?: ReadonlyArray<unknown>;
};

const HEADER_SELECTOR = ".app-header.compact";
const TABS_SELECTOR = ".category-tabs";
const FOOTER_SELECTOR = ".action-bar";

const scheduleAnimation = (callback: () => void) => {
  if (typeof window === "undefined") return () => undefined;
  let rafId = requestAnimationFrame(callback);
  return () => cancelAnimationFrame(rafId);
};

const measureHeight = (element: Element | null): number =>
  element instanceof HTMLElement ? element.getBoundingClientRect().height : 0;

export const useLayoutMetrics = (
  rootRef: MutableRefObject<HTMLElement | null>,
  { dependencies = [] }: UseLayoutMetricsOptions = {}
) => {
  const baselineViewportRef = useRef<number | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") {
      return;
    }

    let cleanupAnimation: (() => void) | null = null;
    const activeObservers: ResizeObserver[] = [];

    const applyHeight = (property: string, value: number) => {
      root.style.setProperty(property, `${Math.max(0, Math.round(value))}px`);
    };

    const resolveViewportHeight = () => {
      if (typeof window === "undefined") return 0;
      const visualViewportHeight = window.visualViewport?.height;
      if (typeof visualViewportHeight === "number") {
        return visualViewportHeight;
      }
      return window.innerHeight || root.getBoundingClientRect().height || 0;
    };

    const updateKeyboardState = () => {
      if (typeof window === "undefined") return;
      const viewportHeight = resolveViewportHeight();
      if (baselineViewportRef.current === null || viewportHeight > baselineViewportRef.current) {
        baselineViewportRef.current = viewportHeight;
      }
      const baseline = baselineViewportRef.current ?? viewportHeight;
      const keyboardOffset = Math.max(baseline - viewportHeight, 0);
      const isFormField =
        document.activeElement instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
      const isKeyboardOpen = keyboardOffset > 80 && isFormField;

      root.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
      root.style.setProperty("--app-keyboard-offset", `${Math.round(keyboardOffset)}px`);
      root.classList.toggle("is-keyboard-open", isKeyboardOpen);
    };

    const updateMetrics = () => {
      const header = root.querySelector(HEADER_SELECTOR);
      const tabs = root.querySelector(TABS_SELECTOR);
      const footer = root.querySelector(FOOTER_SELECTOR);

      applyHeight("--app-header-height", measureHeight(header));
      applyHeight("--app-tabs-height", measureHeight(tabs));
      applyHeight("--app-footer-height", measureHeight(footer));
      updateKeyboardState();
    };

    const scheduleUpdate = () => {
      if (cleanupAnimation) {
        cleanupAnimation();
      }
      cleanupAnimation = scheduleAnimation(updateMetrics);
    };

    updateMetrics();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(scheduleUpdate);
      [HEADER_SELECTOR, TABS_SELECTOR, FOOTER_SELECTOR].forEach((selector) => {
        const element = root.querySelector(selector);
        if (element instanceof HTMLElement) {
          observer.observe(element);
        }
      });
      activeObservers.push(observer);
    }

    const handleWindowResize = () => scheduleUpdate();
    const handleViewportResize = () => scheduleUpdate();
    const handleFocusChange = () => scheduleUpdate();

    window.addEventListener("resize", handleWindowResize);
    window.addEventListener("focusin", handleFocusChange);
    window.addEventListener("focusout", handleFocusChange);

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportResize);
      window.visualViewport.addEventListener("scroll", handleViewportResize);
    }

    return () => {
      cleanupAnimation?.();
      activeObservers.forEach((observer) => observer.disconnect());
      window.removeEventListener("resize", handleWindowResize);
      window.removeEventListener("focusin", handleFocusChange);
      window.removeEventListener("focusout", handleFocusChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportResize);
        window.visualViewport.removeEventListener("scroll", handleViewportResize);
      }
    };
  }, [rootRef, ...dependencies]);
};
