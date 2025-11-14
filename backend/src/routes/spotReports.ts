import { Router } from "express";

import { listSpotReportsHandler, updateSpotReportStatusHandler } from "../controllers/spotReportsController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);
router.get("/admin/spot_reports", listSpotReportsHandler);
router.patch("/admin/spot_reports/:id", updateSpotReportStatusHandler);

export default router;
