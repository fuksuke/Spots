export const SPOT_CATEGORY_VALUES = ["live", "event", "cafe", "coupon", "sports"] as const;
export type SpotCategory = (typeof SPOT_CATEGORY_VALUES)[number];
export type ViewMode = "map" | "list";
export type PageMode = "home" | "trending";
export type ScheduledSpotStatus = "pending" | "approved" | "published" | "rejected" | "cancelled";
export type AnnouncementType = "short_term_notice" | "long_term_campaign";

export type Spot = {
  id: string;
  title: string;
  description: string;
  category: SpotCategory;
  lat: number;
  lng: number;
  startTime: string;
  endTime: string;
  imageUrl?: string | null;
  likes: number;
  commentsCount: number;
  ownerId: string;
  ownerDisplayName?: string | null;
  ownerPhotoUrl?: string | null;
  createdAt: string;
  likedByViewer?: boolean;
  followedByViewer?: boolean;
  favoritedByViewer?: boolean;
  popularityScore?: number;
  popularityRank?: number;
  ownerPhoneVerified?: boolean;
};

export type Coordinates = {
  lat: number;
  lng: number;
};

export type LikeMutationResult = {
  liked: boolean;
  likes: number;
};

export type Comment = {
  id: string;
  spotId: string;
  text: string;
  imageUrl?: string | null;
  ownerId: string;
  timestamp: string;
  likes: number;
  likedByViewer?: boolean;
};

export type CommentListResponse = {
  comments: Comment[];
  nextCursor?: string;
};

export type FollowMutationResult = {
  following: boolean;
  targetUserId: string;
};

export type CommentLikeMutationResult = {
  liked: boolean;
  likes: number;
};

export type FavoriteMutationResult = {
  favorited: boolean;
  spotId: string;
};

export type FollowedUser = {
  uid: string;
  displayName: string | null;
  photoUrl: string | null;
};

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  bio?: string | null;
  websiteUrl?: string | null;
  isPrivateAccount?: boolean;
  followedUserIds: string[];
  followedUsers: FollowedUser[];
  favoriteSpotIds: string[];
  favoriteSpots: Spot[];
  followedCategories: SpotCategory[];
  createdAt: string | null;
  posterTier: "tier_a" | "tier_b" | "tier_c";
  followersCount: number;
  engagementScore: number;
  promotionQuota: {
    shortTerm?: number;
    longTerm?: number;
  };
  promotionQuotaUpdatedAt: string | null;
  isVerified: boolean;
  isSponsor: boolean;
  stripeCustomerId: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
};

export type ReviewLog = {
  id: string;
  spotId: string;
  actorUid: string;
  actorEmail: string | null;
  previousStatus: ScheduledSpotStatus;
  nextStatus: "approved" | "rejected";
  reviewNotes: string | null;
  reviewTemplateId: string | null;
  createdAt: string;
};

export type ReviewTemplate = {
  id: string;
  label: string;
  status: "approved" | "rejected";
  defaultNotes: string;
  notificationHint: string;
  priority: "standard" | "high";
};
