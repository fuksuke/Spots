import { Router } from "express";

import { listActivePromotionsHandler } from "../controllers/promotionsController.js";

const router = Router();

router.get("/promotions", listActivePromotionsHandler);

export default router;
