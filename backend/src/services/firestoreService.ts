import { FieldValue, Timestamp } from "firebase-admin/firestore";

import type { SpotCategory } from "../constants/categories.js";

import { firestore } from "./firebaseAdmin.js";
import type { PosterTier } from "./posterProfileService.js";

type SpotInput = {
  title: string;
  description: string;
  category: SpotCategory;
  lat: number;
  lng: number;
  startTime: string;
  endTime: string;
  imageUrl?: string;
  ownerId: string;
};

type SpotFilter = {
  category?: SpotCategory;
  followedUserIds?: string[];
  viewerId?: string;
};

type SpotDocument = {
  title: string;
  description: string;
  category: SpotCategory;
  lat: number;
  lng: number;
  start_time: Timestamp;
  end_time: Timestamp;
  image_url?: string | null;
  owner_id: string;
  likes: number;
  comments_count: number;
  view_count: number;
  created_at: Timestamp;
};

export type SpotResponse = {
  id: string;
  title: string;
  description: string;
  category: SpotCategory;
  lat: number;
  lng: number;
  startTime: string;
  endTime: string;
  imageUrl?: string | null;
  ownerId: string;
  ownerDisplayName?: string | null;
  ownerPhotoUrl?: string | null;
  likes: number;
  commentsCount: number;
  viewCount: number;
  createdAt: string;
  likedByViewer?: boolean;
  followedByViewer?: boolean;
  favoritedByViewer?: boolean;
  ownerPhoneVerified?: boolean;
};

export type PopularSpotResponse = SpotResponse & {
  popularityScore: number;
  popularityRank: number;
};

type CommentDocument = {
  spot_id: string;
  text: string;
  image_url?: string | null;
  user_id: string;
  timestamp: Timestamp;
  likes: number;
};

export type CommentResponse = {
  id: string;
  spotId: string;
  text: string;
  imageUrl?: string | null;
  ownerId: string;
  timestamp: string;
  likes: number;
  likedByViewer?: boolean;
};

type CommentQueryOptions = {
  limit?: number;
  cursor?: string;
};

export type CommentListResponse = {
  comments: CommentResponse[];
  nextCursor?: string;
};

type UserDocument = {
  followed_user_ids?: string[];
  display_name?: string | null;
  email?: string | null;
  photo_url?: string | null;
  favorite_spot_ids?: string[];
  followed_categories?: string[];
  phone_verified?: boolean;
};

export type FollowMutationResult = {
  following: boolean;
  targetUserId: string;
};

type PopularSpotLeaderboardEntry = {
  spot_id: string;
  popularity_score: number;
  likes: number;
  comments_count: number;
  view_count?: number;
  rank: number;
  updated_at: Timestamp;
};

const toSpotResponse = (doc: FirebaseFirestore.QueryDocumentSnapshot<SpotDocument> | FirebaseFirestore.DocumentSnapshot<SpotDocument>): SpotResponse => {
  const data = doc.data();
  if (!data) {
    throw new Error("Spot document is missing data");
  }

  return {
    id: doc.id,
    title: data.title,
    description: data.description,
    category: data.category,
    lat: data.lat,
    lng: data.lng,
    startTime: data.start_time.toDate().toISOString(),
    endTime: data.end_time.toDate().toISOString(),
    imageUrl: data.image_url ?? null,
    ownerId: data.owner_id,
    ownerDisplayName: null,
    ownerPhotoUrl: null,
    likes: data.likes,
    commentsCount: data.comments_count,
    viewCount: data.view_count ?? 0,
    createdAt: data.created_at.toDate().toISOString(),
    ownerPhoneVerified: false
  };
};

const VIEW_SESSION_COLLECTION = "spot_view_sessions";
const VIEW_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VIEW_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

type SpotViewSessionDocument = {
  spot_id: string;
  viewer_hash: string;
  last_view: Timestamp;
  expire_at: Timestamp;
};

