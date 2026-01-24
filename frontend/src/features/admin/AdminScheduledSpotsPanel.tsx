import { ChangeEvent, useMemo, useState } from "react";

import { useReviewLogs } from "../../hooks/useReviewLogs";
import { trackError, trackEvent } from "../../lib/analytics";
import { ScheduledSpot } from "../../hooks/useScheduledSpots";
import { useReviewTemplates } from "../../hooks/useReviewTemplates";

const YenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const formatPricing = (pricing: ScheduledSpot["pricing"]): string => {
  if (!pricing) return "未設定";
  if (pricing.isFree) return "無料";
  if (pricing.amount !== undefined) {
    const currency = pricing.currency || "¥";
    const label = pricing.label ? ` (${pricing.label})` : "";
    return `${currency}${pricing.amount.toLocaleString()}${label}`;
  }
  return pricing.label || "未設定";
};

const formatDateTime = (startTime: string, endTime?: string): string => {
  const start = new Date(startTime);
  const startStr = start.toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  if (!endTime) return startStr;
  const end = new Date(endTime);
  const endStr = end.toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return `${startStr} - ${endStr}`;
};

const getGoogleMapUrl = (spot: ScheduledSpot): string => {
  const query = spot.locationName
    ? encodeURIComponent(spot.locationName)
    : `${spot.lat},${spot.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
};

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
  // Review is allowed for pending spots AND published spots (to unpublish/reject)
  const canReview = statusFilter === "pending" || statusFilter === "published";
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

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      event: "イベント",
      sale: "セール",
      food: "グルメ",
      music: "音楽",
      art: "アート",
      other: "その他"
    };
    return labels[category] ?? category;
  };

  const getOwnerInitial = (spot: ScheduledSpot) => {
    if (spot.ownerDisplayName) {
      return spot.ownerDisplayName.charAt(0).toUpperCase();
    }
    return spot.ownerId.charAt(0).toUpperCase();
  };

  return (
    <div className="admin-scheduled-panel">
      <div className="admin-card-grid">
        {spots.map((spot) => (
          <article key={spot.id} className="admin-review-card">
            {/* 角のリボンラベル */}
            <div className={`admin-review-card__corner-label type-${spot.announcementType}`}>
              {spot.announcementType === "long_term_campaign" ? "長期" : "短期"}
            </div>

            {/* ヘッダー: 画像 + 店舗情報 */}
            <div className="admin-review-card__header">
              <div className="admin-review-card__image">
                {spot.imageUrl ? (
                  <img src={spot.imageUrl} alt={spot.title} loading="lazy" />
                ) : (
                  <div className="admin-review-card__image-placeholder">
                    {getCategoryLabel(spot.category)}
                  </div>
                )}
              </div>
              <div className="admin-review-card__owner">
                <div className="admin-review-card__owner-row">
                  <div className="admin-review-card__owner-avatar">
                    {spot.ownerPhotoUrl ? (
                      <img src={spot.ownerPhotoUrl} alt="" />
                    ) : (
                      getOwnerInitial(spot)
                    )}
                  </div>
                  <span className="admin-review-card__user-id">
                    {spot.ownerId.slice(0, 8)}...
                  </span>
                </div>
                <h3 className="admin-review-card__spot-title">{spot.title}</h3>
                <span className="admin-review-card__catchcopy">
                  {spot.speechBubble || "キャッチコピー未設定"}
                </span>
              </div>
            </div>

            {/* 詳細リスト */}
            <div className="admin-review-card__details">
              <div className="admin-review-card__detail-item">
                <span className="admin-review-card__detail-icon"><YenIcon /></span>
                <span className="admin-review-card__detail-text">{formatPricing(spot.pricing)}</span>
              </div>
              <div className="admin-review-card__detail-item">
                <span className="admin-review-card__detail-icon"><CalendarIcon /></span>
                <span className="admin-review-card__detail-text">
                  {formatDateTime(spot.startTime, spot.endTime)}
                </span>
              </div>
              <div className="admin-review-card__detail-item">
                <span className="admin-review-card__detail-icon"><PhoneIcon /></span>
                <span className="admin-review-card__detail-text">
                  {spot.contact?.phone || "未登録"}
                </span>
              </div>
              <div className="admin-review-card__detail-item">
                <span className="admin-review-card__detail-icon"><UserIcon /></span>
                <span className="admin-review-card__detail-text">
                  {spot.ownerDisplayName || "アカウント名未設定"}
                </span>
              </div>
            </div>

            {/* 説明文 */}
            <p className="admin-review-card__description">{spot.description}</p>

            {/* Google Map検索ボタン */}
            <a
              className="admin-review-card__map-btn"
              href={getGoogleMapUrl(spot)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Mapで検索
            </a>

            {/* SNSリンク */}
            {spot.externalLinks && spot.externalLinks.length > 0 && (
              <div className="admin-review-card__links">
                <div className="admin-review-card__links-label">
                  <LinkIcon /> URLs
                </div>
                <div className="admin-review-card__links-icons">
                  {spot.externalLinks.map((link) => (
                    <a
                      key={link.url}
                      className="admin-review-card__link-item"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 審査メモ */}
            {spot.reviewNotes && (
              <div className="admin-review-card__notes">
                <span className="admin-review-card__notes-label">審査メモ:</span>
                <span className="admin-review-card__notes-text">{spot.reviewNotes}</span>
              </div>
            )}

            {/* 審査アクション */}
            <div className="admin-review-card__actions">
              {canReview ? (
                <>
                  <details className="admin-review-card__review-details">
                    <summary>コメント・テンプレート</summary>
                    <div className="admin-review-card__review-fields">
                      <textarea
                        className="admin-review-card__review-textarea"
                        value={getReviewDraft(spot.id).note}
                        placeholder="審査コメント（却下時は必須）"
                        onChange={(event) => handleNoteChange(spot.id, event)}
                        rows={2}
                        aria-label="審査コメント"
                      />
                      <select
                        className="admin-review-card__review-select"
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
                      {isTemplateLoading ? <span className="admin-hint">読み込み中...</span> : null}
                      {templateError ? <span className="admin-hint error">取得失敗</span> : null}
                    </div>
                  </details>
                  <div className="admin-review-card__action-buttons">
                    <button
                      type="button"
                      className="admin-review-card__btn-approve"
                      disabled={submittingId === spot.id || spot.status === "published"}
                      onClick={() => void handleReview(spot, "approved")}
                    >
                      承認
                    </button>
                    <button
                      type="button"
                      className="admin-review-card__btn-reject"
                      disabled={submittingId === spot.id}
                      onClick={() => void handleReview(spot, "rejected")}
                    >
                      {spot.status === "published" ? "公開停止" : "却下"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="admin-review-card__status-only">
                  <span className={`badge status-${spot.status}`.trim()}>{spot.status.toUpperCase()}</span>
                </div>
              )}
              <button
                type="button"
                className="admin-review-card__btn-secondary"
                onClick={() => setExpandedSpotId((current) => (current === spot.id ? null : spot.id))}
              >
                {expandedSpotId === spot.id ? "履歴を閉じる" : "履歴を表示"}
              </button>
            </div>

            {/* 履歴セクション */}
            {expandedSpotId === spot.id && (
              <div className="admin-review-card__history">
                <ReviewLogSection spotId={spot.id} authToken={authToken} templateLabelMap={templateLabelMap} />
              </div>
            )}
          </article>
        ))}
        {spots.length === 0 && <div className="admin-empty">{emptyMessage ?? "該当する告知はありません。"}</div>}
      </div>
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
