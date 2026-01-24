import type { Request } from "express";

import { SchedulingRuleError } from "../services/posterProfileService.js";

/**
 * Authenticated request type with uid and isAdmin properties
 */
export type AuthenticatedRequest = Request & {
  uid?: string;
  isAdmin?: boolean;
};

/**
 * Ensures the request is from an authenticated admin user.
 * Throws SchedulingRuleError if authentication or admin rights are missing.
 *
 * @param req - Express request object
 * @returns The authenticated user's UID
 * @throws SchedulingRuleError if not authenticated or not an admin
 */
export const ensureAdmin = (req: Request): string => {
  const uid = (req as AuthenticatedRequest).uid;
  if (!uid) {
    throw new SchedulingRuleError("Authentication required");
  }
  const isAdmin = (req as AuthenticatedRequest).isAdmin;
  if (!isAdmin) {
    throw new SchedulingRuleError("この操作には管理者権限が必要です。");
  }
  return uid;
};
