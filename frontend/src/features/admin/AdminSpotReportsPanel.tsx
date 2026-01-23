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
      <ul className="admin-report-list">
        {reports.map((report) => {
          const createdAtLabel = new Date(report.createdAt).toLocaleDateString("ja-JP");
          const reasonLabel = REASON_LABELS[report.reason] ?? report.reason;
          const isResolved = report.status === "resolved";

          return (
            <li key={report.id} className={`admin-report-card ${isResolved ? "resolved" : "open"}`}>
              <div className="admin-report-header">
                <span className={`admin-report-status ${isResolved ? "resolved" : "open"}`}>
                  {isResolved ? "対応済み" : "未対応"}
                </span>
                <span className="admin-report-reason">{reasonLabel}</span>
                <span className="admin-report-date">{createdAtLabel}</span>
              </div>
              <div className="admin-report-body">
                <p className="admin-report-spot">スポット: {report.spotId}</p>
                {report.details ? (
                  <p className="admin-report-details">{report.details}</p>
                ) : (
                  <p className="admin-report-details muted">詳細なし</p>
                )}
              </div>
              <div className="admin-report-actions">
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => onInspectSpot?.(report.spotId)}
                >
                  スポットを確認
                </button>
                <button
                  type="button"
                  className={isResolved ? "admin-btn-secondary" : "admin-btn-primary"}
                  disabled={Boolean(updatingId)}
                  onClick={() => handleUpdateStatus(report, isResolved ? "open" : "resolved")}
                >
                  {isResolved ? "未対応に戻す" : "対応済みにする"}
                </button>
              </div>
            </li>
          );
        })}
        {reports.length === 0 ? (
          <li className="admin-empty">{statusFilter === "open" ? "未対応の通報はありません。" : "対応済み通報はありません。"}</li>
        ) : null}
      </ul>
    </div>
  );
};