const sanitizeSpotIds = (ids: unknown): string[] => {
  if (!Array.isArray(ids)) return [];
  return ids.map((value) => (typeof value === "string" ? value.trim() : "")).filter((value) => value.length > 0);
};

const enrichSpotsForViewer = async (spots: SpotResponse[], viewerId?: string) => {
  if (spots.length === 0) {
    return spots;
  }

  let likedSpotIds = new Set<string>();
  let followedOwnerIds = new Set<string>();
  let favoriteSpotIds = new Set<string>();

  if (viewerId) {
    const [likesSnapshot, userSnapshot] = await Promise.all([
      firestore
        .collection("likes")
        .where("user_id", "==", viewerId)
        .limit(500)
        .get(),
      firestore.collection("users").doc(viewerId).get()
    ]);

    likedSpotIds = new Set(likesSnapshot.docs.map((doc) => (doc.data() as { spot_id: string }).spot_id));
    const userData = (userSnapshot.data() as UserDocument) ?? {};
    followedOwnerIds = new Set(sanitizeFollowedUserIds(userData.followed_user_ids));
    favoriteSpotIds = new Set(sanitizeSpotIds(userData.favorite_spot_ids));
  }

  const uniqueOwnerIds = Array.from(new Set(spots.map((spot) => spot.ownerId)));
  const ownerDocs = uniqueOwnerIds.length > 0 ? await firestore.getAll(...uniqueOwnerIds.map((id) => firestore.collection("users").doc(id))) : [];
  const ownerDisplayNameMap = new Map<string, string | null>();
  const ownerPhotoUrlMap = new Map<string, string | null>();
  const ownerPhoneVerifiedMap = new Map<string, boolean>();
  ownerDocs.forEach((doc) => {
    if (doc.exists) {
      const data = doc.data() as UserDocument;
      ownerDisplayNameMap.set(doc.id, typeof data.display_name === "string" ? data.display_name : null);
      ownerPhotoUrlMap.set(doc.id, typeof data.photo_url === "string" ? data.photo_url : null);
      ownerPhoneVerifiedMap.set(doc.id, Boolean(data.phone_verified));
    }
  });

  return spots.map((spot) => ({
    ...spot,
    likedByViewer: viewerId ? likedSpotIds.has(spot.id) : spot.likedByViewer,
    followedByViewer: viewerId ? followedOwnerIds.has(spot.ownerId) : spot.followedByViewer,
    favoritedByViewer: viewerId ? favoriteSpotIds.has(spot.id) : spot.favoritedByViewer,
    ownerDisplayName: ownerDisplayNameMap.get(spot.ownerId) ?? spot.ownerDisplayName ?? null,
    ownerPhotoUrl: ownerPhotoUrlMap.get(spot.ownerId) ?? spot.ownerPhotoUrl ?? null,
    ownerPhoneVerified: ownerPhoneVerifiedMap.has(spot.ownerId)
      ? Boolean(ownerPhoneVerifiedMap.get(spot.ownerId))
      : Boolean(spot.ownerPhoneVerified)
  }));
};

type OwnerMetrics = {
  tier?: PosterTier;
  followersCount?: number;
  isSponsor?: boolean;
};

