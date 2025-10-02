import { Router } from "express";

import { createCheckoutSessionHandler, createPortalSessionHandler } from "../controllers/billingController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/billing/create_checkout_session", requireAuth, createCheckoutSessionHandler);
router.post("/billing/create_portal_session", requireAuth, createPortalSessionHandler);

export default router;
