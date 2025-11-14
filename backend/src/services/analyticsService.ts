import { Timestamp } from "firebase-admin/firestore";

import { firestore } from "./firebaseAdmin.js";

type AnalyticsOverview = {
  timeRange: "24h";
  generatedAt: string;
  metrics: {
    activeUsers: number;
    avgMapDwellSeconds: number;
    avgScrollDepth: number;
    spotViews: number;
    reportsOpen: number;
  };
  trend: Array<{ timestamp: string; activeUsers: number; spotViews: number }>;
};

const HOURS_24_MS = 24 * 60 * 60 * 1000;

export const fetchAnalyticsOverview = async (): Promise<AnalyticsOverview> => {
  const now = Date.now();
  const since = now - HOURS_24_MS;

  // Spot views: count from scheduled log collection if available; fallback to spots aggregate
  let spotViews = 0;
  try {
    const snapshot = await firestore
      .collection("spot_view_logs")
      .where("created_at", ">=", Timestamp.fromMillis(since))
      .count()
      .get();
    spotViews = snapshot.data().count;
  } catch (error) {
    void error;
    const spotsSnapshot = await firestore.collection("spots").get();
    spotViews = spotsSnapshot.docs.reduce((acc, doc) => {
      const data = doc.data() as { view_count?: number };
      return acc + (data.view_count ?? 0);
    }, 0);
  }

  const reportsSnapshot = await firestore
    .collection("spot_reports")
    .where("status", "==", "open")
    .count()
    .get();

  const activeUserEstimate = Math.max(spotViews, 1);

  // Trend stub: hourly buckets with placeholder values derived from spotViews
  const trend: Array<{ timestamp: string; activeUsers: number; spotViews: number }> = [];
  const bucketCount = 6;
  for (let i = bucketCount - 1; i >= 0; i -= 1) {
    const bucketTime = new Date(now - (i * HOURS_24_MS) / bucketCount);
    const factor = (bucketCount - i) / bucketCount;
    trend.push({
      timestamp: bucketTime.toISOString(),
      activeUsers: Math.round(activeUserEstimate * factor * 0.1),
      spotViews: Math.round(spotViews * factor * 0.1)
    });
  }

  return {
    timeRange: "24h",
    generatedAt: new Date(now).toISOString(),
    metrics: {
      activeUsers: activeUserEstimate,
      avgMapDwellSeconds: 0,
      avgScrollDepth: 0,
      spotViews,
      reportsOpen: reportsSnapshot.data().count
    },
    trend
  } satisfies AnalyticsOverview;
};
