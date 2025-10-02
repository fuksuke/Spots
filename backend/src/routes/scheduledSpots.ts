import { Router } from "express";

import {
  cancelScheduledSpotHandler,
  createScheduledSpotHandler,
  listReviewTemplatesHandler,
  listScheduledSpotsForAdminHandler,
  listScheduledSpotsHandler,
  listScheduledSpotReviewLogsHandler,
  reviewScheduledSpotHandler,
  updateScheduledSpotHandler
} from "../controllers/scheduledSpotsController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/scheduled_spots", requireAuth, createScheduledSpotHandler);
router.get("/scheduled_spots", requireAuth, listScheduledSpotsHandler);
router.put("/scheduled_spots/:id", requireAuth, updateScheduledSpotHandler);
router.delete("/scheduled_spots/:id", requireAuth, cancelScheduledSpotHandler);
router.post("/scheduled_spots/:id/review", requireAuth, reviewScheduledSpotHandler);
router.get("/admin/scheduled_spots", requireAuth, listScheduledSpotsForAdminHandler);
router.get("/admin/scheduled_spots/review_templates", requireAuth, listReviewTemplatesHandler);
router.get("/admin/scheduled_spots/:id/logs", requireAuth, listScheduledSpotReviewLogsHandler);

export default router;
