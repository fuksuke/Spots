import useSWR from "swr";
import { ReviewTemplate } from "../types";

const fetcher = async ([endpoint, token]: [string, string]) => {
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch review templates: ${res.status}`);
  }

  return (await res.json()) as ReviewTemplate[];
};

export const useReviewTemplates = (authToken?: string) => {
  const key = authToken?.trim() ? ["/api/admin/scheduled_spots/review_templates", authToken.trim()] : null;
  const { data, error, isLoading, mutate } = useSWR<ReviewTemplate[]>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000
  });

  return {
    templates: data ?? [],
    error,
    isLoading: key ? isLoading : false,
    mutate
  };
};
