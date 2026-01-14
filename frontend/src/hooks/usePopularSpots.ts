import useSWR from "swr";
import { Spot } from "../types";
import { mockSpots } from "../mockData";

const fetcher = async ([endpoint, token]: [string, string | null]) => {
  const response = await fetch(endpoint, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`
        }
      : undefined
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch popular spots: ${response.status}`);
  }

  return (await response.json()) as Spot[];
};

// Mock mode: return sorted mock data
const getMockPopularSpots = (limit: number): Spot[] => {
  // Sort by popularity (likes + views) descending
  const sorted = [...mockSpots].sort((a, b) => {
    const scoreA = a.likes + (a.viewCount ?? 0);
    const scoreB = b.likes + (b.viewCount ?? 0);
    return scoreB - scoreA;
  });

  return sorted.slice(0, limit).map((spot, index) => ({
    ...spot,
    popularityRank: index + 1,
    popularityScore: 100 - index * 5 // Mock scores descending
  }));
};

export const usePopularSpots = (limit = 5, authToken?: string) => {
  const useMock = import.meta.env.VITE_USE_MOCK_TILES === 'true';

  const key: [string, string | null] = useMock
    ? null as any
    : [
        `/api/spots/popular?limit=${Math.max(1, Math.min(limit, 50))}`,
        authToken?.trim() ? authToken.trim() : null
      ];

  const { data, error, isLoading, mutate } = useSWR<Spot[]>(
    key,
    useMock ? null : fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000
    }
  );

  // Return mock data if enabled
  if (useMock) {
    return {
      spots: getMockPopularSpots(limit),
      error: null,
      isLoading: false,
      mutate
    };
  }

  return {
    spots: data ?? [],
    error,
    isLoading,
    mutate
  };
};