export const calculatePopularityScore = (spot: SpotResponse, ownerMetrics?: OwnerMetrics) => {
  const now = Date.now();
  const startTime = new Date(spot.startTime).getTime();
  const endTime = new Date(spot.endTime).getTime();

  const likesWeight = 3;
  const viewsWeight = 1.2;
  const commentsWeight = 0.8;

  const engagementScore = spot.likes * likesWeight + (spot.viewCount ?? 0) * viewsWeight + spot.commentsCount * commentsWeight;

  let recencyMultiplier = 1;
  if (now >= startTime && now <= endTime) {
    // Live events should dominate the leaderboard.
    recencyMultiplier = 1.6;
  } else if (now < startTime) {
    const hoursUntil = (startTime - now) / (60 * 60 * 1000);
    if (hoursUntil <= 2) {
      recencyMultiplier = 1.4;
    } else if (hoursUntil <= 6) {
      recencyMultiplier = 1.25;
    } else if (hoursUntil <= 24) {
      recencyMultiplier = 1.1;
    }
  } else if (now > endTime) {
    const hoursSince = (now - endTime) / (60 * 60 * 1000);
    recencyMultiplier = Math.max(0.45, 1 - hoursSince / 24);
  }

  const followers = ownerMetrics?.followersCount ?? 0;
  const tier = ownerMetrics?.tier ?? "tier_c";
  const isSponsor = ownerMetrics?.isSponsor ?? false;

  const followerBoost = Math.log10(followers + 1) * 8;
  const tierBoost = tier === "tier_a" ? 18 : tier === "tier_b" ? 9 : 0;
  const sponsorBoost = isSponsor ? 12 : 0;
  const categoryBoost = spot.category === "event" ? 4 : 0;

  return engagementScore * recencyMultiplier + followerBoost + tierBoost + sponsorBoost + categoryBoost;
};

export const fetchSpots = async ({ category, followedUserIds, viewerId }: SpotFilter) => {
  let query: FirebaseFirestore.Query<SpotDocument> = firestore
    .collection("spots")
    .orderBy("start_time", "desc") as FirebaseFirestore.Query<SpotDocument>;

  if (category) {
    query = query.where("category", "==", category) as FirebaseFirestore.Query<SpotDocument>;
  }

  if (followedUserIds && followedUserIds.length > 0) {
    query = query.where("owner_id", "in", followedUserIds.slice(0, 10)) as FirebaseFirestore.Query<SpotDocument>;
  }

  const snapshot = await query.limit(50).get();
  const responses = snapshot.docs.map((doc) => toSpotResponse(doc));
  return enrichSpotsForViewer(responses, viewerId);
};

export const createSpot = async (spot: SpotInput) => {
  const now = Timestamp.now();
  const docRef = await firestore.collection("spots").add({
    title: spot.title,
    description: spot.description,
    category: spot.category,
    lat: spot.lat,
    lng: spot.lng,
    start_time: Timestamp.fromDate(new Date(spot.startTime)),
    end_time: Timestamp.fromDate(new Date(spot.endTime)),
    image_url: spot.imageUrl ?? null,
    owner_id: spot.ownerId,
    likes: 0,
    comments_count: 0,
    view_count: 0,
    created_at: now
  });

  return {
    id: docRef.id,
    title: spot.title,
    description: spot.description,
    category: spot.category,
    lat: spot.lat,
    lng: spot.lng,
    startTime: spot.startTime,
    endTime: spot.endTime,
    imageUrl: spot.imageUrl ?? null,
    ownerId: spot.ownerId,
    ownerDisplayName: null,
    ownerPhotoUrl: null,
    likes: 0,
    commentsCount: 0,
    viewCount: 0,
    createdAt: now.toDate().toISOString(),
    ownerPhoneVerified: false
  } satisfies SpotResponse;
};

export const fetchSpotById = async (id: string, viewerId?: string) => {
  const doc = (await firestore.collection("spots").doc(id).get()) as FirebaseFirestore.DocumentSnapshot<SpotDocument>;
  if (!doc.exists) return null;
  const spot = toSpotResponse(doc);
  const [enriched] = await enrichSpotsForViewer([spot], viewerId);
  return enriched ?? spot;
};

