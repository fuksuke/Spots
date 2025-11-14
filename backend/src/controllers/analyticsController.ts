import type { Request, Response, NextFunction } from "express";

import { SchedulingRuleError } from "../services/posterProfileService.js";
import { fetchAnalyticsOverview } from "../services/analyticsService.js";

const ensureAdmin = (req: Request) => {
  const uid = (req as Request & { uid?: string }).uid;
  if (!uid) {
    throw new SchedulingRuleError("Authentication required");
  }
  const isAdmin = (req as Request & { isAdmin?: boolean }).isAdmin;
  if (!isAdmin) {
    throw new SchedulingRuleError("この操作には管理者権限が必要です。");
  }
  return uid;
};

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
