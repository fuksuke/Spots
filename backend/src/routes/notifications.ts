import { Router } from "express";
import { fetchNotificationsHandler, markReadHandler } from "../controllers/notificationsController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/admin/notifications", requireAuth, fetchNotificationsHandler);
router.patch("/admin/notifications/:id", requireAuth, markReadHandler);

export default router;
