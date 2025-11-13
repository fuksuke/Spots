import { useCallback, useState } from "react";

type UseSearchHistoryOptions = {
  maxEntries?: number;
};

const STORAGE_KEY = "search-history";

const loadHistory = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed.filter((item): item is string => typeof item === "string" && item.length > 0)) : [];
  } catch {
    return [];
  }
};

type ApplySearchResult =
  | { status: "applied"; query: string }
  | { status: "cleared" }
  | { status: "noop" };

export const useSearchHistory = ({ maxEntries = 8 }: UseSearchHistoryOptions = {}) => {
  const [searchValue, setSearchValue] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isSearchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadHistory());

  const persist = useCallback((entries: string[]) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  const openSearchOverlay = useCallback(() => {
    setSearchOverlayOpen(true);
    setSearchInput((current) => current || searchValue);
  }, [searchValue]);

  const closeSearchOverlay = useCallback(() => {
    setSearchOverlayOpen(false);
    setSearchInput(searchValue);
  }, [searchValue]);

  const applySearch = useCallback(
    (value: string, showMessage = true): ApplySearchResult => {
      const trimmed = value.trim();
      setSearchInput(trimmed);
      setSearchValue(trimmed);
      setSearchOverlayOpen(false);
      if (trimmed) {
        setRecentSearches((current) => {
          const next = [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, maxEntries);
          persist(next);
          return next;
        });
        return showMessage ? { status: "applied", query: trimmed } : { status: "noop" };
      }
      if (showMessage && searchValue) {
        return { status: "cleared" };
      }
      return { status: "noop" };
    },
    [maxEntries, persist, searchValue]
  );

  return {
    searchValue,
    searchInput,
    recentSearches,
    isSearchOverlayOpen,
    setSearchInput,
    openSearchOverlay,
    closeSearchOverlay,
    applySearch
  };
};

export type { ApplySearchResult };
