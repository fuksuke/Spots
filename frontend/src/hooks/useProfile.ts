import useSWR from "swr";
import { UserProfile } from "../types";

const fetcher = async ([endpoint, token]: [string, string]) => {
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch profile: ${res.status}`);
  }

  return (await res.json()) as UserProfile;
};

export const useProfile = (authToken?: string) => {
  const key = authToken?.trim() ? ["/api/profile", authToken.trim()] : null;
  const { data, error, isLoading, mutate } = useSWR<UserProfile>(key, fetcher, {
    revalidateOnFocus: false
  });

  return {
    profile: data ?? null,
    error,
    isLoading: authToken?.trim() ? isLoading : false,
    mutate
  };
};
