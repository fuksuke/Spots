import useSWR from "swr";
import { useAuth } from "../providers/AuthProvider";

export type ArchivedSpot = {
    id: string;
    originalId: string;
    title: string;
    startTime: string;
    endTime: string;
    archivedAt: string;
};

const fetcher = async (url: string, token: string | null) => {
    if (!token) throw new Error("Authentication required");

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch archived spots: ${res.status}`);
    }

    return (await res.json()) as ArchivedSpot[];
};

export const useArchivedSpots = () => {
    const { currentUser, authToken } = useAuth();

    const { data, error, isLoading, mutate } = useSWR<ArchivedSpot[]>(
        currentUser ? ["/api/spots/archived", authToken] : null,
        ([url, t]: [string, string]) => fetcher(url, t),
        {
            revalidateOnFocus: false
        }
    );

    return {
        spots: data ?? [],
        isLoading,
        error,
        mutate
    };
};
