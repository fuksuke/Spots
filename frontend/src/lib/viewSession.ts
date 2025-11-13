const STORAGE_KEY = "spot-view-session";

const generateSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getOrCreateViewSessionId = () => {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return generateSessionId();
  }
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const next = generateSessionId();
  window.localStorage.setItem(STORAGE_KEY, next);
  return next;
};
