import { Router } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { firebaseAuth, firestore } from "../services/firebaseAdmin.js";
import { COLLECTIONS } from "../constants/collections.js";

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1)
});

router.post("/signup", async (req, res, next) => {
  try {
    const payload = signupSchema.parse(req.body);
    const userRecord = await firebaseAuth.createUser({
      email: payload.email,
      password: payload.password,
      displayName: payload.displayName
    });

    await firestore
      .collection(COLLECTIONS.USERS)
      .doc(userRecord.uid)
      .set({
        email: payload.email,
        display_name: payload.displayName,
        photo_url: null,
        followed_user_ids: [],
        favorite_spot_ids: [],
        followed_categories: [],
        created_at: Timestamp.now()
      });

    res.status(201).json({ uid: userRecord.uid });
  } catch (error) {
    next(error);
  }
});

const loginSchema = z.object({
  token: z.string()
});

router.post("/login", async (req, res, next) => {
  try {
    const { token } = loginSchema.parse(req.body);
    const decoded = await firebaseAuth.verifyIdToken(token);
    res.json({ uid: decoded.uid });
  } catch (error) {
    next(error);
  }
});

export default router;
