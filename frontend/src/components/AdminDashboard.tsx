import { ChangeEvent, useMemo, useState } from "react";

import { useAdminScheduledSpots } from "../hooks/useAdminScheduledSpots";
import { useSpotReports } from "../hooks/useSpotReports";
import { useAdminAnalytics } from "../hooks/useAdminAnalytics";
import { ScheduledSpot } from "../hooks/useScheduledSpots";
import { SpotReportStatus } from "../types";
import { trackEvent } from "../lib/analytics";
import { AdminScheduledSpotsPanel } from "./AdminScheduledSpotsPanel";
import { AdminSpotReportsPanel } from "./AdminSpotReportsPanel";
import { AdminAnalyticsPanel } from "./AdminAnalyticsPanel";

const STATUS_OPTIONS: Array<{ value: ScheduledSpot["status"]; label: string }> = [
  { value: "pending", label: "審査待ち" },
  { value: "approved", label: "承認済み" },
  { value: "published", label: "公開済み" },
  { value: "rejected", label: "却下" },
  { value: "cancelled", label: "キャンセル" }
];

const TYPE_OPTIONS: Array<{ value: "all" | ScheduledSpot["announcementType"]; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "short_term_notice", label: "短期告知" },
  { value: "long_term_campaign", label: "長期キャンペーン" }
];

const SORT_OPTIONS = [
  { value: "publish_at", label: "公開予定日" },
  { value: "start_time", label: "開始時刻" }
] as const;

const REPORT_STATUS_OPTIONS: Array<{ value: SpotReportStatus; label: string }> = [
  { value: "open", label: "未対応" },
  { value: "resolved", label: "対応済み" }
];

type AdminPanelView = "scheduled" | "reports" | "analytics";

type AdminDashboardProps = {
  authToken: string;
  onClose: () => void;
  onInspectSpot?: (spotId: string) => void;
};

const getStatusLabel = (status: ScheduledSpot["status"]) => {
  const option = STATUS_OPTIONS.find((item) => item.value === status);
  return option ? option.label : status;
};

