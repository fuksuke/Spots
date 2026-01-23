import useSWR from "swr";
import { ScheduledSpot } from "./useScheduledSpots";
import { ADMIN_MOCK_MODE, MOCK_SCHEDULED_SPOTS, MOCK_SCHEDULED_SPOTS_APPROVED } from "../mocks/mockAdminData";

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
  // モックモード
  if (ADMIN_MOCK_MODE) {
    const mockData = status === "approved" ? MOCK_SCHEDULED_SPOTS_APPROVED : MOCK_SCHEDULED_SPOTS;
    return {
      adminScheduledSpots: mockData,
      error: undefined,
      isLoading: false,
      mutate: async () => mockData
    };
  }

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
