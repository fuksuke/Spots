import type { Request, Response, NextFunction } from "express";

import { firebaseAuth } from "../services/firebaseAdmin.js";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header) {
      return res.status(401).json({ message: "Missing Authorization header" });
    }

    const token = header.replace("Bearer ", "").trim();
    const decoded = await firebaseAuth.verifyIdToken(token);
    (req as Request & { uid: string; isAdmin?: boolean }).uid = decoded.uid;
    if (decoded.admin === true) {
      (req as Request & { uid: string; isAdmin?: boolean }).isAdmin = true;
    }
    next();
  } catch (error) {
    next(error);
  }
};
