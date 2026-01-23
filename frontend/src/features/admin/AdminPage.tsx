import { useCallback, useEffect, useState, useMemo, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../providers/AuthProvider";
import { useAdminScheduledSpots } from "../../hooks/useAdminScheduledSpots";
import { useSpotReports } from "../../hooks/useSpotReports";
import { useAdminAnalytics } from "../../hooks/useAdminAnalytics";
import { ScheduledSpot } from "../../hooks/useScheduledSpots";
import { SpotReportStatus } from "../../types";
import { trackEvent } from "../../lib/analytics";
import { AdminLayout, AdminTab } from "./AdminLayout";
import { AdminScheduledSpotsPanel } from "./AdminScheduledSpotsPanel";
import { AdminSpotReportsPanel } from "./AdminSpotReportsPanel";
import { AdminAnalyticsPanel } from "./AdminAnalyticsPanel";
import { useAdminNotifications } from "../../hooks/useAdminNotifications";

const STATUS_OPTIONS: Array<{ value: ScheduledSpot["status"]; label: string }> = [
    { value: "pending", label: "審査待ち" },
    { value: "approved", label: "承認済み" },
    { value: "published", label: "公開済み" },
    { value: "rejected", label: "却下" }
];

const TYPE_OPTIONS: Array<{ value: "all" | ScheduledSpot["announcementType"]; label: string }> = [
    { value: "all", label: "すべて" },
    { value: "short_term_notice", label: "短期" },
    { value: "long_term_campaign", label: "長期" }
];

const SORT_OPTIONS = [
    { value: "publish_at", label: "公開日" },
    { value: "start_time", label: "開始日" }
] as const;

const REPORT_STATUS_OPTIONS: Array<{ value: SpotReportStatus; label: string }> = [
    { value: "open", label: "未対応" },
    { value: "resolved", label: "対応済み" }
];

export const AdminPage = () => {
    const navigate = useNavigate();
    const { currentUser, authToken, hasAdminClaim } = useAuth();
    const [activeTab, setActiveTab] = useState<AdminTab>("scheduled");

    // 予約審査
    const [statusFilter, setStatusFilter] = useState<ScheduledSpot["status"]>("pending");
    const [typeFilter, setTypeFilter] = useState<"all" | ScheduledSpot["announcementType"]>("all");

    const [sortKey, setSortKey] = useState<(typeof SORT_OPTIONS)[number]["value"]>("publish_at");
    const [sortDesc, setSortDesc] = useState(true);

    // 通報
    const [reportStatusFilter, setReportStatusFilter] = useState<SpotReportStatus>("open");

    const { adminScheduledSpots, error, isLoading, mutate } = useAdminScheduledSpots(authToken, statusFilter);
    const shouldFetchReports = activeTab === "reports" ? authToken : undefined;
    const { spotReports, error: reportsError, isLoading: isLoadingReports, mutate: mutateReports } = useSpotReports(shouldFetchReports, reportStatusFilter);
    const shouldFetchAnalytics = activeTab === "analytics" ? authToken : undefined;
    const { overview, error: analyticsError, isLoading: isLoadingAnalytics } = useAdminAnalytics(shouldFetchAnalytics);

    // 通知
    const { notifications, dismissNotification, dismissAll } = useAdminNotifications(currentUser?.uid);

    useEffect(() => {
        if (!currentUser || !hasAdminClaim) {
            navigate("/spots", { replace: true });
        }
    }, [currentUser, hasAdminClaim, navigate]);

    const filteredSpots = useMemo(() => {
        return adminScheduledSpots
            .filter((spot) => (typeFilter === "all" ? true : spot.announcementType === typeFilter))
            .slice()
            .sort((a, b) => {
                const left = sortKey === "publish_at" ? a.publishAt : a.startTime;
                const right = sortKey === "publish_at" ? b.publishAt : b.startTime;
                const delta = new Date(left).getTime() - new Date(right).getTime();
                return sortDesc ? -delta : delta;
            });
    }, [adminScheduledSpots, sortDesc, sortKey, typeFilter]);

    const handleStatusChange = (value: ScheduledSpot["status"]) => {
        setStatusFilter(value);
        trackEvent("admin_filter_status", { status: value });
    };

    const handleRefresh = () => {
        void mutate();
        trackEvent("admin_refresh", {});
    };

    const handleInspectSpot = useCallback((spotId: string) => {
        if (!spotId) return;
        navigate(`/spots?inspect=${spotId}`);
    }, [navigate]);

    if (!currentUser || !authToken || !hasAdminClaim) {
        return (
            <div className="admin-page-loading">
                <p>権限を確認中...</p>
            </div>
        );
    }

    return (
        <AdminLayout
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title={activeTab === "scheduled" ? "審査・管理" : activeTab === "reports" ? "通報" : "統計"}
            actions={
                activeTab === "scheduled" ? (
                    <button type="button" className="admin-refresh-btn" onClick={handleRefresh}>更新</button>
                ) : activeTab === "reports" ? (
                    <button type="button" className="admin-refresh-btn" onClick={() => void mutateReports()}>更新</button>
                ) : null
            }
        >
            {notifications.length > 0 && (
                <section className="admin-notifications">
                    <div className="admin-notifications-header">
                        <span className="admin-notifications-title">通知 ({notifications.length})</span>
                        <button type="button" className="admin-notifications-dismiss-all" onClick={dismissAll}>
                            すべて既読にする
                        </button>
                    </div>
                    <ul className="admin-notifications-list">
                        {notifications.slice(0, 5).map((n) => (
                            <li key={n.id} className="admin-notification-item">
                                <span className="admin-notification-message">{n.message}</span>
                                <button
                                    type="button"
                                    className="admin-notification-dismiss"
                                    onClick={() => dismissNotification(n.id)}
                                    aria-label="既読にする"
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {activeTab === "scheduled" && (
                <div className="admin-content">
                    <div className="admin-filters">
                        <div className="admin-filter-group-top">
                            <div className="admin-status-tabs">
                                {STATUS_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`admin-status-tab ${statusFilter === option.value ? "active" : ""}`}
                                        onClick={() => handleStatusChange(option.value)}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="admin-filter-group-bottom">
                            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
                                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)}>
                                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <button type="button" className="admin-sort-btn" onClick={() => setSortDesc(!sortDesc)}>
                                {sortDesc ? "↓" : "↑"}
                            </button>
                        </div>
                    </div>

                    <p className="admin-result-count">{filteredSpots.length}件</p>

                    <AdminScheduledSpotsPanel
                        spots={filteredSpots}
                        isLoading={isLoading}
                        error={error}
                        authToken={authToken}
                        onActionComplete={() => void mutate()}
                        statusFilter={statusFilter}
                        emptyMessage="該当する告知はありません"
                    />
                </div>
            )}

            {activeTab === "reports" && (
                <div className="admin-content">
                    <div className="admin-filters">
                        <div className="admin-filter-group-top">
                            <div className="admin-status-tabs">
                                {REPORT_STATUS_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`admin-status-tab ${reportStatusFilter === option.value ? "active" : ""}`}
                                        onClick={() => setReportStatusFilter(option.value)}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <AdminSpotReportsPanel
                        reports={spotReports}
                        isLoading={isLoadingReports}
                        error={reportsError}
                        authToken={authToken}
                        statusFilter={reportStatusFilter}
                        onRefresh={() => void mutateReports()}
                        onInspectSpot={handleInspectSpot}
                    />
                </div>
            )}

            {activeTab === "analytics" && (
                <div className="admin-content">
                    {isLoadingAnalytics ? (
                        <p className="admin-loading">読み込み中...</p>
                    ) : analyticsError ? (
                        <p className="admin-error">統計情報の取得に失敗しました</p>
                    ) : overview ? (
                        <AdminAnalyticsPanel overview={overview} />
                    ) : null}
                </div>
            )}
        </AdminLayout>
    );
};
