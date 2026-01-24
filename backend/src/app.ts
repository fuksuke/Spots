import cors from "cors";
import express from "express";

import { sentryErrorHandler, sentryRequestHandler } from "./monitoring/sentry.js";
import authRouter from "./routes/auth.js";
import billingRouter from "./routes/billing.js";
import mapTilesRouter from "./routes/mapTiles.js";
import profileRouter from "./routes/profile.js";
import promotionsRouter from "./routes/promotions.js";
import scheduledSpotsRouter from "./routes/scheduledSpots.js";
import socialRouter from "./routes/social.js";
import spotsRouter from "./routes/spots.js";
import spotReportsRouter from "./routes/spotReports.js";
import analyticsRouter from "./routes/analytics.js";
import notificationsRouter from "./routes/notifications.js";

export const createApp = () => {
  const app = express();
  app.use(sentryRequestHandler());
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      credentials: true
    })
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", authRouter);
  app.use("/api", socialRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api", scheduledSpotsRouter);
  app.use("/api", promotionsRouter);
  app.use("/api", billingRouter);
  app.use("/api", mapTilesRouter);
  app.use("/api/spots", spotsRouter);
  app.use("/api", spotReportsRouter);
  app.use("/api", analyticsRouter);
  app.use("/api", notificationsRouter);

  app.use(sentryErrorHandler());
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      void _next;
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  );

  return app;
};

export type AppType = ReturnType<typeof createApp>;
