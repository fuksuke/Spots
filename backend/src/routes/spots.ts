import { Router } from "express";

import {
  listSpotsHandler,
  createSpotHandler,
  getSpotDetailHandler,
  listCommentsHandler,
  createCommentHandler,
  likeSpotHandler,
  unlikeSpotHandler,
  popularSpotsHandler,
  trendingNewSpotsHandler,
  recordSpotViewHandler,
  reportSpotHandler,
  deleteSpotHandler
} from "../controllers/spotsController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { reportLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.get("/", listSpotsHandler);
router.post("/", requireAuth, createSpotHandler);
router.get("/popular", popularSpotsHandler);
router.get("/trending-new", trendingNewSpotsHandler);
router.get("/:id", getSpotDetailHandler);
router.get("/:id/comments", listCommentsHandler);
router.post("/:id/comments", requireAuth, createCommentHandler);
router.post("/:id/like", requireAuth, likeSpotHandler);
router.post("/:id/unlike", requireAuth, unlikeSpotHandler);
router.post("/:id/view", recordSpotViewHandler);
router.post("/:id/report", requireAuth, reportLimiter, reportSpotHandler);
router.delete("/:id", requireAuth, deleteSpotHandler);

export default router;