export const AdminDashboard = ({ authToken, onClose, onInspectSpot }: AdminDashboardProps) => {
  const [statusFilter, setStatusFilter] = useState<ScheduledSpot["status"]>("pending");
  const [typeFilter, setTypeFilter] = useState<"all" | ScheduledSpot["announcementType"]>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<(typeof SORT_OPTIONS)[number]["value"]>("publish_at");
  const [sortDesc, setSortDesc] = useState(true);
  const [panelView, setPanelView] = useState<AdminPanelView>("scheduled");
  const [reportStatusFilter, setReportStatusFilter] = useState<SpotReportStatus>("open");

  const { adminScheduledSpots, error, isLoading, mutate } = useAdminScheduledSpots(authToken, statusFilter);
  const shouldFetchReports = panelView === "reports" ? authToken : undefined;
  const {
    spotReports,
    error: reportsError,
    isLoading: isLoadingReports,
    mutate: mutateReports
  } = useSpotReports(shouldFetchReports, reportStatusFilter);

  const shouldFetchAnalytics = panelView === "analytics" ? authToken : undefined;
  const { overview, error: analyticsError, isLoading: isLoadingAnalytics, mutate: mutateAnalytics } = useAdminAnalytics(shouldFetchAnalytics);

  const filteredSpots = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    return adminScheduledSpots
      .filter((spot) => (typeFilter === "all" ? true : spot.announcementType === typeFilter))
      .filter((spot) => {
        if (!normalizedQuery) return true;
        const haystacks = [spot.title, spot.description, spot.ownerId].filter(Boolean) as string[];
        return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .slice()
      .sort((a, b) => {
        const left = sortKey === "publish_at" ? a.publishAt : a.startTime;
        const right = sortKey === "publish_at" ? b.publishAt : b.startTime;
        const leftTime = new Date(left).getTime();
        const rightTime = new Date(right).getTime();
        const delta = leftTime - rightTime;
        return sortDesc ? -delta : delta;
      });
  }, [adminScheduledSpots, searchTerm, sortDesc, sortKey, typeFilter]);

  const handleStatusChange = (value: ScheduledSpot["status"]) => {
    setStatusFilter(value);
    trackEvent("admin_filter_status", { status: value });
  };

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as "all" | ScheduledSpot["announcementType"];
    setTypeFilter(value);
    trackEvent("admin_filter_type", { type: value });
  };

  const handleSortKeyChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSortKey(event.target.value as (typeof SORT_OPTIONS)[number]["value"]);
    trackEvent("admin_sort_change", { sortKey: event.target.value });
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleRefresh = () => {
    void mutate();
    trackEvent("admin_refresh", {});
  };

  const handleToggleSortDir = () => {
    setSortDesc((prev) => !prev);
    trackEvent("admin_sort_direction", { descending: !sortDesc });
  };

  const heroMetrics = (
    <div className="hero-metrics-row">
      <div className="hero-metric">
        <span>予約</span>
        <strong>{filteredSpots.length}</strong>
      </div>
      <div className="hero-metric">
        <span>通報</span>
        <strong>{spotReports.length}</strong>
      </div>
    </div>
  );

  return (
    <div className="panel admin-dashboard">
      <header className="admin-dashboard-hero">
        <div className="hero-text-row">
          <p className="eyebrow">管理パネル</p>
          <button
            type="button"
            className="icon-button hero-close"
            aria-label="閉じる"
            onClick={() => {
              trackEvent("admin_dashboard_close", {});
              onClose();
            }}
          >
            ✕
          </button>
        </div>
        {heroMetrics}
        <div className="segment-control" role="tablist" aria-label="管理タブ">
          <button
            type="button"
            className={`segment-button ${panelView === "scheduled" ? "active" : ""}`.trim()}
            onClick={() => setPanelView("scheduled")}
          >
            予約
          </button>
          <button
            type="button"
            className={`segment-button ${panelView === "reports" ? "active" : ""}`.trim()}
            onClick={() => setPanelView("reports")}
          >
            通報
          </button>
          <button
            type="button"
            className={`segment-button ${panelView === "analytics" ? "active" : ""}`.trim()}
            onClick={() => setPanelView("analytics")}
          >
            アナリティクス
          </button>
        </div>
      </header>

      {panelView === "scheduled" ? (
        <>
          <div className="admin-toolbar">
            <div className="status-group" role="tablist" aria-label="ステータスフィルタ">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`segment-button ${statusFilter === option.value ? "active" : ""}`.trim()}
                  onClick={() => handleStatusChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="filter-row">
              <label className="filter control">
                <span>種別</span>
                <select value={typeFilter} onChange={handleTypeChange}>
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter control">
                <span>ソート</span>
                <select value={sortKey} onChange={handleSortKeyChange}>
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="button subtle" onClick={handleToggleSortDir}>
                {sortDesc ? "▼降順" : "▲昇順"}
              </button>
              <label className="filter search">
                <span className="sr-only">検索</span>
                <input type="search" value={searchTerm} onChange={handleSearchChange} placeholder="タイトル / 投稿者ID" />
              </label>
              <button type="button" className="button subtle" onClick={handleRefresh}>
                再読込
              </button>
            </div>
            <p className="hint small">{getStatusLabel(statusFilter)}: {filteredSpots.length}件表示中</p>
          </div>
          <AdminScheduledSpotsPanel
            spots={filteredSpots}
            isLoading={isLoading}
            error={error}
            authToken={authToken}
            onActionComplete={() => void mutate()}
            statusFilter={statusFilter}
            emptyMessage={statusFilter === "pending" ? "審査待ちの告知はありません。" : "該当する告知は見つかりません。"}
          />
        </>
      ) : panelView === "reports" ? (
        <>
          <div className="admin-toolbar">
            <div className="status-group" role="tablist" aria-label="通報フィルタ">
              {REPORT_STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`segment-button ${reportStatusFilter === option.value ? "active" : ""}`.trim()}
                  onClick={() => setReportStatusFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="filter-row">
              <button type="button" className="button subtle" onClick={() => void mutateReports()}>
                再読込
              </button>
            </div>
          </div>
          <AdminSpotReportsPanel
            reports={spotReports}
            isLoading={isLoadingReports}
            error={reportsError}
            authToken={authToken}
            statusFilter={reportStatusFilter}
            onRefresh={() => void mutateReports()}
            onInspectSpot={onInspectSpot}
          />
        </>
      ) : (
        <>
          {isLoadingAnalytics ? (
            <div className="panel">アナリティクスを読み込み中...</div>
          ) : analyticsError ? (
            <div className="panel error">アナリティクス情報の取得に失敗しました。</div>
          ) : overview ? (
            <AdminAnalyticsPanel overview={overview} />
          ) : null}
        </>
      )}
    </div>
  );
};
