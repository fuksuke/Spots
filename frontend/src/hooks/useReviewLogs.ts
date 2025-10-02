import useSWR from "swr";
import { ReviewLog } from "../types";

const fetcher = async ([endpoint, token]: [string, string]) => {
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch review logs: ${res.status}`);
  }

  return (await res.json()) as ReviewLog[];
};

export const useReviewLogs = (spotId: string | null, authToken?: string, limit = 20) => {
  const key = spotId && authToken?.trim() ? [`/api/admin/scheduled_spots/${spotId}/logs?limit=${limit}`, authToken.trim()] : null;
  const { data, error, isLoading, mutate } = useSWR<ReviewLog[]>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000
  });

  return {
    logs: data ?? [],
    error,
    isLoading: key ? isLoading : false,
    mutate
  };
};
