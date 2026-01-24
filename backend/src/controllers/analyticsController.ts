import type { Request, Response, NextFunction } from "express";

import { SchedulingRuleError } from "../services/posterProfileService.js";
import { fetchAnalyticsOverview } from "../services/analyticsService.js";
import { ensureAdmin } from "../utils/admin.js";

export const getAnalyticsOverviewHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    ensureAdmin(req);
    const overview = await fetchAnalyticsOverview();
    res.json(overview);
  } catch (error) {
    if (error instanceof SchedulingRuleError) {
      return res.status(403).json({ message: error.message });
    }
    next(error);
  }
};
