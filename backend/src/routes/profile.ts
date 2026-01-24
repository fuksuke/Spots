import { Router } from "express";

import { getProfileHandler, updateProfileHandler, verifyPhoneHandler, updateNotificationPreferencesHandler } from "../controllers/profileController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", requireAuth, getProfileHandler);
router.put("/", requireAuth, updateProfileHandler);
router.patch("/notification-preferences", requireAuth, updateNotificationPreferencesHandler);
router.post("/verify-phone", requireAuth, verifyPhoneHandler);

export default router;