export const fetchComments = async (spotId: string, options?: CommentQueryOptions, viewerId?: string): Promise<CommentListResponse> => {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
  let query = firestore
    .collection("comments")
    .where("spot_id", "==", spotId)
    .orderBy("timestamp", "desc")
    .limit(limit) as FirebaseFirestore.Query<CommentDocument>;

  if (options?.cursor) {
    const cursorSnapshot = await firestore.collection("comments").doc(options.cursor).get();
    if (cursorSnapshot.exists) {
      query = query.startAfter(cursorSnapshot) as FirebaseFirestore.Query<CommentDocument>;
    }
  }

  const snapshot = await query.get();

  let comments = snapshot.docs.map((doc) => {
    const data = doc.data() as CommentDocument;
    return {
      id: doc.id,
      spotId: data.spot_id,
      text: data.text,
      imageUrl: data.image_url ?? null,
      ownerId: data.user_id,
      timestamp: data.timestamp.toDate().toISOString(),
      likes: data.likes,
      likedByViewer: false as boolean
    } satisfies CommentResponse;
  });

  const lastDoc = snapshot.docs[snapshot.docs.length - 1];
  const nextCursor = snapshot.size === limit && lastDoc ? lastDoc.id : undefined;

  if (viewerId && comments.length > 0) {
    const likeDocRefs = comments.map((comment) => firestore.collection("comment_likes").doc(`${viewerId}_${comment.id}`));
    const likeSnapshots = await firestore.getAll(...likeDocRefs);

    const likedCommentIds = new Set<string>();
    likeSnapshots.forEach((doc) => {
      if (doc.exists) {
        const data = doc.data() as { comment_id: string } | undefined;
        if (data?.comment_id) {
          likedCommentIds.add(data.comment_id);
        }
      }
    });

    comments = comments.map((comment) => ({
      ...comment,
      likedByViewer: likedCommentIds.has(comment.id)
    }));
  }

  return {
    comments,
    nextCursor
  } satisfies CommentListResponse;
};

type CommentInput = {
  text: string;
  imageUrl?: string;
  ownerId: string;
};

export const createComment = async (spotId: string, comment: CommentInput) => {
  const timestamp = Timestamp.now();
  const doc = await firestore.collection("comments").add({
    spot_id: spotId,
    text: comment.text,
    image_url: comment.imageUrl ?? null,
    user_id: comment.ownerId,
    timestamp,
    likes: 0
  });

  await firestore.collection("spots").doc(spotId).update({
    comments_count: FieldValue.increment(1)
  });

  return {
    id: doc.id,
    spotId,
    text: comment.text,
    imageUrl: comment.imageUrl ?? null,
    ownerId: comment.ownerId,
    timestamp: timestamp.toDate().toISOString(),
    likes: 0,
    likedByViewer: false as boolean
  } satisfies CommentResponse;
};

export type LikeMutationResult = {
  liked: boolean;
  likes: number;
};

export type CommentLikeMutationResult = {
  liked: boolean;
  likes: number;
};

export const likeSpot = async (spotId: string, userId: string): Promise<LikeMutationResult> => {
  const spotRef = firestore.collection("spots").doc(spotId);
  const likeRef = firestore.collection("likes").doc(`${userId}_${spotId}`);

  return firestore.runTransaction(async (transaction) => {
    const spotSnapshot = await transaction.get(spotRef);
    if (!spotSnapshot.exists) {
      throw new Error("Spot not found");
    }

    const currentLikes = (spotSnapshot.data()?.likes ?? 0) as number;
    const likeSnapshot = await transaction.get(likeRef);

    if (likeSnapshot.exists) {
      return { liked: true, likes: currentLikes } satisfies LikeMutationResult;
    }

    transaction.set(likeRef, { user_id: userId, spot_id: spotId, created_at: Timestamp.now() });
    transaction.update(spotRef, { likes: currentLikes + 1 });

    return { liked: true, likes: currentLikes + 1 } satisfies LikeMutationResult;
  });
};

