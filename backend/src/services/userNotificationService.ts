import { Timestamp } from "firebase-admin/firestore";

import { COLLECTIONS } from "../constants/collections.js";
import { firestore } from "./firebaseAdmin.js";
import type { NotificationPreferences } from "./firestoreService.js";

/**
 * User notification types
 */
export type UserNotificationType =
    | "like"
    | "follow"
    | "new_post"
    | "post_approved"
    | "post_rejected"
    | "post_active"
    | "post_ended"
    | "admin_action";

/**
 * Notification priority levels
 */
export type NotificationPriority = "standard" | "high";

/**
 * Notification document structure in Firestore
 */
type NotificationDocument = {
    user_id: string;
    type: UserNotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    read: boolean;
    created_at: Timestamp;
    priority: NotificationPriority;
};

/**
 * Input for creating a notification
 */
export type CreateNotificationInput = {
    userId: string;
    type: UserNotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    priority?: NotificationPriority;
};

/**
 * Helper to check if a notification type is allowed by preferences
 */
const isNotificationAllowed = (type: UserNotificationType, preferences?: NotificationPreferences): boolean => {
    if (!preferences) return true; // Default to allow if no preferences set

    // Map internal types to preference keys
    switch (type) {
        case "like": return preferences.like ?? true;
        case "follow": return preferences.follow ?? true;
        case "new_post": return preferences.new_post ?? true;
        case "post_approved": return preferences.post_approved ?? true;
        case "post_rejected": return preferences.post_rejected ?? true;
        case "post_active": return preferences.post_active ?? true;
        case "admin_action": return preferences.admin_action ?? true;
        case "post_ended": return true; // currently no preference option for this
        default: return true;
    }
};

/**
 * Send a notification to a single user, checking preferences first
 */
export const sendNotification = async (input: CreateNotificationInput): Promise<string | null> => {
    // Check user preferences
    const userDoc = await firestore.collection(COLLECTIONS.USERS).doc(input.userId).get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data();
    const preferences = userData?.notification_preferences as NotificationPreferences | undefined;

    if (!isNotificationAllowed(input.type, preferences)) {
        return null; // Notification suppressed by user preference
    }

    const docRef = await firestore.collection(COLLECTIONS.NOTIFICATIONS).add({
        user_id: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        metadata: input.metadata ?? {},
        read: false,
        created_at: Timestamp.now(),
        priority: input.priority ?? "standard"
    } satisfies NotificationDocument);

    return docRef.id;
};

/**
 * Send notifications to multiple users (batch), filtering by preferences
 * Used for "new post from followed user" scenario
 */
export const sendBatchNotifications = async (
    userIds: string[],
    type: UserNotificationType,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
    priority?: NotificationPriority
): Promise<number> => {
    if (userIds.length === 0) {
        return 0;
    }

    const MAX_BATCH_SIZE = 500;
    const NOTIFICATION_DOCS_BATCH_SIZE = 100; // Fetch 100 user docs at a time

    // Chunk user IDs for fetching user profiles
    const userChunks: string[][] = [];
    for (let i = 0; i < userIds.length; i += NOTIFICATION_DOCS_BATCH_SIZE) {
        userChunks.push(userIds.slice(i, i + NOTIFICATION_DOCS_BATCH_SIZE));
    }

    const validNotificationDocs: NotificationDocument[] = [];
    const now = Timestamp.now();

    // 1. Prepare all valid notification notifications (filter by preferences)
    for (const chunk of userChunks) {
        const userRefs = chunk.map(id => firestore.collection(COLLECTIONS.USERS).doc(id));
        const userDocs = await firestore.getAll(...userRefs);

        for (const userDoc of userDocs) {
            if (!userDoc.exists) continue;

            const userData = userDoc.data();
            const preferences = userData?.notification_preferences as NotificationPreferences | undefined;

            if (isNotificationAllowed(type, preferences)) {
                validNotificationDocs.push({
                    user_id: userDoc.id,
                    type,
                    title,
                    body,
                    metadata: metadata ?? {},
                    read: false,
                    created_at: now,
                    priority: priority ?? "standard"
                });
            }
        }
    }

    // 2. Write to Firestore in batches
    let totalWritten = 0;

    for (let i = 0; i < validNotificationDocs.length; i += MAX_BATCH_SIZE) {
        const batchDocs = validNotificationDocs.slice(i, i + MAX_BATCH_SIZE);
        const batch = firestore.batch();

        for (const doc of batchDocs) {
            const docRef = firestore.collection(COLLECTIONS.NOTIFICATIONS).doc();
            batch.set(docRef, doc);
        }

        await batch.commit();
        totalWritten += batchDocs.length;
    }

    return totalWritten;
};

/**
 * Fetch follower IDs for a given user
 * Used to notify followers when user posts something
 */
export const fetchFollowerIds = async (userId: string, limit = 1000): Promise<string[]> => {
    // Followers are users who have `userId` in their `followed_user_ids` array
    const snapshot = await firestore
        .collection(COLLECTIONS.USERS)
        .where("followed_user_ids", "array-contains", userId)
        .limit(limit)
        .get();

    return snapshot.docs.map((doc) => doc.id);
};
