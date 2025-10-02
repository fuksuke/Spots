import { ChangeEvent, useMemo, useState } from "react";

import { useReviewLogs } from "../hooks/useReviewLogs";
import { trackError, trackEvent } from "../lib/analytics";
import { ScheduledSpot } from "../hooks/useScheduledSpots";
import { useReviewTemplates } from "../hooks/useReviewTemplates";

type AdminScheduledSpotsPanelProps = {
  spots: ScheduledSpot[];
  isLoading: boolean;
  error: unknown;
  authToken: string;
  onActionComplete: () => void;
  statusFilter: ScheduledSpot["status"];
  emptyMessage?: string;
};

type ReviewDraft = {
  templateId: string | null;
  note: string;
};

const DEFAULT_REJECT_MESSAGE = "却下時はコメントを入力してください。";

export const AdminScheduledSpotsPanel = ({
  spots,
  isLoading,
  error,
  authToken,
  onActionComplete,
  statusFilter,
  emptyMessage
}: AdminScheduledSpotsPanelProps) => {
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [expandedSpotId, setExpandedSpotId] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const canReview = statusFilter === "pending";
  const { templates, isLoading: isTemplateLoading, error: templateError } = useReviewTemplates(authToken);

  const templateOptions = useMemo(() => {
    return templates.map((template) => ({
      ...template,
      displayLabel: `${template.status === "rejected" ? "却下" : "承認"} / ${template.label}`
    }));
  }, [templates]);

  const templateLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    templateOptions.forEach((template) => {
      map.set(template.id, template.displayLabel);
    });
    return map;
  }, [templateOptions]);

  const getReviewDraft = (spotId: string): ReviewDraft =>
    reviewDrafts[spotId] ?? { templateId: null, note: "" };

  const updateReviewDraft = (spotId: string, updates: Partial<ReviewDraft>) => {
    setReviewDrafts((current) => ({
      ...current,
      [spotId]: { ...getReviewDraft(spotId), ...updates }
    }));
  };

  const clearReviewDraft = (spotId: string) => {
    setReviewDrafts((current) => {
      const { [spotId]: _removed, ...rest } = current;
      return rest;
    });
  };

  const handleTemplateChange = (spotId: string, event: ChangeEvent<HTMLSelectElement>) => {
    const templateId = event.target.value || null;
    const template = templateOptions.find((item) => item.id === templateId);
    const currentDraft = getReviewDraft(spotId);
    updateReviewDraft(spotId, {
      templateId,
      note:
        template && currentDraft.note.trim().length === 0
          ? template.defaultNotes
          : currentDraft.note
    });
  };

  const handleNoteChange = (spotId: string, event: ChangeEvent<HTMLTextAreaElement>) => {
    updateReviewDraft(spotId, { note: event.target.value });
  };

  const handleReview = async (spot: ScheduledSpot, status: "approved" | "rejected") => {
    if (!canReview) return;
    const draft = getReviewDraft(spot.id);
    const selectedTemplate = draft.templateId
      ? templateOptions.find((item) => item.id === draft.templateId)
      : undefined;
    const templateMatchesStatus = selectedTemplate && selectedTemplate.status === status;

    let reviewNotes = draft.note.trim();
    if (templateMatchesStatus && reviewNotes.length === 0) {
      reviewNotes = selectedTemplate.defaultNotes.trim();
    }

    if (status === "rejected" && reviewNotes.length === 0) {
      window.alert(DEFAULT_REJECT_MESSAGE);
      return;
    }

    const payload: Record<string, unknown> = {
      status,
      reviewNotes: reviewNotes.length > 0 ? reviewNotes : undefined
    };

    if (templateMatchesStatus) {
      payload.templateId = selectedTemplate.id;
    }

    if (status === "approved" && spot.announcementType === "long_term_campaign") {
      payload.promotion = {
        headline: spot.title,
        priority: 0
      };
    }

    try {
      setSubmittingId(spot.id);
      const response = await fetch(`/api/scheduled_spots/${spot.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "審査の更新に失敗しました");
      }
      trackEvent("admin_review_decision", {
        spotId: spot.id,
        announcementType: spot.announcementType,
        status
      });
      onActionComplete();
      clearReviewDraft(spot.id);
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "審査の更新に失敗しました";
      window.alert(message);
    } finally {
      setSubmittingId(null);
    }
  };

  if (isLoading) {
    return <div className="panel">審査待ち告知を読み込み中...</div>;
  }

  if (error) {
    const message = error instanceof Error ? error.message : "審査待ち告知の取得に失敗しました";
    return <div className="panel error">{message}</div>;
  }

  return (
    <div className="panel admin-scheduled-panel">
      <h2>管理者審査</h2>
      <p className="hint">
        ステータス: {statusFilter.toUpperCase()} / 表示件数: {spots.length}件
      </p>
      <ul className="admin-scheduled-list">
        {spots.map((spot) => (
          <li key={spot.id} className="admin-scheduled-item">
            <div className="admin-scheduled-main">
              <span className="admin-scheduled-type">
                {spot.announcementType === "long_term_campaign" ? "長期キャンペーン" : "短期告知"}
              </span>
              <h3>{spot.title}</h3>
              <p className="admin-scheduled-meta">
                公開予定: {new Date(spot.publishAt).toLocaleString("ja-JP")}
                <br />開始: {new Date(spot.startTime).toLocaleString("ja-JP")}
                <br />投稿者: {spot.ownerId}
              </p>
              <p className="admin-scheduled-description">{spot.description}</p>
              {spot.reviewNotes ? <p className="admin-scheduled-notes">メモ: {spot.reviewNotes}</p> : null}
            </div>
            {canReview ? (
              <div className="admin-moderation-tools">
                <div className="moderation-note">
                  <label className="control">
                    <span>審査コメント</span>
                    <textarea
                      className="textarea"
                      value={getReviewDraft(spot.id).note}
                      placeholder={
                        statusFilter === "pending"
                          ? "審査結果のコメントを入力してください"
                          : ""
                      }
                      onChange={(event) => handleNoteChange(spot.id, event)}
                      rows={3}
                      aria-label="審査コメント"
                    />
                  </label>
                  <label className="control">
                    <span>テンプレート</span>
                    <select
                      className="input"
                      value={getReviewDraft(spot.id).templateId ?? ""}
                      onChange={(event) => handleTemplateChange(spot.id, event)}
                    >
                      <option value="">テンプレートを選択</option>
                      {templateOptions.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.displayLabel}
                        </option>
                      ))}
                    </select>
                    {isTemplateLoading ? <span className="hint small">テンプレートを読み込み中...</span> : null}
                    {templateError ? <span className="hint error">テンプレートの取得に失敗しました</span> : null}
                  </label>
                </div>
                <div className="admin-scheduled-actions">
                  <button
                    type="button"
                    className="button subtle"
                    disabled={submittingId === spot.id}
                    onClick={() => void handleReview(spot, "approved")}
                  >
                    承認
                  </button>
                  <button
                    type="button"
                    className="button subtle"
                    disabled={submittingId === spot.id}
                    onClick={() => void handleReview(spot, "rejected")}
                  >
                    却下
                  </button>
                </div>
              </div>
            ) : (
              <div className="admin-scheduled-status">
                <span className={`badge status-${spot.status}`.trim()}>{spot.status.toUpperCase()}</span>
              </div>
            )}
            <div className="admin-scheduled-meta-actions">
              <button
                type="button"
                className="button subtle"
                onClick={() => setExpandedSpotId((current) => (current === spot.id ? null : spot.id))}
              >
                {expandedSpotId === spot.id ? "履歴を閉じる" : "履歴を表示"}
              </button>
            </div>
            {expandedSpotId === spot.id ? (
              <ReviewLogSection spotId={spot.id} authToken={authToken} templateLabelMap={templateLabelMap} />
            ) : null}
          </li>
        ))}
        {spots.length === 0 && <li className="hint">{emptyMessage ?? "該当する告知はありません。"}</li>}
      </ul>
    </div>
  );
};

const ReviewLogSection = ({
  spotId,
  authToken,
  templateLabelMap
}: {
  spotId: string;
  authToken: string;
  templateLabelMap?: Map<string, string>;
}) => {
  const { logs, isLoading, error } = useReviewLogs(spotId, authToken);
  const [isDownloading, setDownloading] = useState(false);

  const handleExport = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/admin/scheduled_spots/${encodeURIComponent(spotId)}/logs?format=csv`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to export logs (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `review-logs-${spotId}-${Date.now()}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      trackEvent("admin_logs_export", { spotId });
    } catch (exportError) {
      trackError("admin_logs_export_error", exportError, { spotId });
      window.alert("履歴のエクスポートに失敗しました");
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return <p className="hint small">履歴を読み込み中...</p>;
  }

  if (error) {
    const message = error instanceof Error ? error.message : "履歴の取得に失敗しました";
    return <p className="hint error">{message}</p>;
  }

  if (logs.length === 0) {
    return (
      <div className="review-log-list">
        <p className="hint small">レビュー履歴はまだありません。</p>
        <button type="button" className="button subtle" disabled={isDownloading} onClick={() => void handleExport()}>
          {isDownloading ? "エクスポート中..." : "CSVダウンロード"}
        </button>
      </div>
    );
  }

  return (
    <ul className="review-log-list">
      <li className="review-log-export">
        <button type="button" className="button subtle" disabled={isDownloading} onClick={() => void handleExport()}>
          {isDownloading ? "エクスポート中..." : "CSVダウンロード"}
        </button>
      </li>
      {logs.map((log) => (
        <li key={log.id} className="review-log-item">
          <div className="review-log-header">
            <span className={`badge status-${log.nextStatus}`.trim()}>{log.nextStatus.toUpperCase()}</span>
            <span className="review-log-time">{new Date(log.createdAt).toLocaleString("ja-JP")}</span>
          </div>
          <p className="review-log-meta">
            審査担当: {log.actorEmail ?? log.actorUid} / 変更前: {log.previousStatus.toUpperCase()}
          </p>
          {log.reviewTemplateId ? (
            <p className="review-log-meta">
              テンプレート: {templateLabelMap?.get(log.reviewTemplateId) ?? log.reviewTemplateId}
            </p>
          ) : null}
          {log.reviewNotes ? <p className="review-log-notes">{log.reviewNotes}</p> : null}
        </li>
      ))}
    </ul>
  );
};
