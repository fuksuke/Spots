import useSWR from "swr";
import { mockSpots } from "../mockData";

export type Promotion = {
  id: string;
  spotId: string | null;
  ownerId: string;
  publishAt: string;
  expiresAt: string;
  headline: string | null;
  ctaUrl: string | null;
  imageUrl: string | null;
  priority: number;
};

const fetcher = async (endpoint: string): Promise<Promotion[]> => {
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch promotions: ${response.status}`);
  }
  return (await response.json()) as Promotion[];
};

// Mock promotions based on mock spots
const getMockPromotions = (): Promotion[] => {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Create 3 mock promotions from the first 3 spots
  return mockSpots.slice(0, 3).map((spot, index) => ({
    id: `promo-${spot.id}`,
    spotId: spot.id,
    ownerId: spot.ownerId,
    publishAt: now.toISOString(),
    expiresAt: tomorrow.toISOString(),
    headline: `【公式告知】${spot.title}`,
    ctaUrl: `https://example.com/events/${spot.id}`,
    imageUrl: spot.imageUrl ?? null,
    priority: 100 - index * 10
  }));
};

export const usePromotions = () => {
  const useMock = import.meta.env.VITE_USE_MOCK_TILES === 'true';

  const { data, error, isLoading, mutate } = useSWR<Promotion[]>(
    useMock ? null : "/api/promotions",
    useMock ? null : fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false
    }
  );

  // Return mock data if enabled
  if (useMock) {
    return {
      promotions: getMockPromotions(),
      error: null,
      isLoading: false,
      mutate
    };
  }

  return {
    promotions: data ?? [],
    error,
    isLoading,
    mutate
  };
};