export const unlikeSpot = async (spotId: string, userId: string): Promise<LikeMutationResult> => {
  const spotRef = firestore.collection("spots").doc(spotId);
  const likeRef = firestore.collection("likes").doc(`${userId}_${spotId}`);

  return firestore.runTransaction(async (transaction) => {
    const spotSnapshot = await transaction.get(spotRef);
    if (!spotSnapshot.exists) {
      throw new Error("Spot not found");
    }

    const currentLikes = (spotSnapshot.data()?.likes ?? 0) as number;
    const likeSnapshot = await transaction.get(likeRef);

    if (!likeSnapshot.exists) {
      return { liked: false, likes: currentLikes } satisfies LikeMutationResult;
    }

    const nextLikes = Math.max(currentLikes - 1, 0);
    transaction.delete(likeRef);
    transaction.update(spotRef, { likes: nextLikes });

    return { liked: false, likes: nextLikes } satisfies LikeMutationResult;
  });
};

type FollowedPostsOptions = {
  limit?: number;
};

const sanitizeFollowedUserIds = (ids: unknown): string[] => {
  if (!Array.isArray(ids)) return [];
  return ids.map((value) => (typeof value === "string" ? value.trim() : "")).filter((value) => value.length > 0);
};

export const likeComment = async (commentId: string, userId: string): Promise<CommentLikeMutationResult> => {
  const commentRef = firestore.collection("comments").doc(commentId);
  const likeRef = firestore.collection("comment_likes").doc(`${userId}_${commentId}`);

  return firestore.runTransaction(async (transaction) => {
    const commentSnapshot = await transaction.get(commentRef);
    if (!commentSnapshot.exists) {
      throw new Error("Comment not found");
    }

    const data = commentSnapshot.data() as CommentDocument;
    const likeSnapshot = await transaction.get(likeRef);

    if (likeSnapshot.exists) {
      return { liked: true, likes: data.likes } satisfies CommentLikeMutationResult;
    }

    transaction.set(likeRef, {
      user_id: userId,
      comment_id: commentId,
      created_at: Timestamp.now()
    });
    transaction.update(commentRef, { likes: data.likes + 1 });

    return { liked: true, likes: data.likes + 1 } satisfies CommentLikeMutationResult;
  });
};

export const unlikeComment = async (commentId: string, userId: string): Promise<CommentLikeMutationResult> => {
  const commentRef = firestore.collection("comments").doc(commentId);
  const likeRef = firestore.collection("comment_likes").doc(`${userId}_${commentId}`);

  return firestore.runTransaction(async (transaction) => {
    const commentSnapshot = await transaction.get(commentRef);
    if (!commentSnapshot.exists) {
      throw new Error("Comment not found");
    }

    const data = commentSnapshot.data() as CommentDocument;
    const likeSnapshot = await transaction.get(likeRef);

    if (!likeSnapshot.exists) {
      return { liked: false, likes: data.likes } satisfies CommentLikeMutationResult;
    }

    const nextLikes = Math.max(data.likes - 1, 0);
    transaction.delete(likeRef);
    transaction.update(commentRef, { likes: nextLikes });

    return { liked: false, likes: nextLikes } satisfies CommentLikeMutationResult;
  });
};

export const followUser = async (userId: string, targetUserId: string): Promise<FollowMutationResult> => {
  if (userId === targetUserId) {
    throw new Error("Cannot follow yourself");
  }

  const userRef = firestore.collection("users").doc(userId);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const data = snapshot.exists ? ((snapshot.data() as UserDocument) ?? {}) : {};
    const followedIds = new Set(sanitizeFollowedUserIds(data.followed_user_ids));

    if (followedIds.has(targetUserId)) {
      return { following: true, targetUserId } satisfies FollowMutationResult;
    }

    transaction.set(
      userRef,
      {
        followed_user_ids: FieldValue.arrayUnion(targetUserId)
      },
      { merge: true }
    );

    return { following: true, targetUserId } satisfies FollowMutationResult;
  });
};

