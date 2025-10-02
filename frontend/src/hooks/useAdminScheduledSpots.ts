import useSWR from "swr";
import { ScheduledSpot } from "./useScheduledSpots";

const fetcher = async ([endpoint, token]: [string, string]) => {
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch admin scheduled spots: ${res.status}`);
  }
  return (await res.json()) as ScheduledSpot[];
};

export const useAdminScheduledSpots = (authToken?: string, status = "pending") => {
  const key = authToken?.trim() ? [`/api/admin/scheduled_spots?status=${status}`, authToken.trim()] : null;
  const { data, error, isLoading, mutate } = useSWR<ScheduledSpot[]>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000
  });

  return {
    adminScheduledSpots: data ?? [],
    error,
    isLoading: key ? isLoading : false,
    mutate
  };
};
