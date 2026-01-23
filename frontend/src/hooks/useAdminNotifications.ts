import { useEffect, useState, useCallback } from "react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ADMIN_MOCK_MODE, MOCK_ADMIN_NOTIFICATIONS } from "../mocks/mockAdminData";

type NotificationDoc = {
    user_id: string;
    title?: string;
    body?: string;
    read: boolean;
    created_at: { toDate: () => Date } | null;
    priority?: string;
    metadata?: {
        spotId?: string;
    };
};

export type AdminNotification = {
    id: string;
    docId: string;
    message: string;
    createdAt: string;
    spotId: string | null;
    priority: "high" | "standard";
};

export const useAdminNotifications = (userId: string | undefined) => {
    const [notifications, setNotifications] = useState<AdminNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // モックモード
    const isMockMode = ADMIN_MOCK_MODE;

    useEffect(() => {
        if (isMockMode) {
            setNotifications(MOCK_ADMIN_NOTIFICATIONS);
            setIsLoading(false);
            return;
        }

        if (!userId) {
            setNotifications([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const notificationsQuery = query(
            collection(db, "notifications"),
            where("user_id", "==", userId),
            where("read", "==", false),
            orderBy("created_at", "desc"),
            limit(10)
        );

        const unsubscribe = onSnapshot(
            notificationsQuery,
            (snapshot) => {
                const items = snapshot.docs.map((docSnap) => {
                    const data = docSnap.data() as NotificationDoc;
                    const createdAtValue =
                        data.created_at && typeof data.created_at.toDate === "function"
                            ? data.created_at.toDate().toISOString()
                            : new Date().toISOString();

                    return {
                        id: docSnap.id,
                        docId: docSnap.id,
                        message: typeof data.body === "string" ? data.body : typeof data.title === "string" ? data.title : "通知があります",
                        createdAt: createdAtValue,
                        spotId: data.metadata?.spotId ?? null,
                        priority: data.priority === "high" ? "high" : "standard"
                    } satisfies AdminNotification;
                });

                setNotifications(items);
                setIsLoading(false);
            },
            (error) => {
                console.warn("通知の取得に失敗しました", error);
                setNotifications([]);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [userId, isMockMode]);

    const dismissNotification = useCallback((notificationId: string) => {
        if (isMockMode) {
            setNotifications((current) => current.filter((n) => n.id !== notificationId));
            return;
        }
        void updateDoc(doc(db, "notifications", notificationId), { read: true });
        setNotifications((current) => current.filter((n) => n.id !== notificationId));
    }, [isMockMode]);

    const dismissAll = useCallback(() => {
        if (isMockMode) {
            setNotifications([]);
            return;
        }
        notifications.forEach((n) => {
            void updateDoc(doc(db, "notifications", n.docId), { read: true });
        });
        setNotifications([]);
    }, [notifications, isMockMode]);

    return { notifications, isLoading, dismissNotification, dismissAll };
};
