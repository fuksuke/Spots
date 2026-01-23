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
        throw new Error(`Failed to fetch buzz spots: ${response.status}`);
    }

    return response.json();
};

// Mock mode: Domestic Buzz (Sponsored / Large Scale Events)
const getMockBuzzSpots = (limit: number): Spot[] => {
    // Filter for sponsored/premium events only
    const sponsoredSpots = mockSpots.filter(spot => spot.premium === true);

    // Sort by likes as a proxy for engagement/size
    const sorted = sponsoredSpots.sort((a, b) => {
        return (b.likes ?? 0) - (a.likes ?? 0);
    });

    return sorted.slice(0, limit);
};

export const useBuzzSpots = (limit = 10, authToken: string | null) => {
    const useMock = import.meta.env.VITE_USE_MOCK_TILES === 'true';

    const { data, error, isLoading, mutate } = useSWR<Spot[]>(
        useMock ? null : [`/api/spots/buzz?limit=${limit}`, authToken] as [string, string | null],
        useMock ? null : ([url, token]: [string, string | null]) => fetcher(url, token),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 120_000
        }
    );

    if (useMock) {
        return {
            spots: getMockBuzzSpots(limit),
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
