import useSWR from "swr";

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

export const usePromotions = () => {
  const { data, error, isLoading, mutate } = useSWR<Promotion[]>("/api/promotions", fetcher, {
    dedupingInterval: 5 * 60 * 1000,
    revalidateOnFocus: false
  });

  return {
    promotions: data ?? [],
    error,
    isLoading,
    mutate
  };
};
