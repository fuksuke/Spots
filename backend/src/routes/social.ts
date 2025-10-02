import { Router } from "express";

import {
  likeSpotActionHandler,
  unlikeSpotActionHandler,
  favoriteSpotActionHandler,
  unfavoriteSpotActionHandler,
  followUserActionHandler,
  unfollowUserActionHandler,
  followedPostsHandler,
  likeCommentActionHandler,
  unlikeCommentActionHandler
} from "../controllers/socialController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/like_spot", requireAuth, likeSpotActionHandler);
router.post("/unlike_spot", requireAuth, unlikeSpotActionHandler);
router.post("/favorite_spot", requireAuth, favoriteSpotActionHandler);
router.post("/unfavorite_spot", requireAuth, unfavoriteSpotActionHandler);
router.post("/follow_user", requireAuth, followUserActionHandler);
router.post("/unfollow_user", requireAuth, unfollowUserActionHandler);
router.get("/followed_posts", requireAuth, followedPostsHandler);
router.post("/comments/:id/like", requireAuth, likeCommentActionHandler);
router.post("/comments/:id/unlike", requireAuth, unlikeCommentActionHandler);

export default router;
