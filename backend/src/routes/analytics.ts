import { Router } from "express";

import { getAnalyticsOverviewHandler } from "../controllers/analyticsController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/admin/analytics/overview", requireAuth, getAnalyticsOverviewHandler);

export default router;