export const unfollowUser = async (userId: string, targetUserId: string): Promise<FollowMutationResult> => {
  if (userId === targetUserId) {
    throw new Error("Cannot unfollow yourself");
  }

  const userRef = firestore.collection("users").doc(userId);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists) {
      return { following: false, targetUserId } satisfies FollowMutationResult;
    }

    const data = (snapshot.data() as UserDocument) ?? {};
    const followedIds = new Set(sanitizeFollowedUserIds(data.followed_user_ids));

    if (!followedIds.has(targetUserId)) {
      return { following: false, targetUserId } satisfies FollowMutationResult;
    }

    transaction.update(userRef, {
      followed_user_ids: FieldValue.arrayRemove(targetUserId)
    });

    return { following: false, targetUserId } satisfies FollowMutationResult;
  });
};

export const fetchFollowedSpots = async (viewerId: string, options?: FollowedPostsOptions) => {
  const doc = await firestore.collection("users").doc(viewerId).get();
  if (!doc.exists) {
    return [] as SpotResponse[];
  }

  const data = (doc.data() as UserDocument) ?? {};
  const followedUserIds = sanitizeFollowedUserIds(data.followed_user_ids);
  if (followedUserIds.length === 0) {
    return [] as SpotResponse[];
  }

  const spots = await fetchSpots({ followedUserIds, viewerId });
  if (options?.limit !== undefined) {
    return spots.slice(0, Math.max(0, options.limit));
  }
  return spots;
};

export type FavoriteMutationResult = {
  favorited: boolean;
  spotId: string;
};

export const favoriteSpot = async (spotId: string, userId: string): Promise<FavoriteMutationResult> => {
  const userRef = firestore.collection("users").doc(userId);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const data = snapshot.exists ? ((snapshot.data() as UserDocument) ?? {}) : {};
    const favoriteIds = new Set(sanitizeSpotIds(data.favorite_spot_ids));

    if (favoriteIds.has(spotId)) {
      return { favorited: true, spotId } satisfies FavoriteMutationResult;
    }

    transaction.set(
      userRef,
      {
        favorite_spot_ids: FieldValue.arrayUnion(spotId)
      },
      { merge: true }
    );

    return { favorited: true, spotId } satisfies FavoriteMutationResult;
  });
};

export const unfavoriteSpot = async (spotId: string, userId: string): Promise<FavoriteMutationResult> => {
  const userRef = firestore.collection("users").doc(userId);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists) {
      return { favorited: false, spotId } satisfies FavoriteMutationResult;
    }

    const data = (snapshot.data() as UserDocument) ?? {};
    const favoriteIds = new Set(sanitizeSpotIds(data.favorite_spot_ids));

    if (!favoriteIds.has(spotId)) {
      return { favorited: false, spotId } satisfies FavoriteMutationResult;
    }

    transaction.update(userRef, {
      favorite_spot_ids: FieldValue.arrayRemove(spotId)
    });

    return { favorited: false, spotId } satisfies FavoriteMutationResult;
  });
};

export const fetchSpotsByIds = async (spotIds: string[], viewerId?: string) => {
  const sanitizedIds = sanitizeSpotIds(spotIds);
  if (sanitizedIds.length === 0) {
    return [] as SpotResponse[];
  }

  const docRefs = sanitizedIds.map((id) => firestore.collection("spots").doc(id));
  const snapshots = await firestore.getAll(...docRefs);
  const spots = snapshots
    .filter((doc): doc is FirebaseFirestore.DocumentSnapshot<SpotDocument> => doc.exists)
    .map((doc) => toSpotResponse(doc));

  const enriched = await enrichSpotsForViewer(spots, viewerId);
  const spotMap = new Map(enriched.map((spot) => [spot.id, spot]));

  return sanitizedIds
    .map((id) => spotMap.get(id))
    .filter((spot): spot is SpotResponse => Boolean(spot));
};

