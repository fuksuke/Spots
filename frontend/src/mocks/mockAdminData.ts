/**
 * 管理画面用モックデータ
 * 本番運用を想定した完全なデータセット
 */

import type { ScheduledSpot } from "../hooks/useScheduledSpots";
import type { SpotReport, ReviewLog, Comment, UserProfile } from "../types";
import type { AdminNotification } from "../hooks/useAdminNotifications";

// AnalyticsOverview 型（useAdminAnalyticsが存在しない場合の定義）
export type AnalyticsOverview = {
  timeRange: "24h";
  generatedAt: string;
  metrics: {
    activeUsers: number;
    avgMapDwellSeconds: number;
    avgScrollDepth: number;
    spotViews: number;
    reportsOpen: number;
  };
  trend: Array<{
    timestamp: string;
    activeUsers: number;
    spotViews: number;
  }>;
};

// ============================================================
// ユーザープロフィール（投稿者データ）
// ============================================================
export const MOCK_USER_PROFILES: UserProfile[] = [
  {
    uid: "user-001",
    email: "backstage@example.com",
    displayName: "BackStage Tokyo",
    photoUrl: null,
    bio: "渋谷を中心にストリートライブを企画・運営しています。音楽で街を盛り上げたい！",
    websiteUrl: "https://backstage-tokyo.example.com",
    isPrivateAccount: false,
    followedUserIds: ["user-004", "user-013"],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["live", "event"],
    createdAt: "2025-06-15T10:00:00+09:00",
    posterTier: "tier_a",
    followersCount: 1250,
    engagementScore: 87.5,
    promotionQuota: { shortTerm: 3, longTerm: 1 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: true,
    isSponsor: false,
    stripeCustomerId: "cus_backstage001",
    phoneVerified: true,
    phoneVerifiedAt: "2025-06-15T10:30:00+09:00"
  },
  {
    uid: "user-002",
    email: "lumiere@example.com",
    displayName: "Cafe Lumiere",
    photoUrl: null,
    bio: "道玄坂の隠れ家カフェ。季節限定スイーツとこだわりのコーヒーをお届けします。",
    websiteUrl: "https://cafe-lumiere.example.com",
    isPrivateAccount: false,
    followedUserIds: ["user-015"],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["cafe"],
    createdAt: "2025-08-20T14:00:00+09:00",
    posterTier: "tier_a",
    followersCount: 890,
    engagementScore: 92.3,
    promotionQuota: { shortTerm: 2, longTerm: 1 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: true,
    isSponsor: true,
    stripeCustomerId: "cus_lumiere002",
    phoneVerified: true,
    phoneVerifiedAt: "2025-08-20T14:30:00+09:00"
  },
  {
    uid: "user-003",
    email: "fleamarket@example.com",
    displayName: "SHIBUYA FLEA MARKET",
    photoUrl: null,
    bio: "渋谷エリアでフリマ・マルシェを定期開催。出店者も随時募集中！",
    websiteUrl: "https://shibuya-flea.example.com",
    isPrivateAccount: false,
    followedUserIds: [],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["event"],
    createdAt: "2025-04-01T09:00:00+09:00",
    posterTier: "tier_a",
    followersCount: 2340,
    engagementScore: 78.9,
    promotionQuota: { shortTerm: 4, longTerm: 2 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: true,
    isSponsor: false,
    stripeCustomerId: "cus_flea003",
    phoneVerified: true,
    phoneVerifiedAt: "2025-04-01T09:30:00+09:00"
  },
  {
    uid: "user-004",
    email: "womb@example.com",
    displayName: "WOMB TOKYO",
    photoUrl: null,
    bio: "渋谷を代表するクラブ。世界中のトップDJが出演するプレミアムイベントを開催。",
    websiteUrl: "https://womb.co.jp",
    isPrivateAccount: false,
    followedUserIds: ["user-001", "user-013"],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["event", "live"],
    createdAt: "2025-01-10T12:00:00+09:00",
    posterTier: "tier_a",
    followersCount: 5670,
    engagementScore: 95.2,
    promotionQuota: { shortTerm: 5, longTerm: 3 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: true,
    isSponsor: true,
    stripeCustomerId: "cus_womb004",
    phoneVerified: true,
    phoneVerifiedAt: "2025-01-10T12:30:00+09:00"
  },
  {
    uid: "user-005",
    email: "yoga@example.com",
    displayName: "Morning Yoga Tokyo",
    photoUrl: null,
    bio: "代々木公園で朝ヨガを開催。心と体を整える朝の習慣を一緒に始めませんか？",
    websiteUrl: "https://morning-yoga-tokyo.example.com",
    isPrivateAccount: false,
    followedUserIds: ["user-009"],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["sports"],
    createdAt: "2025-09-01T06:00:00+09:00",
    posterTier: "tier_b",
    followersCount: 567,
    engagementScore: 84.1,
    promotionQuota: { shortTerm: 2, longTerm: 0 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: true,
    isSponsor: false,
    stripeCustomerId: null,
    phoneVerified: true,
    phoneVerifiedAt: "2025-09-01T06:30:00+09:00"
  },
  {
    uid: "user-006",
    email: "109@example.com",
    displayName: "SHIBUYA109",
    photoUrl: null,
    bio: "渋谷のランドマーク SHIBUYA109 公式アカウント",
    websiteUrl: "https://www.shibuya109.jp",
    isPrivateAccount: false,
    followedUserIds: [],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["coupon"],
    createdAt: "2024-12-01T10:00:00+09:00",
    posterTier: "tier_a",
    followersCount: 12500,
    engagementScore: 88.7,
    promotionQuota: { shortTerm: 10, longTerm: 5 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: true,
    isSponsor: true,
    stripeCustomerId: "cus_109006",
    phoneVerified: true,
    phoneVerifiedAt: "2024-12-01T10:30:00+09:00"
  },
  {
    uid: "user-007",
    email: "yuki@example.com",
    displayName: "Yuki Singer",
    photoUrl: null,
    bio: "シンガーソングライター。渋谷の路上で歌っています。夢は武道館！",
    websiteUrl: null,
    isPrivateAccount: false,
    followedUserIds: ["user-001"],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["live"],
    createdAt: "2025-11-15T18:00:00+09:00",
    posterTier: "tier_c",
    followersCount: 89,
    engagementScore: 65.4,
    promotionQuota: { shortTerm: 1, longTerm: 0 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: false,
    isSponsor: false,
    stripeCustomerId: null,
    phoneVerified: false,
    phoneVerifiedAt: null
  },
  {
    uid: "user-008",
    email: "menya@example.com",
    displayName: "麺屋渋谷",
    photoUrl: null,
    bio: "渋谷センター街のラーメン店。濃厚豚骨と煮干しの二刀流。",
    websiteUrl: null,
    isPrivateAccount: false,
    followedUserIds: [],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["coupon", "cafe"],
    createdAt: "2025-07-01T11:00:00+09:00",
    posterTier: "tier_b",
    followersCount: 345,
    engagementScore: 76.8,
    promotionQuota: { shortTerm: 2, longTerm: 0 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: true,
    isSponsor: false,
    stripeCustomerId: null,
    phoneVerified: true,
    phoneVerifiedAt: "2025-07-01T11:30:00+09:00"
  },
  {
    uid: "user-009",
    email: "run@example.com",
    displayName: "渋谷ランニングクラブ",
    photoUrl: null,
    bio: "渋谷発のランニングコミュニティ。週末の練習会やレース参加など活動中。",
    websiteUrl: "https://shibuya-run.example.com",
    isPrivateAccount: false,
    followedUserIds: ["user-005", "user-014"],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["sports"],
    createdAt: "2025-03-15T07:00:00+09:00",
    posterTier: "tier_b",
    followersCount: 456,
    engagementScore: 82.3,
    promotionQuota: { shortTerm: 2, longTerm: 1 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: true,
    isSponsor: false,
    stripeCustomerId: null,
    phoneVerified: true,
    phoneVerifiedAt: "2025-03-15T07:30:00+09:00"
  },
  {
    uid: "user-010",
    email: "enishi@example.com",
    displayName: "Bar ENISHI",
    photoUrl: null,
    bio: "完全予約制の隠れ家バー。大人のための上質な空間をご提供。",
    websiteUrl: "https://bar-enishi.example.com",
    isPrivateAccount: false,
    followedUserIds: [],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["cafe"],
    createdAt: "2025-05-01T19:00:00+09:00",
    posterTier: "tier_a",
    followersCount: 678,
    engagementScore: 89.1,
    promotionQuota: { shortTerm: 3, longTerm: 1 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: true,
    isSponsor: true,
    stripeCustomerId: "cus_enishi010",
    phoneVerified: true,
    phoneVerifiedAt: "2025-05-01T19:30:00+09:00"
  },
  {
    uid: "user-011",
    email: "dance@example.com",
    displayName: "SHIBUYA DANCE CREW",
    photoUrl: null,
    bio: "渋谷のストリートダンスチーム。バトルイベントやワークショップを開催。",
    websiteUrl: "https://shibuya-dance.example.com",
    isPrivateAccount: false,
    followedUserIds: ["user-004"],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["event", "sports"],
    createdAt: "2025-02-20T15:00:00+09:00",
    posterTier: "tier_b",
    followersCount: 789,
    engagementScore: 85.6,
    promotionQuota: { shortTerm: 2, longTerm: 1 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: true,
    isSponsor: false,
    stripeCustomerId: null,
    phoneVerified: true,
    phoneVerifiedAt: "2025-02-20T15:30:00+09:00"
  },
  {
    uid: "user-012",
    email: "vintage@example.com",
    displayName: "Vintage Garden",
    photoUrl: null,
    bio: "キャットストリートの古着屋。ヨーロッパ・アメリカのヴィンテージを厳選。",
    websiteUrl: null,
    isPrivateAccount: false,
    followedUserIds: [],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["coupon"],
    createdAt: "2025-10-01T12:00:00+09:00",
    posterTier: "tier_c",
    followersCount: 234,
    engagementScore: 71.2,
    promotionQuota: { shortTerm: 1, longTerm: 0 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: false,
    isSponsor: false,
    stripeCustomerId: null,
    phoneVerified: false,
    phoneVerifiedAt: null
  },
  {
    uid: "user-013",
    email: "oeast@example.com",
    displayName: "O-EAST SHIBUYA",
    photoUrl: null,
    bio: "渋谷を代表するライブハウス。インディーズからメジャーまで幅広く。",
    websiteUrl: "https://o-east.co.jp",
    isPrivateAccount: false,
    followedUserIds: ["user-001", "user-004"],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["live", "event"],
    createdAt: "2024-11-01T14:00:00+09:00",
    posterTier: "tier_a",
    followersCount: 3450,
    engagementScore: 91.4,
    promotionQuota: { shortTerm: 4, longTerm: 2 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: true,
    isSponsor: true,
    stripeCustomerId: "cus_oeast013",
    phoneVerified: true,
    phoneVerifiedAt: "2024-11-01T14:30:00+09:00"
  },
  {
    uid: "user-014",
    email: "skate@example.com",
    displayName: "MIYASHITA SKATE SCHOOL",
    photoUrl: null,
    bio: "宮下公園スケートパークでレッスン開催。初心者から上級者まで対応。",
    websiteUrl: "https://miyashita-skate.example.com",
    isPrivateAccount: false,
    followedUserIds: ["user-009"],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["sports"],
    createdAt: "2025-06-01T10:00:00+09:00",
    posterTier: "tier_b",
    followersCount: 567,
    engagementScore: 79.8,
    promotionQuota: { shortTerm: 2, longTerm: 0 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: true,
    isSponsor: false,
    stripeCustomerId: null,
    phoneVerified: true,
    phoneVerifiedAt: "2025-06-01T10:30:00+09:00"
  },
  {
    uid: "user-015",
    email: "ujien@example.com",
    displayName: "茶寮 宇治園",
    photoUrl: null,
    bio: "京都宇治の老舗茶舗。本格抹茶スイーツをお楽しみください。",
    websiteUrl: "https://ujien.example.com",
    isPrivateAccount: false,
    followedUserIds: ["user-002"],
    followedUsers: [],
    favoriteSpotIds: [],
    favoriteSpots: [],
    followedCategories: ["cafe"],
    createdAt: "2025-04-15T10:00:00+09:00",
    posterTier: "tier_b",
    followersCount: 456,
    engagementScore: 83.7,
    promotionQuota: { shortTerm: 2, longTerm: 1 },
    promotionQuotaUpdatedAt: "2026-01-01T00:00:00+09:00",
    isVerified: true,
    isSponsor: false,
    stripeCustomerId: null,
    phoneVerified: true,
    phoneVerifiedAt: "2025-04-15T10:30:00+09:00"
  }
];

// ============================================================
// スケジュール済みスポット（審査待ち）
// ============================================================
export const MOCK_SCHEDULED_SPOTS: ScheduledSpot[] = [
  {
    id: "sched-001",
    title: "渋谷ハロウィンナイトパーティー 2026",
    description: "渋谷最大級のハロウィンイベント！コスプレコンテストやDJパフォーマンス、フォトブース設置など盛りだくさん。仮装して参加すると入場料割引。",
    category: "event",
    lat: 35.6595,
    lng: 139.7004,
    startTime: "2026-10-31T18:00:00+09:00",
    endTime: "2026-10-31T23:00:00+09:00",
    publishAt: "2026-10-25T12:00:00+09:00",
    announcementType: "short_term_notice",
    status: "pending",
    ownerId: "user-004",
    imageUrl: null,
    reviewNotes: null,
    ownerDisplayName: "WOMB TOKYO",
    ownerPhotoUrl: null
  },
  {
    id: "sched-002",
    title: "渋谷マークシティ 限定スイーツフェア",
    description: "人気パティシエ5名による限定スイーツが勢揃い。各日50食限定のスペシャルメニューも。インスタ映え間違いなし！",
    category: "cafe",
    lat: 35.6580,
    lng: 139.6983,
    startTime: "2026-02-01T10:00:00+09:00",
    endTime: "2026-02-14T20:00:00+09:00",
    publishAt: "2026-01-28T09:00:00+09:00",
    announcementType: "long_term_campaign",
    status: "pending",
    ownerId: "user-002",
    imageUrl: null,
    reviewNotes: null,
    ownerDisplayName: "Cafe Lumiere",
    ownerPhotoUrl: null
  },
  {
    id: "sched-003",
    title: "ストリートライブ in 道玄坂",
    description: "若手アーティスト3組によるストリートライブを開催。出演アーティストのCDも販売予定。",
    category: "live",
    lat: 35.6578,
    lng: 139.6997,
    startTime: "2026-01-26T15:00:00+09:00",
    endTime: "2026-01-26T18:00:00+09:00",
    publishAt: "2026-01-25T10:00:00+09:00",
    announcementType: "short_term_notice",
    status: "pending",
    ownerId: "user-001",
    imageUrl: null,
    reviewNotes: null,
    ownerDisplayName: "BackStage Tokyo",
    ownerPhotoUrl: null
  },
  {
    id: "sched-004",
    title: "渋谷駅前クーポン配布キャンペーン",
    description: "対象店舗で使える500円OFFクーポンを配布中！飲食店・ショップなど50店舗以上で利用可能。",
    category: "coupon",
    lat: 35.6580,
    lng: 139.7016,
    startTime: "2026-01-27T00:00:00+09:00",
    endTime: "2026-02-28T23:59:00+09:00",
    publishAt: "2026-01-26T00:00:00+09:00",
    announcementType: "long_term_campaign",
    status: "pending",
    ownerId: "user-006",
    imageUrl: null,
    reviewNotes: null,
    ownerDisplayName: "SHIBUYA109",
    ownerPhotoUrl: null
  },
  {
    id: "sched-005",
    title: "春のマラソン大会 渋谷〜代々木コース",
    description: "渋谷から代々木公園を周回する市民マラソン大会。5km/10km/ハーフの3部門。参加賞あり。",
    category: "sports",
    lat: 35.6700,
    lng: 139.6950,
    startTime: "2026-03-15T08:00:00+09:00",
    endTime: "2026-03-15T14:00:00+09:00",
    publishAt: "2026-02-15T09:00:00+09:00",
    announcementType: "long_term_campaign",
    status: "pending",
    ownerId: "user-009",
    imageUrl: null,
    reviewNotes: null,
    ownerDisplayName: "渋谷ランニングクラブ",
    ownerPhotoUrl: null
  },
  {
    id: "sched-101",
    title: "渋谷ランニングクラブ 週末練習会",
    description: "毎週末、代々木公園で行うランニング練習会です。初心者歓迎！ペースメーカーがサポートします。",
    category: "sports",
    lat: 35.6710,
    lng: 139.6960,
    startTime: "2026-01-26T08:00:00+09:00",
    endTime: "2026-01-26T10:00:00+09:00",
    publishAt: "2026-01-25T18:00:00+09:00",
    announcementType: "short_term_notice",
    status: "approved",
    ownerId: "user-009",
    imageUrl: null,
    reviewNotes: "適切な内容です。公開を承認します。",
    ownerDisplayName: "渋谷ランニングクラブ",
    ownerPhotoUrl: null
  },
  {
    id: "sched-102",
    title: "バレンタイン限定カクテルフェア",
    description: "2月限定のバレンタインカクテル5種を提供。カップルでの来店でデザートサービス。",
    category: "cafe",
    lat: 35.6555,
    lng: 139.6962,
    startTime: "2026-02-01T17:00:00+09:00",
    endTime: "2026-02-14T23:00:00+09:00",
    publishAt: "2026-01-28T12:00:00+09:00",
    announcementType: "long_term_campaign",
    status: "approved",
    ownerId: "user-010",
    imageUrl: null,
    reviewNotes: "内容確認済み。素敵な企画です。",
    ownerDisplayName: "Bar ENISHI",
    ownerPhotoUrl: null
  },
  {
    id: "sched-201",
    title: "【却下】不明瞭なイベント告知",
    description: "詳細未定のイベントです。",
    category: "event",
    lat: 35.6600,
    lng: 139.7000,
    startTime: "2026-02-01T12:00:00+09:00",
    endTime: "2026-02-01T18:00:00+09:00",
    publishAt: "2026-01-28T09:00:00+09:00",
    announcementType: "short_term_notice",
    status: "rejected",
    ownerId: "user-012",
    imageUrl: null,
    reviewNotes: "イベントの開始・終了時刻や詳細情報が不足しています。必要事項を追記のうえ再申請してください。",
    ownerDisplayName: "Vintage Garden",
    ownerPhotoUrl: null
  }
];

// ============================================================
// 通報データ
// ============================================================
export const MOCK_SPOT_REPORTS: SpotReport[] = [
  {
    id: "report-001",
    spotId: "spot-007",
    reason: "spam",
    details: "同じ内容の投稿が複数回されています。宣伝目的のスパム行為と思われます。以前にも同様の投稿を見ました。",
    status: "open",
    reporterUid: "user-viewer-001",
    createdAt: "2026-01-23T14:30:00+09:00"
  },
  {
    id: "report-002",
    spotId: "spot-008",
    reason: "fraud",
    details: "タイムセールと書いてありますが、実際に行ったら通常価格でした。虚偽広告だと思います。",
    status: "open",
    reporterUid: "user-viewer-002",
    createdAt: "2026-01-23T16:45:00+09:00"
  },
  {
    id: "report-003",
    spotId: "spot-017",
    reason: "inappropriate",
    details: "路上ライブの許可を取っていない可能性があります。周辺の迷惑になっているようです。",
    status: "open",
    reporterUid: "user-viewer-003",
    createdAt: "2026-01-24T09:15:00+09:00"
  },
  {
    id: "report-004",
    spotId: "spot-012",
    reason: "other",
    details: "古着屋のセール情報ですが、実際の割引率が表示と異なりました。30%OFFと書いてあったのに20%OFFでした。",
    status: "open",
    reporterUid: "user-viewer-004",
    createdAt: "2026-01-24T11:20:00+09:00"
  },
  {
    id: "report-101",
    spotId: "spot-old-001",
    reason: "fraud",
    details: "存在しないイベントの告知でした。会場に行っても何もありませんでした。",
    status: "resolved",
    reporterUid: "user-viewer-005",
    createdAt: "2026-01-20T10:00:00+09:00",
    resolvedAt: "2026-01-21T15:30:00+09:00"
  },
  {
    id: "report-102",
    spotId: "spot-old-002",
    reason: "inappropriate",
    details: "不適切な画像が含まれていました。",
    status: "resolved",
    reporterUid: "user-viewer-006",
    createdAt: "2026-01-19T08:00:00+09:00",
    resolvedAt: "2026-01-19T12:00:00+09:00"
  }
];

// ============================================================
// コメントデータ
// ============================================================
export const MOCK_COMMENTS: Comment[] = [
  // spot-001 渋谷ストリートライブ vol.24
  { id: "comment-001", spotId: "spot-001", text: "今聴いてます！すごくいい感じ", imageUrl: null, ownerId: "user-viewer-001", timestamp: "2026-01-24T14:30:00+09:00", likes: 5, likedByViewer: false },
  { id: "comment-002", spotId: "spot-001", text: "声が綺麗ですね。CDとかあるんですか？", imageUrl: null, ownerId: "user-viewer-002", timestamp: "2026-01-24T14:45:00+09:00", likes: 3, likedByViewer: false },
  { id: "comment-003", spotId: "spot-001", text: "雨降りそうだけど大丈夫かな？", imageUrl: null, ownerId: "user-viewer-003", timestamp: "2026-01-24T15:00:00+09:00", likes: 1, likedByViewer: false },

  // spot-002 道玄坂カフェ
  { id: "comment-004", spotId: "spot-002", text: "苺パフェめっちゃ美味しかった！また来ます", imageUrl: null, ownerId: "user-viewer-004", timestamp: "2026-01-22T15:30:00+09:00", likes: 12, likedByViewer: true },
  { id: "comment-005", spotId: "spot-002", text: "予約なしで入れますか？", imageUrl: null, ownerId: "user-viewer-005", timestamp: "2026-01-23T10:00:00+09:00", likes: 2, likedByViewer: false },
  { id: "comment-006", spotId: "spot-002", text: "平日なら空いてましたよ", imageUrl: null, ownerId: "user-viewer-006", timestamp: "2026-01-23T11:00:00+09:00", likes: 4, likedByViewer: false },

  // spot-004 DJ NIGHT @ WOMB
  { id: "comment-007", spotId: "spot-004", text: "チケット取れた！楽しみすぎる", imageUrl: null, ownerId: "user-viewer-007", timestamp: "2026-01-21T20:00:00+09:00", likes: 23, likedByViewer: false },
  { id: "comment-008", spotId: "spot-004", text: "ドレスコードってどのくらい厳しいですか？", imageUrl: null, ownerId: "user-viewer-008", timestamp: "2026-01-22T09:00:00+09:00", likes: 8, likedByViewer: false },
  { id: "comment-009", spotId: "spot-004", text: "スニーカーでも大丈夫でしたよ", imageUrl: null, ownerId: "user-viewer-009", timestamp: "2026-01-22T10:30:00+09:00", likes: 15, likedByViewer: false },
  { id: "comment-010", spotId: "spot-004", text: "前回も最高だったから今回も期待！", imageUrl: null, ownerId: "user-viewer-010", timestamp: "2026-01-23T18:00:00+09:00", likes: 19, likedByViewer: true },

  // spot-006 渋谷109 冬セール最終日
  { id: "comment-011", spotId: "spot-006", text: "朝イチで行ったけどもう混んでた...", imageUrl: null, ownerId: "user-viewer-011", timestamp: "2026-01-24T10:30:00+09:00", likes: 34, likedByViewer: false },
  { id: "comment-012", spotId: "spot-006", text: "お目当てのブランドは売り切れでした", imageUrl: null, ownerId: "user-viewer-012", timestamp: "2026-01-24T11:00:00+09:00", likes: 12, likedByViewer: false },
  { id: "comment-013", spotId: "spot-006", text: "70%OFFは本当にお得！買いすぎた笑", imageUrl: null, ownerId: "user-viewer-013", timestamp: "2026-01-24T13:00:00+09:00", likes: 28, likedByViewer: false },

  // spot-008 タイムセール！ラーメン半額
  { id: "comment-014", spotId: "spot-008", text: "並んでるけど回転早いです", imageUrl: null, ownerId: "user-viewer-014", timestamp: "2026-01-24T14:20:00+09:00", likes: 15, likedByViewer: false },
  { id: "comment-015", spotId: "spot-008", text: "豚骨最高でした", imageUrl: null, ownerId: "user-viewer-015", timestamp: "2026-01-24T15:00:00+09:00", likes: 8, likedByViewer: false },
  { id: "comment-016", spotId: "spot-008", text: "まだ残ってますか？", imageUrl: null, ownerId: "user-viewer-016", timestamp: "2026-01-24T15:30:00+09:00", likes: 2, likedByViewer: false },

  // spot-011 ストリートダンスバトル
  { id: "comment-017", spotId: "spot-011", text: "去年も見に行った！今年も楽しみ", imageUrl: null, ownerId: "user-viewer-017", timestamp: "2026-01-22T16:00:00+09:00", likes: 11, likedByViewer: false },
  { id: "comment-018", spotId: "spot-011", text: "参加エントリーまだ間に合いますか？", imageUrl: null, ownerId: "user-viewer-018", timestamp: "2026-01-23T09:00:00+09:00", likes: 3, likedByViewer: false },
  { id: "comment-019", spotId: "spot-011", text: "観覧だけでも盛り上がれますよ！", imageUrl: null, ownerId: "user-viewer-019", timestamp: "2026-01-23T12:00:00+09:00", likes: 7, likedByViewer: false },

  // spot-018 ドリンク1杯無料クーポン
  { id: "comment-020", spotId: "spot-018", text: "使わせてもらいました！店員さんも親切でした", imageUrl: null, ownerId: "user-viewer-020", timestamp: "2026-01-21T21:00:00+09:00", likes: 18, likedByViewer: false },
  { id: "comment-021", spotId: "spot-018", text: "お酒の種類は何でもOKですか？", imageUrl: null, ownerId: "user-viewer-021", timestamp: "2026-01-22T18:00:00+09:00", likes: 5, likedByViewer: false },
  { id: "comment-022", spotId: "spot-018", text: "カクテルでも大丈夫でしたよ", imageUrl: null, ownerId: "user-viewer-022", timestamp: "2026-01-22T19:00:00+09:00", likes: 9, likedByViewer: false },

  // spot-028 フードトラック集合＠代々木
  { id: "comment-023", spotId: "spot-028", text: "天気良さそうだから楽しみ！", imageUrl: null, ownerId: "user-viewer-023", timestamp: "2026-01-24T08:00:00+09:00", likes: 14, likedByViewer: false },
  { id: "comment-024", spotId: "spot-028", text: "タコスのトラック来るかな？", imageUrl: null, ownerId: "user-viewer-024", timestamp: "2026-01-24T09:00:00+09:00", likes: 6, likedByViewer: false },
  { id: "comment-025", spotId: "spot-028", text: "去年は2時間並んだ店があった...", imageUrl: null, ownerId: "user-viewer-025", timestamp: "2026-01-24T10:00:00+09:00", likes: 11, likedByViewer: false }
];

// ============================================================
// 審査ログ
// ============================================================
export const MOCK_REVIEW_LOGS: ReviewLog[] = [
  {
    id: "review-001",
    spotId: "sched-101",
    actorUid: "admin-001",
    actorEmail: "admin@shibuya-livemap.example.com",
    previousStatus: "pending",
    nextStatus: "approved",
    reviewNotes: "適切な内容です。公開を承認します。",
    reviewTemplateId: "approval-default",
    createdAt: "2026-01-24T10:00:00+09:00"
  },
  {
    id: "review-002",
    spotId: "sched-102",
    actorUid: "admin-002",
    actorEmail: "moderator@shibuya-livemap.example.com",
    previousStatus: "pending",
    nextStatus: "approved",
    reviewNotes: "内容確認済み。素敵な企画です。",
    reviewTemplateId: "approval-default",
    createdAt: "2026-01-24T11:30:00+09:00"
  },
  {
    id: "review-003",
    spotId: "sched-201",
    actorUid: "admin-001",
    actorEmail: "admin@shibuya-livemap.example.com",
    previousStatus: "pending",
    nextStatus: "rejected",
    reviewNotes: "イベントの開始・終了時刻や詳細情報が不足しています。必要事項を追記のうえ再申請してください。",
    reviewTemplateId: "missing-details",
    createdAt: "2026-01-23T15:00:00+09:00"
  },
  {
    id: "review-004",
    spotId: "sched-old-001",
    actorUid: "admin-002",
    actorEmail: "moderator@shibuya-livemap.example.com",
    previousStatus: "pending",
    nextStatus: "rejected",
    reviewNotes: "登録された位置が実際の開催場所と異なる可能性があります。地図上の位置をご確認ください。",
    reviewTemplateId: "location-unclear",
    createdAt: "2026-01-22T14:00:00+09:00"
  },
  {
    id: "review-005",
    spotId: "sched-old-002",
    actorUid: "admin-001",
    actorEmail: "admin@shibuya-livemap.example.com",
    previousStatus: "pending",
    nextStatus: "approved",
    reviewNotes: "審査を完了しました。公開スケジュールどおりに掲載されます。",
    reviewTemplateId: "approval-default",
    createdAt: "2026-01-21T09:00:00+09:00"
  }
];

// ============================================================
// 管理者通知
// ============================================================
export const MOCK_ADMIN_NOTIFICATIONS: AdminNotification[] = [
  {
    id: "notif-001",
    type: "spot_pending_review",
    message: "新しい審査待ち投稿があります: 渋谷ハロウィンナイトパーティー 2026",
    metadata: { spotId: "sched-001" },
    created_at: "2026-01-24T13:30:00+09:00",
    read: false
  },
  {
    id: "notif-002",
    type: "report_created",
    message: "通報が報告されました: スパム行為の疑い（spot-007）",
    metadata: { spotId: "spot-007", reportId: "report-001" },
    created_at: "2026-01-23T14:35:00+09:00",
    read: false
  },
  {
    id: "notif-003",
    type: "spot_pending_review",
    message: "長期キャンペーンの審査依頼: 渋谷マークシティ限定スイーツフェア",
    metadata: { spotId: "sched-002" },
    created_at: "2026-01-24T10:00:00+09:00",
    read: false
  },
  {
    id: "notif-004",
    type: "report_created",
    message: "通報が報告されました: 虚偽広告の疑い（spot-008）",
    metadata: { spotId: "spot-008", reportId: "report-002" },
    created_at: "2026-01-23T16:50:00+09:00",
    read: false
  },
  {
    id: "notif-005",
    type: "spot_pending_review",
    message: "新しい審査待ち投稿があります: ストリートライブ in 道玄坂",
    metadata: { spotId: "sched-003" },
    created_at: "2026-01-24T09:00:00+09:00",
    read: true
  },
  {
    id: "notif-006",
    type: "system_alert",
    message: "審査完了: 渋谷ランニングクラブ 週末練習会（承認）",
    metadata: { spotId: "sched-101" },
    created_at: "2026-01-24T10:05:00+09:00",
    read: true
  },
  {
    id: "notif-007",
    type: "report_created",
    message: "通報が報告されました: 路上ライブの許可問題（spot-017）",
    metadata: { spotId: "spot-017", reportId: "report-003" },
    created_at: "2026-01-24T09:20:00+09:00",
    read: false
  },
  {
    id: "notif-008",
    type: "spot_pending_review",
    message: "新しい審査待ち投稿があります: 渋谷駅前クーポン配布キャンペーン",
    metadata: { spotId: "sched-004" },
    created_at: "2026-01-24T08:00:00+09:00",
    read: true
  },
  {
    id: "notif-009",
    type: "system_alert",
    message: "審査完了: バレンタイン限定カクテルフェア（承認）",
    metadata: { spotId: "sched-102" },
    created_at: "2026-01-24T11:35:00+09:00",
    read: true
  },
  {
    id: "notif-010",
    type: "spot_pending_review",
    message: "新しい審査待ち投稿があります: 春のマラソン大会",
    metadata: { spotId: "sched-005" },
    created_at: "2026-01-24T07:00:00+09:00",
    read: false
  }
];

// ============================================================
// アナリティクス
// ============================================================
const generateTrendData = () => {
  const trend = [];
  const baseDate = new Date("2026-01-23T00:00:00+09:00");

  // 時間帯別のアクティブユーザー傾向（深夜少、昼〜夜多）
  const hourlyPattern = [
    0.15, 0.08, 0.04, 0.03, 0.02, 0.03, // 0-5時
    0.08, 0.18, 0.35, 0.50, 0.62, 0.75, // 6-11時
    0.85, 0.78, 0.72, 0.80, 0.92, 1.00, // 12-17時
    0.95, 0.88, 0.78, 0.65, 0.45, 0.28  // 18-23時
  ];

  for (let hour = 0; hour < 24; hour++) {
    const timestamp = new Date(baseDate.getTime() + hour * 60 * 60 * 1000);
    const multiplier = hourlyPattern[hour];
    const baseUsers = 200;
    const baseViews = 500;

    trend.push({
      timestamp: timestamp.toISOString(),
      activeUsers: Math.round(baseUsers * multiplier + Math.random() * 20),
      spotViews: Math.round(baseViews * multiplier + Math.random() * 50)
    });
  }

  return trend;
};

export const MOCK_ANALYTICS_OVERVIEW: AnalyticsOverview = {
  timeRange: "24h",
  generatedAt: new Date().toISOString(),
  metrics: {
    activeUsers: 2847,
    avgMapDwellSeconds: 142.8,
    avgScrollDepth: 0.72,
    spotViews: 12450,
    reportsOpen: 4
  },
  trend: generateTrendData()
};

// ============================================================
// いいねログ（インプレッションデータ）
// ============================================================
export type LikeLog = {
  id: string;
  spotId: string;
  userId: string;
  createdAt: string;
};

export const MOCK_LIKE_LOGS: LikeLog[] = [
  { id: "like-001", spotId: "spot-001", userId: "user-viewer-001", createdAt: "2026-01-24T14:32:00+09:00" },
  { id: "like-002", spotId: "spot-001", userId: "user-viewer-002", createdAt: "2026-01-24T14:45:00+09:00" },
  { id: "like-003", spotId: "spot-002", userId: "user-viewer-003", createdAt: "2026-01-22T15:30:00+09:00" },
  { id: "like-004", spotId: "spot-004", userId: "user-viewer-004", createdAt: "2026-01-21T20:15:00+09:00" },
  { id: "like-005", spotId: "spot-004", userId: "user-viewer-005", createdAt: "2026-01-22T09:30:00+09:00" },
  { id: "like-006", spotId: "spot-006", userId: "user-viewer-006", createdAt: "2026-01-24T10:45:00+09:00" },
  { id: "like-007", spotId: "spot-006", userId: "user-viewer-007", createdAt: "2026-01-24T11:20:00+09:00" },
  { id: "like-008", spotId: "spot-008", userId: "user-viewer-008", createdAt: "2026-01-24T14:25:00+09:00" },
  { id: "like-009", spotId: "spot-011", userId: "user-viewer-009", createdAt: "2026-01-22T16:10:00+09:00" },
  { id: "like-010", spotId: "spot-018", userId: "user-viewer-010", createdAt: "2026-01-21T21:05:00+09:00" }
];

// ============================================================
// 閲覧ログ（ビューセッション）
// ============================================================
export type ViewSession = {
  id: string;
  spotId: string;
  sessionId: string;
  userId: string | null;
  startedAt: string;
  dwellSeconds: number;
  scrollDepth: number;
};

export const MOCK_VIEW_SESSIONS: ViewSession[] = [
  { id: "view-001", spotId: "spot-001", sessionId: "sess-001", userId: "user-viewer-001", startedAt: "2026-01-24T14:30:00+09:00", dwellSeconds: 45, scrollDepth: 0.85 },
  { id: "view-002", spotId: "spot-001", sessionId: "sess-002", userId: null, startedAt: "2026-01-24T14:35:00+09:00", dwellSeconds: 23, scrollDepth: 0.45 },
  { id: "view-003", spotId: "spot-002", sessionId: "sess-003", userId: "user-viewer-002", startedAt: "2026-01-22T15:20:00+09:00", dwellSeconds: 120, scrollDepth: 1.0 },
  { id: "view-004", spotId: "spot-004", sessionId: "sess-004", userId: "user-viewer-003", startedAt: "2026-01-21T19:50:00+09:00", dwellSeconds: 180, scrollDepth: 1.0 },
  { id: "view-005", spotId: "spot-006", sessionId: "sess-005", userId: null, startedAt: "2026-01-24T10:15:00+09:00", dwellSeconds: 35, scrollDepth: 0.65 },
  { id: "view-006", spotId: "spot-006", sessionId: "sess-006", userId: "user-viewer-004", startedAt: "2026-01-24T10:30:00+09:00", dwellSeconds: 90, scrollDepth: 0.90 },
  { id: "view-007", spotId: "spot-008", sessionId: "sess-007", userId: "user-viewer-005", startedAt: "2026-01-24T14:10:00+09:00", dwellSeconds: 60, scrollDepth: 0.75 },
  { id: "view-008", spotId: "spot-011", sessionId: "sess-008", userId: null, startedAt: "2026-01-22T15:45:00+09:00", dwellSeconds: 78, scrollDepth: 0.80 },
  { id: "view-009", spotId: "spot-018", sessionId: "sess-009", userId: "user-viewer-006", startedAt: "2026-01-21T20:30:00+09:00", dwellSeconds: 55, scrollDepth: 0.70 },
  { id: "view-010", spotId: "spot-028", sessionId: "sess-010", userId: "user-viewer-007", startedAt: "2026-01-24T08:15:00+09:00", dwellSeconds: 145, scrollDepth: 1.0 }
];

// ============================================================
// フォローログ
// ============================================================
export type FollowLog = {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
};

export const MOCK_FOLLOW_LOGS: FollowLog[] = [
  { id: "follow-001", followerId: "user-viewer-001", followingId: "user-001", createdAt: "2026-01-20T10:00:00+09:00" },
  { id: "follow-002", followerId: "user-viewer-002", followingId: "user-004", createdAt: "2026-01-19T15:00:00+09:00" },
  { id: "follow-003", followerId: "user-viewer-003", followingId: "user-006", createdAt: "2026-01-18T12:00:00+09:00" },
  { id: "follow-004", followerId: "user-viewer-004", followingId: "user-002", createdAt: "2026-01-22T14:00:00+09:00" },
  { id: "follow-005", followerId: "user-viewer-005", followingId: "user-013", createdAt: "2026-01-21T18:00:00+09:00" }
];

// ============================================================
// お気に入りログ
// ============================================================
export type FavoriteLog = {
  id: string;
  userId: string;
  spotId: string;
  createdAt: string;
};

export const MOCK_FAVORITE_LOGS: FavoriteLog[] = [
  { id: "fav-001", userId: "user-viewer-001", spotId: "spot-004", createdAt: "2026-01-21T20:00:00+09:00" },
  { id: "fav-002", userId: "user-viewer-002", spotId: "spot-002", createdAt: "2026-01-22T15:35:00+09:00" },
  { id: "fav-003", userId: "user-viewer-003", spotId: "spot-011", createdAt: "2026-01-22T16:15:00+09:00" },
  { id: "fav-004", userId: "user-viewer-004", spotId: "spot-028", createdAt: "2026-01-24T08:30:00+09:00" },
  { id: "fav-005", userId: "user-viewer-005", spotId: "spot-006", createdAt: "2026-01-24T10:50:00+09:00" }
];

// ============================================================
// モックモード設定
// ============================================================
export const ADMIN_MOCK_MODE = true;
