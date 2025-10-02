import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { Spot } from "../types";

const fetcher = async ([endpoint, token]: [string, string | null]) => {
  const res = await fetch(endpoint, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`
        }
      : undefined
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch followed posts: ${res.status}`);
  }

  return (await res.json()) as Spot[];
};

export const useFollowedFeed = (authToken?: string, enabled = true, viewerId?: string | null) => {
  const key: [string, string | null] | null = enabled
    ? ["/api/followed_posts", authToken?.trim() ? authToken.trim() : null]
    : null;

  const cacheScope = useMemo(() => {
    if (viewerId) return `user:${viewerId}`;
    return authToken?.trim() ? "auth" : "anon";
  }, [authToken, viewerId]);

  const storageKey = useMemo(() => `followed-cache:${cacheScope}`, [cacheScope]);

  const fallbackData = useMemo(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Spot[]) : undefined;
    } catch {
      return undefined;
    }
  }, [enabled, storageKey]);

  const { data, error, isLoading, mutate } = useSWR<Spot[]>(key, fetcher, {
    fallbackData,
    revalidateOnFocus: false,
    suspense: false,
    keepPreviousData: true,
    dedupingInterval: 60_000
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !data) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data, enabled, storageKey]);

  return {
    data,
    error,
    isLoading: enabled ? isLoading : false,
    mutate
  };
};
