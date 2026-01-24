import { useState } from "react";

import { SpotReport, SpotReportStatus } from "../../types";

const REASON_LABELS: Record<string, string> = {
  spam: "スパム・宣伝",
  misinfo: "誤った情報",
  inappropriate: "不適切な内容",
  safety: "安全上の問題",
  other: "その他"
};

type AdminSpotReportsPanelProps = {
  reports: SpotReport[];
  isLoading: boolean;
  error: unknown;
  authToken: string;
  statusFilter: SpotReportStatus;
  onRefresh: () => void;
  onInspectSpot?: (spotId: string) => void;
};

export const AdminSpotReportsPanel = ({
  reports,
  isLoading,
  error,
  authToken,
  statusFilter,
  onRefresh,
  onInspectSpot
}: AdminSpotReportsPanelProps) => {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleUpdateStatus = async (report: SpotReport, nextStatus: SpotReportStatus) => {
    if (updatingId) return;
    try {
      setUpdatingId(report.id);
      const response = await fetch(`/api/admin/spot_reports/${report.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "通報ステータスの更新に失敗しました");
      }
      onRefresh();
    } catch (patchError) {
      const message = patchError instanceof Error ? patchError.message : "通報ステータスの更新に失敗しました";
      window.alert(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteSpot = async (report: SpotReport) => {
    if (!window.confirm("本当にこのスポットを削除しますか？\nこの操作は取り消せません。")) return;
    if (updatingId) return;

    try {
      setUpdatingId(report.id);
      // 1. Delete the spot
      const deleteRes = await fetch(`/api/spots/${report.spotId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!deleteRes.ok) {
        throw new Error("スポットの削除に失敗しました");
      }

      // 2. Mark report as resolved
      const resolveRes = await fetch(`/api/admin/spot_reports/${report.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ status: "resolved" })
      });
      if (!resolveRes.ok) {
        // Log warning but don't fail properly since spot is gone
        console.warn("Retport status update failed after spot deletion");
      }

      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "削除処理に失敗しました";
      window.alert(message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return <div className="panel admin-spot-reports-panel">通報を読み込み中...</div>;
  }

  if (error) {
    const message = error instanceof Error ? error.message : "通報の取得に失敗しました";
    return (
      <div className="panel admin-spot-reports-panel error">
        <p>{message}</p>
      </div>
    );
  }

  return (
    <div className="admin-reports-panel">
      <div className="admin-report-grid">
        {reports.map((report) => {
          const createdAt = new Date(report.createdAt);
          const createdAtLabel = createdAt.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
          const createdTimeLabel = createdAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
          const reasonLabel = REASON_LABELS[report.reason] ?? report.reason;
          const isResolved = report.status === "resolved";

          return (
            <article key={report.id} className={`admin-report-card-v2 ${isResolved ? "resolved" : "open"}`}>
              {/* ヘッダー：ステータスと理由 */}
              <div className="admin-report-card-header">
                <div className="admin-report-card-status">
                  <span className={`status-indicator ${isResolved ? "resolved" : "open"}`} />
                  <span className="status-text">{isResolved ? "対応済み" : "未対応"}</span>
                </div>
                <span className={`admin-report-reason-badge reason-${report.reason}`}>
                  {reasonLabel}
                </span>
              </div>

              {/* メインコンテンツ */}
              <div className="admin-report-card-body">
                <div className="admin-report-spot-id">
                  <span className="label">スポットID:</span>
                  <code>{report.spotId.slice(0, 12)}...</code>
                </div>
                <div className="admin-report-details-box">
                  {report.details ? (
                    <p className="details-text">{report.details}</p>
                  ) : (
                    <p className="details-empty">詳細情報なし</p>
                  )}
                </div>
                <div className="admin-report-meta">
                  <span className="meta-date">{createdAtLabel}</span>
                  <span className="meta-time">{createdTimeLabel}</span>
                </div>
              </div>

              {/* アクションボタン */}
              <div className="admin-report-card-actions">
                <button
                  type="button"
                  className="admin-report-btn view"
                  onClick={() => onInspectSpot?.(report.spotId)}
                >
                  確認
                </button>
                <button
                  type="button"
                  className="admin-report-btn delete"
                  disabled={Boolean(updatingId) || isResolved}
                  onClick={() => void handleDeleteSpot(report)}
                >
                  強制削除
                </button>
                <button
                  type="button"
                  className={`admin-report-btn ${isResolved ? "reopen" : "resolve"}`}
                  disabled={Boolean(updatingId)}
                  onClick={() => handleUpdateStatus(report, isResolved ? "open" : "resolved")}
                >
                  {isResolved ? "再開" : "解決"}
                </button>
              </div>
            </article>
          );
        })}
        {reports.length === 0 ? (
          <div className="admin-empty">{statusFilter === "open" ? "未対応の通報はありません。" : "対応済み通報はありません。"}</div>
        ) : null}
      </div>
    </div>
  );
};
