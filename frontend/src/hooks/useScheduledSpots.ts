import useSWR from "swr";
import { AnnouncementType, ScheduledSpotStatus, SpotCategory } from "../types";

export type ScheduledSpot = {
  id: string;
  title: string;
  description: string;
  category: SpotCategory;
  lat: number;
  lng: number;
  startTime: string;
  endTime: string;
  publishAt: string;
  announcementType: AnnouncementType;
  status: ScheduledSpotStatus;
  ownerId: string;
  imageUrl?: string | null;
  reviewNotes?: string | null;
};

const fetcher = async ([endpoint, token]: [string, string]) => {
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch scheduled spots: ${res.status}`);
  }
  return (await res.json()) as ScheduledSpot[];
};

export const useScheduledSpots = (authToken?: string) => {
  const key = authToken?.trim() ? ["/api/scheduled_spots", authToken.trim()] : null;
  const { data, error, isLoading, mutate } = useSWR<ScheduledSpot[]>(key, fetcher, {
    revalidateOnFocus: false
  });

  return {
    scheduledSpots: data ?? [],
    error,
    isLoading: key ? isLoading : false,
    mutate
  };
};
