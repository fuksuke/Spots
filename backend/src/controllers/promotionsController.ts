import type { Request, Response, NextFunction } from "express";

import { fetchActivePromotions } from "../services/scheduledSpotService.js";

export const listActivePromotionsHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const promotions = await fetchActivePromotions();
    res.json(promotions);
  } catch (error) {
    next(error);
  }
};
