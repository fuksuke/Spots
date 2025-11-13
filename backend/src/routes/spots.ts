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
  recordSpotViewHandler
} from "../controllers/spotsController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", listSpotsHandler);
router.post("/", requireAuth, createSpotHandler);
router.get("/popular", popularSpotsHandler);
router.get("/:id", getSpotDetailHandler);
router.get("/:id/comments", listCommentsHandler);
router.post("/:id/comments", requireAuth, createCommentHandler);
router.post("/:id/like", requireAuth, likeSpotHandler);
router.post("/:id/unlike", requireAuth, unlikeSpotHandler);
router.post("/:id/view", recordSpotViewHandler);

export default router;
