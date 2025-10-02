import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { Spot, SpotCategory } from "../types";

type SpotFeedParams = {
  category?: SpotCategory;
  followedUserIds?: string[];
};

const buildKey = (params?: SpotFeedParams) => {
  const search = new URLSearchParams();
  if (params?.category) {
    search.set("category", params.category);
  }
  if (params?.followedUserIds && params.followedUserIds.length > 0) {
    search.set("followedUserIds", params.followedUserIds.join(","));
  }
  const suffix = search.toString();
  return suffix ? `/api/spots?${suffix}` : "/api/spots";
};

export const useSpotFeed = (params?: SpotFeedParams, authToken?: string, viewerId?: string | null) => {
  const url = buildKey(params);
  const fetcher = async ([endpoint, token]: [string, string | null]) => {
    const res = await fetch(endpoint, {
      headers: token
        ? {
            Authorization: `Bearer ${token}`
          }
        : undefined
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch spots: ${res.status}`);
    }
    return (await res.json()) as Spot[];
  };

  const swrKey: [string, string | null] = [url, authToken?.trim() ? authToken.trim() : null];
  const cacheScope = useMemo(() => {
    if (viewerId) return `user:${viewerId}`;
    return authToken?.trim() ? "auth" : "anon";
  }, [authToken, viewerId]);

  const storageKey = useMemo(() => `spot-cache:${url}:${cacheScope}`, [url, cacheScope]);

  const fallbackData = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Spot[]) : undefined;
    } catch {
      return undefined;
    }
  }, [storageKey]);

  const { data, error, isLoading, mutate } = useSWR<Spot[]>(swrKey, fetcher, {
    fallbackData,
    revalidateOnFocus: false,
    suspense: false,
    keepPreviousData: true,
    dedupingInterval: 60_000
  });

  useEffect(() => {
    if (typeof window === "undefined" || !data) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      /* ignore quota errors */
    }
  }, [data, storageKey]);

  return { data, error, isLoading, mutate };
};
