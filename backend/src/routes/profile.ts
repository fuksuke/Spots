import { Router } from "express";

import { getProfileHandler, updateProfileHandler } from "../controllers/profileController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", requireAuth, getProfileHandler);
router.put("/", requireAuth, updateProfileHandler);

export default router;