export const rebuildPopularSpotsLeaderboard = async (maxEntries = 50) => {
  const entryLimit = Math.max(5, Math.min(maxEntries, 200));
  const [likesSnapshot, commentsSnapshot, viewsSnapshot] = await Promise.all([
    firestore.collection("spots").orderBy("likes", "desc").limit(entryLimit * 2).get(),
    firestore.collection("spots").orderBy("comments_count", "desc").limit(entryLimit * 2).get(),
    firestore.collection("spots").orderBy("view_count", "desc").limit(entryLimit * 2).get()
  ]);

  const candidateMap = new Map<string, SpotResponse>();
  likesSnapshot.docs.forEach((doc) => {
    candidateMap.set(doc.id, toSpotResponse(doc as FirebaseFirestore.QueryDocumentSnapshot<SpotDocument>));
  });
  commentsSnapshot.docs.forEach((doc) => {
    if (!candidateMap.has(doc.id)) {
      candidateMap.set(doc.id, toSpotResponse(doc as FirebaseFirestore.QueryDocumentSnapshot<SpotDocument>));
    }
  });

  viewsSnapshot.docs.forEach((doc) => {
    if (!candidateMap.has(doc.id)) {
      candidateMap.set(doc.id, toSpotResponse(doc as FirebaseFirestore.QueryDocumentSnapshot<SpotDocument>));
    }
  });

  const ownerIds = Array.from(new Set(Array.from(candidateMap.values()).map((spot) => spot.ownerId)));
  const ownerMetrics = new Map<string, OwnerMetrics>();
  if (ownerIds.length > 0) {
    const ownerSnapshots = await firestore.getAll(...ownerIds.map((id) => firestore.collection("users").doc(id)));
    ownerSnapshots.forEach((doc, index) => {
      const ownerId = ownerIds[index];
      if (!ownerId) return;
      const data = (doc.data() as {
        poster_tier?: PosterTier;
        followers_count?: number;
        flags?: { is_sponsor?: boolean };
      }) ?? {};
      ownerMetrics.set(ownerId, {
        tier: data.poster_tier ?? "tier_c",
        followersCount: data.followers_count ?? 0,
        isSponsor: Boolean(data.flags?.is_sponsor)
      });
    });
  }

  const scored = Array.from(candidateMap.values()).map((spot) => ({
    spot,
    score: calculatePopularityScore(spot, ownerMetrics.get(spot.ownerId))
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.spot.likes !== a.spot.likes) return b.spot.likes - a.spot.likes;
    if (b.spot.commentsCount !== a.spot.commentsCount) return b.spot.commentsCount - a.spot.commentsCount;
    return new Date(b.spot.createdAt).getTime() - new Date(a.spot.createdAt).getTime();
  });

  const top = scored.slice(0, Math.min(entryLimit, scored.length));
  const leaderboardCollection = firestore.collection("leaderboards").doc("popular_spots").collection("entries");

  const existingSnapshot = await leaderboardCollection.get();
  const keepIds = new Set(top.map((entry) => entry.spot.id));
  const batch = firestore.batch();
  const now = Timestamp.now();
  let hasWrites = false;

  existingSnapshot.docs.forEach((doc) => {
    if (!keepIds.has(doc.id)) {
      batch.delete(doc.ref);
      hasWrites = true;
    }
  });

  top.forEach((entry, index) => {
    const ref = leaderboardCollection.doc(entry.spot.id);
    batch.set(ref, {
      spot_id: entry.spot.id,
      popularity_score: entry.score,
      likes: entry.spot.likes,
      comments_count: entry.spot.commentsCount,
      view_count: entry.spot.viewCount,
      rank: index + 1,
      updated_at: now
    });
    hasWrites = true;
  });

  if (hasWrites) {
    await batch.commit();
  }

  return top.map((entry, index) => ({
    ...entry.spot,
    popularityScore: entry.score,
    popularityRank: index + 1
  } satisfies PopularSpotResponse));
};

