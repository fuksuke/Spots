import useSWR from "swr";
import { Spot } from "../types";

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

export const usePopularSpots = (limit = 5, authToken?: string) => {
  const key: [string, string | null] = [
    `/api/spots/popular?limit=${Math.max(1, Math.min(limit, 50))}`,
    authToken?.trim() ? authToken.trim() : null
  ];

  const { data, error, isLoading, mutate } = useSWR<Spot[]>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000
  });

  return {
    spots: data ?? [],
    error,
    isLoading,
    mutate
  };
};
