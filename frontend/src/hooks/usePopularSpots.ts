import useSWR from "swr";
import { Spot } from "../types";
import { mockSpots } from "../mockData";
import { calculateDistanceKm, calculateDistanceScoreMultiplier } from "../lib/geo";

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

// Mock mode: return sorted mock data with distance bias
const getMockPopularSpots = (limit: number, userLocation?: { lat: number; lng: number } | null): Spot[] => {
  // Sort by popularity (likes only) descending, adjusted by distance
  const sorted = [...mockSpots].map(spot => {
    let score = spot.likes ?? 0;

    if (userLocation) {
      const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng);
      const multiplier = calculateDistanceScoreMultiplier(dist, 2.0); // 2km threshold
      score *= multiplier;
    }

    return { spot, score };
  }).sort((a, b) => {
    return b.score - a.score;
  });

  return sorted.slice(0, limit).map(({ spot }, index) => ({
    ...spot,
    popularityRank: index + 1
  }));
};

export const usePopularSpots = (limit = 5, authToken?: string, userLocation?: { lat: number; lng: number } | null) => {
  const useMock = import.meta.env.VITE_USE_MOCK_TILES === 'true';

  const key: [string, string | null, string] = useMock
    ? null as any
    : [
      `/api/spots/popular?limit=${Math.max(1, Math.min(limit, 50))}&lat=${userLocation?.lat ?? ''}&lng=${userLocation?.lng ?? ''}`,
      authToken?.trim() ? authToken.trim() : null,
      'popular'
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
      spots: getMockPopularSpots(limit, userLocation),
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