export const fetchPopularSpotsFromLeaderboard = async (limit = 20, viewerId?: string) => {
  const leaderboardQuery = firestore
    .collection("leaderboards")
    .doc("popular_spots")
    .collection("entries")
    .orderBy("popularity_score", "desc")
    .orderBy("updated_at", "desc")
    .limit(Math.max(1, Math.min(limit, 50)));

  let snapshot = await leaderboardQuery.get();

  if (snapshot.empty) {
    await rebuildPopularSpotsLeaderboard(limit);
    snapshot = await leaderboardQuery.get();
    if (snapshot.empty) {
      return [] as PopularSpotResponse[];
    }
  }

  const firstEntry = snapshot.docs[0]?.data() as PopularSpotLeaderboardEntry | undefined;
  if (firstEntry?.updated_at) {
    const updatedAt = firstEntry.updated_at.toDate().getTime();
    const tenMinutes = 10 * 60 * 1000;
    if (Date.now() - updatedAt > tenMinutes) {
      await rebuildPopularSpotsLeaderboard(limit);
      snapshot = await leaderboardQuery.get();
      if (snapshot.empty) {
        return [] as PopularSpotResponse[];
      }
    }
  }

  const spotIds = snapshot.docs.map((doc) => doc.id);
  const leaderboardData = new Map(
    snapshot.docs.map((doc, index) => {
      const data = doc.data() as PopularSpotLeaderboardEntry;
      return [doc.id, { ...data, rank: data.rank ?? index + 1 }];
    })
  );

  const spots = await fetchSpotsByIds(spotIds, viewerId);
  const spotsById = new Map(spots.map((spot) => [spot.id, spot]));

  const result: PopularSpotResponse[] = [];
  spotIds.forEach((spotId) => {
    const spot = spotsById.get(spotId);
    const leaderboardEntry = leaderboardData.get(spotId);
    if (!spot || !leaderboardEntry) {
      return;
    }
    result.push({
      ...spot,
      popularityScore: leaderboardEntry.popularity_score,
      popularityRank: leaderboardEntry.rank
    });
  });

  return result;
};

export const recordSpotView = async (
  spotId: string,
  viewerHash: string,
  dedupeWindowMs = VIEW_DEDUPE_WINDOW_MS
): Promise<{ recorded: boolean; viewCount: number }> => {
  if (!viewerHash) {
    throw new Error("viewer hash is required");
  }

  const spotRef = firestore.collection("spots").doc(spotId);
  const sessionRef = firestore.collection(VIEW_SESSION_COLLECTION).doc(`${spotId}_${viewerHash}`);

  return firestore.runTransaction(async (tx) => {
    const [spotSnap, sessionSnap] = await Promise.all([tx.get(spotRef), tx.get(sessionRef)]);
    if (!spotSnap.exists) {
      throw new Error("Spot not found");
    }

    const now = Timestamp.now();
    const spotData = spotSnap.data() as SpotDocument;
    let recorded = false;
    let nextViewCount = spotData.view_count ?? 0;

    if (sessionSnap.exists) {
      const sessionData = sessionSnap.data() as SpotViewSessionDocument;
      const lastViewMs = sessionData.last_view.toDate().getTime();
      if (now.toDate().getTime() - lastViewMs < dedupeWindowMs) {
        return { recorded, viewCount: nextViewCount };
      }
    }

    recorded = true;
    nextViewCount += 1;
    tx.update(spotRef, { view_count: FieldValue.increment(1) });
    tx.set(
      sessionRef,
      {
        spot_id: spotId,
        viewer_hash: viewerHash,
        last_view: now,
        expire_at: Timestamp.fromMillis(now.toMillis() + VIEW_SESSION_TTL_MS)
      } satisfies SpotViewSessionDocument,
      { merge: true }
    );

    return { recorded, viewCount: nextViewCount };
  });
};
