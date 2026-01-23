/**
 * 管理画面用ダミーデータ
 * UI/UX確認用
 */

import { ScheduledSpot } from "../hooks/useScheduledSpots";
import { AnalyticsOverview } from "../hooks/useAdminAnalytics";
import { SpotReport } from "../types";
import { AdminNotification } from "../hooks/useAdminNotifications";

// ============================================================
// スケジュール済みスポット（審査待ち）
// ============================================================
export const MOCK_SCHEDULED_SPOTS: ScheduledSpot[] = [
    {
        id: "sched-001",
        title: "渋谷ハロウィンナイトパーティー",
        description: "渋谷最大級のハロウィンイベント！コスプレコンテストやDJパフォーマンスなど盛りだくさん。",
        category: "event",
        lat: 35.6595,
        lng: 139.7004,
        startTime: "2026-10-31T18:00:00+09:00",
        endTime: "2026-10-31T23:00:00+09:00",
        publishAt: "2026-10-25T12:00:00+09:00",
        announcementType: "short_term_notice",
        status: "pending",
        ownerId: "user-abc123",
        imageUrl: null,
        reviewNotes: null
    },
    {
        id: "sched-002",
        title: "渋谷マークシティ 限定スイーツフェア",
        description: "人気パティシエによる限定スイーツが勢揃い。インスタ映え間違いなし！期間限定開催。",
        category: "cafe",
        lat: 35.6580,
        lng: 139.6983,
        startTime: "2026-02-01T10:00:00+09:00",
        endTime: "2026-02-14T20:00:00+09:00",
        publishAt: "2026-01-28T09:00:00+09:00",
        announcementType: "long_term_campaign",
        status: "pending",
        ownerId: "user-def456",
        imageUrl: null,
        reviewNotes: null
    },
    {
        id: "sched-003",
        title: "ストリートライブ in 道玄坂",
        description: "若手アーティストによるストリートライブを開催。",
        category: "live",
        lat: 35.6578,
        lng: 139.6997,
        startTime: "2026-01-26T15:00:00+09:00",
        endTime: "2026-01-26T18:00:00+09:00",
        publishAt: "2026-01-25T10:00:00+09:00",
        announcementType: "short_term_notice",
        status: "pending",
        ownerId: "user-ghi789",
        imageUrl: null,
        reviewNotes: null
    },
    {
        id: "sched-004",
        title: "渋谷駅前クーポン配布キャンペーン",
        description: "対象店舗で使える500円OFFクーポンを配布中！",
        category: "coupon",
        lat: 35.6580,
        lng: 139.7016,
        startTime: "2026-01-27T00:00:00+09:00",
        endTime: "2026-02-28T23:59:00+09:00",
        publishAt: "2026-01-26T00:00:00+09:00",
        announcementType: "long_term_campaign",
        status: "pending",
        ownerId: "user-jkl012",
        imageUrl: null,
        reviewNotes: null
    }
];

export const MOCK_SCHEDULED_SPOTS_APPROVED: ScheduledSpot[] = [
    {
        id: "sched-101",
        title: "渋谷ランニングクラブ 週末練習会",
        description: "毎週末、代々木公園で行うランニング練習会です。初心者歓迎！",
        category: "sports",
        lat: 35.6710,
        lng: 139.6960,
        startTime: "2026-01-26T08:00:00+09:00",
        endTime: "2026-01-26T10:00:00+09:00",
        publishAt: "2026-01-25T18:00:00+09:00",
        announcementType: "short_term_notice",
        status: "approved",
        ownerId: "user-run001",
        imageUrl: null,
        reviewNotes: "適切な内容です。公開を承認します。"
    }
];

// ============================================================
// 通報データ
// ============================================================
export const MOCK_SPOT_REPORTS: SpotReport[] = [
    {
        id: "report-001",
        spotId: "spot-xyz789",
        reason: "spam",
        details: "同じ内容の投稿が複数回されています。宣伝目的のスパム行為と思われます。",
        status: "open",
        reporterUid: "user-reporter001",
        createdAt: "2026-01-23T14:30:00+09:00"
    },
    {
        id: "report-002",
        spotId: "spot-abc123",
        reason: "misinfo",
        details: "イベントの日時が間違っています。正しくは2月1日ではなく2月8日です。",
        status: "open",
        reporterUid: "user-reporter002",
        createdAt: "2026-01-23T16:45:00+09:00"
    },
    {
        id: "report-003",
        spotId: "spot-def456",
        reason: "inappropriate",
        details: null,
        status: "open",
        reporterUid: null,
        createdAt: "2026-01-24T09:15:00+09:00"
    }
];

