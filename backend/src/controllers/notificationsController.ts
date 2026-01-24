import type { Request, Response, NextFunction } from "express";
import {
    fetchAdminNotifications,
    markNotificationRead,
    markAllNotificationsRead
} from "../services/notificationService.js";
import { extractUidFromAuthorization, InvalidAuthTokenError } from "../utils/auth.js";

// Helper to check admin status (since we don't have a shared middleware yet that sets req.isAdmin properly for all routes, or we reuse one)
// Assuming we use `requireAuth` and maybe checks custom claims or just UID whitelist in service if strict.
// For now, let's assume `requireAuth` populates `req.uid` and we might trust all authenticated users for MVP or check admin claims.
// Since `Admin` routes usually use `requireAuth`, let's just use service logic or simple check.
// In `scheduledSpotsController` we check `isAdmin` property which seems to come from middleware.

export const fetchNotificationsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Basic auth check
        const uid = (req as Request & { uid?: string }).uid;
        if (!uid) {
            return res.status(401).json({ message: "Authentication required" });
        }
        const isAdmin = (req as Request & { isAdmin?: boolean }).isAdmin;
        if (!isAdmin) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const { limit, unreadOnly } = req.query;
        const notifications = await fetchAdminNotifications(
            limit ? Number(limit) : 20,
            unreadOnly === "true"
        );
        res.json(notifications);
    } catch (error) {
        next(error);
    }
};

export const markReadHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isAdmin = (req as Request & { isAdmin?: boolean }).isAdmin;
        if (!isAdmin) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const { id } = req.params;
        if (id === "all") {
            await markAllNotificationsRead();
        } else {
            await markNotificationRead(id);
        }
        res.json({ status: "ok" });
    } catch (error) {
        next(error);
    }
};
