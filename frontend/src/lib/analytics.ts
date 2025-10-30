import { captureSentryException, isSentryEnabled } from "./sentry";

const isBrowser = typeof window !== "undefined";

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;
const MIXPANEL_SCRIPT_ID = "mixpanel";
const MIXPANEL_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/mixpanel-browser@latest/build/mixpanel.min.js";
const GA4_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

export type AnalyticsPayload = Record<string, unknown>;

interface AnalyticsAdapters {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: Array<unknown>;
  mixpanel?: {
    track?: (event: string, properties?: Record<string, unknown>) => void;
    init?: (token: string, config?: Record<string, unknown>) => void;
    __loaded?: boolean;
  };
}

declare global {
  interface Window extends AnalyticsAdapters {}
}

const loadScriptOnce = (id: string, src: string) => {
  if (!isBrowser) return;
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.src = src;
  script.async = true;
  document.head.appendChild(script);
};

const pendingMixpanelEvents: Array<{ event: string; payload: AnalyticsPayload }> = [];

const flushMixpanelQueue = () => {
  if (!isBrowser) return;
  if (!window.mixpanel?.track) return;
  while (pendingMixpanelEvents.length > 0) {
    const { event, payload } = pendingMixpanelEvents.shift()!;
    window.mixpanel.track(event, payload);
  }
};

const initGA = () => {
  if (!isBrowser || !GA4_MEASUREMENT_ID) return;
  if (typeof window.gtag === "function") return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer!.push(args);
  };
  loadScriptOnce("ga4", `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`);
  window.gtag("js", new Date());
  window.gtag("config", GA4_MEASUREMENT_ID);
};

const initMixpanel = () => {
  if (!isBrowser || !MIXPANEL_TOKEN) return;
  if (window.mixpanel?.__loaded) return;

  const initialize = () => {
    if (!window.mixpanel || typeof window.mixpanel.init !== "function") {
      return false;
    }
    window.mixpanel.init(MIXPANEL_TOKEN, {
      debug: process.env.NODE_ENV !== "production"
    });
    window.mixpanel.__loaded = true;
    flushMixpanelQueue();
    return true;
  };

  if (initialize()) return;

  const existingScript = document.getElementById(MIXPANEL_SCRIPT_ID);
  if (existingScript instanceof HTMLScriptElement) {
    existingScript.addEventListener("load", () => {
      initialize();
    }, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.id = MIXPANEL_SCRIPT_ID;
  script.async = true;
  script.src = MIXPANEL_SCRIPT_URL;
  script.addEventListener("load", () => {
    initialize();
  }, { once: true });
  script.addEventListener("error", () => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analytics] Failed to load Mixpanel script from CDN");
    }
  }, { once: true });
  document.head.appendChild(script);
};

const dispatchToAdapters = (eventName: string, payload: AnalyticsPayload) => {
  if (!isBrowser) return;

  initGA();
  initMixpanel();

  if (typeof window.gtag === "function" && GA4_MEASUREMENT_ID) {
    window.gtag("event", eventName, payload);
  } else if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: eventName, ...payload });
  }

  if (window.mixpanel?.track) {
    window.mixpanel.track(eventName, payload);
  } else {
    pendingMixpanelEvents.push({ event: eventName, payload });
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[analytics] ${eventName}`, payload);
  }
};

export const trackEvent = (eventName: string, payload: AnalyticsPayload = {}) => {
  dispatchToAdapters(eventName, payload);
};

export const trackError = (eventName: string, error: unknown, payload: AnalyticsPayload = {}) => {
  const message = error instanceof Error ? error.message : String(error);
  if (isSentryEnabled()) {
    captureSentryException(error, { eventName, ...payload });
  }
  trackEvent(eventName, { ...payload, error: message });
};

export const trackPageView = (path: string, payload: AnalyticsPayload = {}) => {
  trackEvent("page_view", { path, ...payload });
};
