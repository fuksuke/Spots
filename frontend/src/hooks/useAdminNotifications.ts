import useSWR from "swr";
import { ADMIN_MOCK_MODE } from "../mocks/mockAdminData";

export type AdminNotification = {
    id: string;
    type: "report_created" | "spot_pending_review" | "system_alert";
    message: string;
    metadata?: Record<string, unknown>;
    created_at: string;
    read: boolean;
};

const fetcher = async ([endpoint, token]: [string, string]) => {
    const response = await fetch(endpoint, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    if (!response.ok) {
        throw new Error("Failed to fetch notifications");
    }
    return (await response.json()) as AdminNotification[];
};

export const useAdminNotifications = (authToken?: string) => {
    if (ADMIN_MOCK_MODE) {
        return {
            notifications: [] as AdminNotification[],
            unreadCount: 0,
            isLoading: false,
            markAsRead: async () => { },
            markAllAsRead: async () => { }
        };
    }

    const token = authToken?.trim();
    const key = token ? ["/api/admin/notifications", token] : null;

    const { data, error, isLoading, mutate } = useSWR<AdminNotification[]>(key, fetcher, {
        refreshInterval: 15000, // Poll every 15s
        revalidateOnFocus: true
    });

    const notifications = data ?? [];
    const unreadCount = notifications.filter((n) => !n.read).length;

    const markAsRead = async (id: string) => {
        if (!token) return;
        try {
            // Optimistic update
            await mutate(
                (current) =>
                    current?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? [],
                false
            );

            await fetch(`/api/admin/notifications/${id}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` }
            });

            void mutate();
        } catch (err) {
            console.error(err);
            void mutate(); // Revert on error
        }
    };

    const markAllAsRead = async () => {
        if (!token) return;
        try {
            await mutate(
                (current) => current?.map((n) => ({ ...n, read: true })) ?? [],
                false
            );

            await fetch(`/api/admin/notifications/all`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` }
            });

            void mutate();
        } catch (err) {
            console.error(err);
            void mutate();
        }
    };

    return {
        notifications,
        unreadCount,
        isLoading,
        error,
        markAsRead,
        markAllAsRead
    };
};
