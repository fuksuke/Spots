import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import {
  fetchSpotReports,
  updateSpotReportStatus,
  SpotReportStatus
} from "../services/spotReportService.js";
import { SchedulingRuleError } from "../services/posterProfileService.js";
import { ensureAdmin } from "../utils/admin.js";

const listQuerySchema = z.object({
  status: z.enum(["open", "resolved"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const listSpotReportsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    ensureAdmin(req);
    const { status, limit } = listQuerySchema.parse(req.query);
    const reports = await fetchSpotReports({ status, limit });
    res.json(reports);
  } catch (error) {
    if (error instanceof SchedulingRuleError) {
      return res.status(403).json({ message: error.message });
    }
    next(error);
  }
};

const updateBodySchema = z.object({
  status: z.enum(["open", "resolved"])
});

export const updateSpotReportStatusHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminUid = ensureAdmin(req);
    const { status } = updateBodySchema.parse(req.body);
    await updateSpotReportStatus(req.params.id, status as SpotReportStatus, adminUid);
    res.json({ status: "ok" });
  } catch (error) {
    if (error instanceof SchedulingRuleError) {
      return res.status(403).json({ message: error.message });
    }
    next(error);
  }
};
