import useSWR from "swr";
import type { Spot } from "../types";
import { mockSpots } from "../mockData";

const fetcher = async (url: string, authToken: string | null): Promise<Spot[]> => {
  const response = await fetch(url, {
    headers: authToken
      ? {
          Authorization: `Bearer ${authToken}`
        }
      : undefined
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch trending new spots: ${response.status}`);
  }

  return response.json();
};

// Mock mode: return recent spots with high engagement
const getMockTrendingNewSpots = (limit: number): Spot[] => {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Filter spots created in last 24 hours (simulate by taking newest ones)
  const recentSpots = [...mockSpots]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, Math.min(15, mockSpots.length)); // Get top 15 newest

  // Calculate growth rate (likes + views * 0.5) / hours
  const scored = recentSpots.map((spot) => {
    const createdAt = new Date(spot.createdAt).getTime();
    const hoursAgo = Math.max((now - createdAt) / (60 * 60 * 1000), 0.5);
    const engagementScore = spot.likes + (spot.viewCount ?? 0) * 0.5;
    const growthRate = engagementScore / hoursAgo;

    return {
      spot,
      growthRate
    };
  });

  // Sort by growth rate descending
  scored.sort((a, b) => b.growthRate - a.growthRate);

  return scored.slice(0, limit).map(({ spot }) => spot);
};

export const useTrendingNewSpots = (limit = 10, authToken: string | null) => {
  const useMock = import.meta.env.VITE_USE_MOCK_TILES === 'true';

  const { data, error, isLoading, mutate } = useSWR<Spot[]>(
    useMock ? null : [`/api/spots/trending-new?limit=${limit}`, authToken],
    useMock ? null : ([url, token]) => fetcher(url, token),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 120_000 // 2 minutes cache
    }
  );

  // Return mock data if enabled
  if (useMock) {
    return {
      trendingNewSpots: getMockTrendingNewSpots(limit),
      isLoading: false,
      error: null,
      mutate
    };
  }

  return {
    trendingNewSpots: data ?? [],
    isLoading,
    error,
    mutate
  };
};
