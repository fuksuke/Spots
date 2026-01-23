import useSWR from "swr";
import { ADMIN_MOCK_MODE, MOCK_ANALYTICS_OVERVIEW } from "../mocks/mockAdminData";

export type AnalyticsOverview = {
  timeRange: "24h";
  generatedAt: string;
  metrics: {
    activeUsers: number;
    avgMapDwellSeconds: number;
    avgScrollDepth: number;
    spotViews: number;
    reportsOpen: number;
  };
  trend: Array<{ timestamp: string; activeUsers: number; spotViews: number }>;
};

const fetcher = async ([endpoint, token]: [string, string]) => {
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? `Failed to fetch admin analytics (${response.status})`);
  }
  return (await response.json()) as AnalyticsOverview;
};

export const useAdminAnalytics = (authToken?: string | null) => {
  // モックモード
  if (ADMIN_MOCK_MODE) {
    return {
      overview: MOCK_ANALYTICS_OVERVIEW,
      error: undefined,
      isLoading: false,
      mutate: async () => MOCK_ANALYTICS_OVERVIEW
    };
  }

  const token = authToken?.trim();
  const key = token ? ["/api/admin/analytics/overview", token] : null;
  const { data, error, isLoading, mutate } = useSWR<AnalyticsOverview>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000
  });

  return {
    overview: data ?? null,
    error,
    isLoading: Boolean(key) ? isLoading : false,
    mutate
  };
};
