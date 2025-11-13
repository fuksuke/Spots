import type { SpotCategory } from "../types";

export type CategoryKey =
  | "top"
  | "coupon"
  | "entertainment"
  | "sports"
  | "gourmet"
  | "live"
  | "art"
  | "family"
  | "nightlife"
  | "shopping";

export type CategoryConfig = {
  label: string;
  color: string;
  spotCategory: SpotCategory | "all";
};

export const CATEGORY_CONFIG: Record<CategoryKey, CategoryConfig> = {
  top: { label: "トップ", color: "#0ea5e9", spotCategory: "all" },
  gourmet: { label: "グルメ", color: "#f97316", spotCategory: "cafe" },
  entertainment: { label: "エンタメ", color: "#f59e0b", spotCategory: "event" },
  sports: { label: "スポーツ", color: "#22d3ee", spotCategory: "sports" },
  coupon: { label: "クーポン", color: "#6366f1", spotCategory: "coupon" },
  live: { label: "ライブ", color: "#ef4444", spotCategory: "live" },
  art: { label: "アート", color: "#a855f7", spotCategory: "event" },
  family: { label: "ファミリー", color: "#14b8a6", spotCategory: "event" },
  nightlife: { label: "ナイトライフ", color: "#1d4ed8", spotCategory: "live" },
  shopping: { label: "ショッピング", color: "#f59e0b", spotCategory: "coupon" }
};

export const INITIAL_CATEGORY_KEYS: CategoryKey[] = [
  "top",
  "gourmet",
  "entertainment",
  "sports",
  "coupon",
  "live"
];

export const CATEGORY_DISPLAY_ORDER: CategoryKey[] = [
  ...INITIAL_CATEGORY_KEYS,
  "art",
  "family",
  "nightlife",
  "shopping"
];

const CATEGORY_STORAGE_KEY = "category-tabs:v1";

export const isCategoryKey = (value: unknown): value is CategoryKey =>
  typeof value === "string" && CATEGORY_DISPLAY_ORDER.includes(value as CategoryKey);

export const normalizeCategoryKeys = (keys: CategoryKey[]): CategoryKey[] => {
  const allowedKeys = new Set(CATEGORY_DISPLAY_ORDER);
  const uniqueKeys: CategoryKey[] = [];
  keys.forEach((key) => {
    if (allowedKeys.has(key) && !uniqueKeys.includes(key)) {
      uniqueKeys.push(key);
    }
  });
  if (!uniqueKeys.includes("top")) {
    uniqueKeys.unshift("top");
  }
  const ordered = CATEGORY_DISPLAY_ORDER.filter((key) => uniqueKeys.includes(key));
  return ordered.length > 0 ? ordered : INITIAL_CATEGORY_KEYS;
};

export const loadStoredCategoryKeys = (): CategoryKey[] => {
  if (typeof window === "undefined") {
    return INITIAL_CATEGORY_KEYS;
  }
  try {
    const raw = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!raw) {
      return INITIAL_CATEGORY_KEYS;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return INITIAL_CATEGORY_KEYS;
    }
    const filtered = parsed.filter((item): item is CategoryKey => isCategoryKey(item));
    if (filtered.length === 0) {
      return INITIAL_CATEGORY_KEYS;
    }
    return normalizeCategoryKeys(filtered as CategoryKey[]);
  } catch (error) {
    console.warn("Failed to load stored category tabs", error);
    return INITIAL_CATEGORY_KEYS;
  }
};

export const persistCategoryKeys = (keys: CategoryKey[]) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(keys));
  } catch (error) {
    console.warn("Failed to persist category tabs", error);
  }
};

export const mapCategoryKeyToSpotCategory = (
  key: CategoryKey
): SpotCategory | "all" | null => {
  const config = CATEGORY_CONFIG[key];
  return config?.spotCategory ?? null;
};
