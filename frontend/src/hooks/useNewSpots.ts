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
        throw new Error(`Failed to fetch new spots: ${response.status}`);
    }

    return response.json();
};

// Mock mode: Newest algorithm with distance bias
const getMockNewSpots = (limit: number, userLocation?: { lat: number; lng: number } | null): Spot[] => {
    const scored = mockSpots.map(spot => {
        let score = new Date(spot.createdAt).getTime();

        if (userLocation) {
            const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng);
            const multiplier = calculateDistanceScoreMultiplier(dist, 2.0);
            score = score * multiplier;
        }
        return { spot, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ spot }) => spot);
};

export const useNewSpots = (limit = 10, authToken: string | null, userLocation?: { lat: number; lng: number } | null) => {
    const useMock = import.meta.env.VITE_USE_MOCK_TILES === 'true';

    const { data, error, isLoading, mutate } = useSWR<Spot[]>(
        useMock ? null : [`/api/spots/new?limit=${limit}&lat=${userLocation?.lat}&lng=${userLocation?.lng}`, authToken] as [string, string | null],
        useMock ? null : ([url, token]: [string, string | null]) => fetcher(url, token),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 60_000 // 1 minute cache
        }
    );

    if (useMock) {
        return {
            spots: getMockNewSpots(limit, userLocation),
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
