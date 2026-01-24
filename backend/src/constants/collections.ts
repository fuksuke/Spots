/**
 * Firestore collection names
 * Centralized to prevent typos and ensure consistency
 */
export const COLLECTIONS = {
  // Core entities
  USERS: "users",
  SPOTS: "spots",
  ARCHIVED_SPOTS: "archived_spots",
  COMMENTS: "comments",

  // Social interactions
  LIKES: "likes",
  COMMENT_LIKES: "comment_likes",

  // Scheduled/Moderation
  SCHEDULED_SPOTS: "scheduled_spots",
  SCHEDULED_SPOT_REVIEW_LOGS: "scheduled_spot_review_logs",
  SPOT_REPORTS: "spot_reports",

  // Promotions & Leaderboards
  PROMOTIONS: "promotions",
  LEADERBOARDS: "leaderboards",

  // Analytics & Monitoring
  SPOT_VIEW_LOGS: "spot_view_logs",
  SPOT_VIEW_SESSIONS: "spot_view_sessions",

  // Admin
  ADMIN_ALERTS: "admin_alerts",
  NOTIFICATIONS: "notifications",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