export const MOCK_SPOT_REPORTS_RESOLVED: SpotReport[] = [
    {
        id: "report-101",
        spotId: "spot-old001",
        reason: "safety",
        details: "会場の安全性に問題がありました。",
        status: "resolved",
        reporterUid: "user-reporter003",
        createdAt: "2026-01-20T10:00:00+09:00",
        resolvedAt: "2026-01-21T15:30:00+09:00"
    }
];

// ============================================================
// アナリティクス
// ============================================================
export const MOCK_ANALYTICS_OVERVIEW: AnalyticsOverview = {
    timeRange: "24h",
    generatedAt: new Date().toISOString(),
    metrics: {
        activeUsers: 1284,
        avgMapDwellSeconds: 127.5,
        avgScrollDepth: 0.68,
        spotViews: 4521,
        reportsOpen: 3
    },
    trend: [
        { timestamp: "2026-01-23T00:00:00+09:00", activeUsers: 45, spotViews: 120 },
        { timestamp: "2026-01-23T01:00:00+09:00", activeUsers: 23, spotViews: 67 },
        { timestamp: "2026-01-23T02:00:00+09:00", activeUsers: 12, spotViews: 34 },
        { timestamp: "2026-01-23T03:00:00+09:00", activeUsers: 8, spotViews: 19 },
        { timestamp: "2026-01-23T04:00:00+09:00", activeUsers: 5, spotViews: 11 },
        { timestamp: "2026-01-23T05:00:00+09:00", activeUsers: 4, spotViews: 8 },
        { timestamp: "2026-01-23T06:00:00+09:00", activeUsers: 15, spotViews: 42 },
        { timestamp: "2026-01-23T07:00:00+09:00", activeUsers: 38, spotViews: 89 },
        { timestamp: "2026-01-23T08:00:00+09:00", activeUsers: 72, spotViews: 156 },
        { timestamp: "2026-01-23T09:00:00+09:00", activeUsers: 95, spotViews: 234 },
        { timestamp: "2026-01-23T10:00:00+09:00", activeUsers: 112, spotViews: 287 },
        { timestamp: "2026-01-23T11:00:00+09:00", activeUsers: 128, spotViews: 312 },
        { timestamp: "2026-01-23T12:00:00+09:00", activeUsers: 156, spotViews: 398 },
        { timestamp: "2026-01-23T13:00:00+09:00", activeUsers: 142, spotViews: 356 },
        { timestamp: "2026-01-23T14:00:00+09:00", activeUsers: 135, spotViews: 324 },
        { timestamp: "2026-01-23T15:00:00+09:00", activeUsers: 148, spotViews: 367 },
        { timestamp: "2026-01-23T16:00:00+09:00", activeUsers: 167, spotViews: 423 },
        { timestamp: "2026-01-23T17:00:00+09:00", activeUsers: 189, spotViews: 478 },
        { timestamp: "2026-01-23T18:00:00+09:00", activeUsers: 212, spotViews: 534 },
        { timestamp: "2026-01-23T19:00:00+09:00", activeUsers: 198, spotViews: 489 },
        { timestamp: "2026-01-23T20:00:00+09:00", activeUsers: 176, spotViews: 423 },
        { timestamp: "2026-01-23T21:00:00+09:00", activeUsers: 145, spotViews: 356 },
        { timestamp: "2026-01-23T22:00:00+09:00", activeUsers: 98, spotViews: 234 },
        { timestamp: "2026-01-23T23:00:00+09:00", activeUsers: 67, spotViews: 156 }
    ]
};

// ============================================================
// 通知
// ============================================================
export const MOCK_ADMIN_NOTIFICATIONS: AdminNotification[] = [
    {
        id: "notif-001",
        docId: "notif-001",
        message: "新しい審査待ち投稿があります: 渋谷ハロウィンナイトパーティー",
        createdAt: "2026-01-24T01:30:00+09:00",
        spotId: "sched-001",
        priority: "standard"
    },
    {
        id: "notif-002",
        docId: "notif-002",
        message: "通報が報告されました: スパム行為の疑い",
        createdAt: "2026-01-23T14:35:00+09:00",
        spotId: "spot-xyz789",
        priority: "high"
    },
    {
        id: "notif-003",
        docId: "notif-003",
        message: "長期キャンペーンの審査依頼: 渋谷マークシティ限定スイーツフェア",
        createdAt: "2026-01-23T12:00:00+09:00",
        spotId: "sched-002",
        priority: "standard"
    }
];

// ============================================================
// モックモード設定
// ============================================================
export const ADMIN_MOCK_MODE = true;
