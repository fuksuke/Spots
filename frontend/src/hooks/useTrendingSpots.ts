import useSWR from "swr";
import type { Spot } from "../types";
import { mockSpots } from "../mockData";
import { calculateDistanceKm, calculateDistanceScoreMultiplier } from "../lib/geo";

const fetcher = async (url: string, authToken: string | null): Promise<Spot[]> => {
    const response = await fetch(url, {
        headers: authToken
            ? {
                Authorization: `Bearer ${authToken}`
            }
            : undefined
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch trending spots: ${response.status}`);
    }

    return response.json();
};

// Mock mode: Rising algorithm with distance bias
const getMockTrendingSpots = (limit: number, userLocation?: { lat: number; lng: number } | null): Spot[] => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Filter spots created in last 24 hours
    const recentSpots = mockSpots.filter((spot) => {
        const createdAt = new Date(spot.createdAt).getTime();
        return (now - createdAt) < oneDayMs;
    });

    // Sort by likes descending, adjusted by distance
    const scored = recentSpots.map(spot => {
        let score = spot.likes ?? 0;
        if (userLocation) {
            const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng);
            const multiplier = calculateDistanceScoreMultiplier(dist, 2.0);
            score *= multiplier;
        }
        return { spot, score };
    }).sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ spot }) => spot);
};

export const useTrendingSpots = (limit = 10, authToken: string | null, userLocation?: { lat: number; lng: number } | null) => {
    const useMock = import.meta.env.VITE_USE_MOCK_TILES === 'true';

    const { data, error, isLoading, mutate } = useSWR<Spot[]>(
        useMock ? null : [`/api/spots/trending?limit=${limit}&lat=${userLocation?.lat}&lng=${userLocation?.lng}`, authToken] as [string, string | null],
        useMock ? null : ([url, token]: [string, string | null]) => fetcher(url, token),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 120_000 // 2 minutes cache
        }
    );

    // Return mock data if enabled
    if (useMock) {
        return {
            spots: getMockTrendingSpots(limit, userLocation),
            isLoading: false,
            error: null,
            mutate
        };
    }

    return {
        spots: data ?? [],
        isLoading,
        error,
        mutate
    };
};
