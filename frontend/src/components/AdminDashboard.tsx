import { ChangeEvent, useMemo, useState } from "react";
import { useAdminScheduledSpots } from "../hooks/useAdminScheduledSpots";
import { ScheduledSpot } from "../hooks/useScheduledSpots";
import { trackEvent } from "../lib/analytics";
import { AdminScheduledSpotsPanel } from "./AdminScheduledSpotsPanel";

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

const getStatusLabel = (status: ScheduledSpot["status"]) => {
  const option = STATUS_OPTIONS.find((item) => item.value === status);
  return option ? option.label : status;
};

export const AdminDashboard = ({ authToken, onClose }: { authToken: string; onClose: () => void }) => {
  const [statusFilter, setStatusFilter] = useState<ScheduledSpot["status"]>("pending");
  const [typeFilter, setTypeFilter] = useState<"all" | ScheduledSpot["announcementType"]>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<(typeof SORT_OPTIONS)[number]["value"]>("publish_at");
  const [sortDesc, setSortDesc] = useState(true);

  const { adminScheduledSpots, error, isLoading, mutate } = useAdminScheduledSpots(authToken, statusFilter);

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

  return (
    <div className="panel admin-dashboard">
      <header className="floating-header">
        <h2>審査ダッシュボード</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="閉じる"
          onClick={() => {
            trackEvent("admin_dashboard_close", {});
            onClose();
          }}
        >
          ✕
        </button>
      </header>
      <div className="admin-toolbar">
        <div className="status-group" role="tablist" aria-label="ステータスフィルタ">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`chip ${statusFilter === option.value ? "active" : ""}`.trim()}
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
    </div>
  );
};
