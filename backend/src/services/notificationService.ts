import { firestore } from "./firebaseAdmin.js";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "../constants/collections.js";

const ADMIN_ALERTS_COLLECTION = COLLECTIONS.ADMIN_ALERTS;

export type AdminAlert = {
    id: string;
    type: "report_created" | "spot_pending_review" | "system_alert";
    message: string;
    metadata?: Record<string, unknown>;
    created_at: Timestamp;
    read: boolean;
};

export const notifyAdminOfReport = async (reportId: string, spotId: string, reason: string) => {
    // In a real application, this would trigger an email or Slack notification.
    // For MVP, we log to a collection that admins can check (or we build a UI for later).
    // We also log to console for development visibility.
    console.log(`[Admin Alert] New Report Created: ReportID=${reportId}, SpotID=${spotId}, Reason=${reason}`);

    await firestore.collection(ADMIN_ALERTS_COLLECTION).add({
        type: "report_created",
        message: `新規通報がありました: ${reason}`,
        metadata: {
            reportId,
            spotId,
            reason
        },
        created_at: Timestamp.now(),
        read: false
    });
};

export const notifyAdminOfPendingSpot = async (spotId: string, title: string) => {
    console.log(`[Admin Alert] New Spot Pending Review: SpotID=${spotId}, Title=${title}`);

    await firestore.collection(ADMIN_ALERTS_COLLECTION).add({
        type: "spot_pending_review",
        message: `審査待ちの新規スポット: ${title}`,
        metadata: {
            spotId,
            title
        },
        created_at: Timestamp.now(),
        read: false
    });
};

export const notifySystemAlert = async (message: string, metadata?: Record<string, unknown>) => {
    console.log(`[Admin System Alert] ${message}`, metadata);

    await firestore.collection(ADMIN_ALERTS_COLLECTION).add({
        type: "system_alert",
        message,
        metadata: metadata ?? {},
        created_at: Timestamp.now(),
        read: false
    });
};

export const fetchAdminNotifications = async (limit = 20, unreadOnly = false) => {
    let query = firestore
        .collection(ADMIN_ALERTS_COLLECTION)
        .orderBy("created_at", "desc");

    if (unreadOnly) {
        query = query.where("read", "==", false);
    }

    const snapshot = await query.limit(limit).get();
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        created_at: (doc.data().created_at as Timestamp).toDate().toISOString()
    }));
};

export const markNotificationRead = async (id: string) => {
    await firestore.collection(ADMIN_ALERTS_COLLECTION).doc(id).update({
        read: true
    });
};

export const markAllNotificationsRead = async () => {
    const snapshot = await firestore
        .collection(ADMIN_ALERTS_COLLECTION)
        .where("read", "==", false)
        .limit(500) // Batch limit precaution
        .get();

    if (snapshot.empty) return;

    const batch = firestore.batch();
    snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { read: true });
    });
    await batch.commit();
};
