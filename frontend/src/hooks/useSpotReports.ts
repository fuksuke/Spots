import useSWR from "swr";

import { SpotReport, SpotReportStatus } from "../types";
import { ADMIN_MOCK_MODE, MOCK_SPOT_REPORTS, MOCK_SPOT_REPORTS_RESOLVED } from "../mocks/mockAdminData";

const fetcher = async ([endpoint, token]: [string, string]) => {
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? `Failed to fetch spot reports (${response.status})`);
  }
  return (await response.json()) as SpotReport[];
};

export const useSpotReports = (authToken?: string | null, status: SpotReportStatus = "open") => {
  // モックモード
  if (ADMIN_MOCK_MODE) {
    const mockData = status === "resolved" ? MOCK_SPOT_REPORTS_RESOLVED : MOCK_SPOT_REPORTS;
    return {
      spotReports: mockData,
      error: undefined,
      isLoading: false,
      mutate: async () => mockData
    };
  }

  const token = authToken?.trim();
  const key = token ? [`/api/admin/spot_reports?status=${status}`, token] : null;
  const { data, error, isLoading, mutate } = useSWR<SpotReport[]>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000
  });

  return {
    spotReports: data ?? [],
    error,
    isLoading: Boolean(key) ? isLoading : false,
    mutate
  };
};
