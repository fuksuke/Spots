import { KeyedMutator } from "swr";
import { ScheduledSpot } from "../hooks/useScheduledSpots";

const statusLabel: Record<ScheduledSpot["status"], string> = {
  pending: "審査待ち",
  approved: "公開予定",
  published: "公開済み",
  rejected: "却下",
  cancelled: "キャンセル済み"
};

type ScheduledSpotsPanelProps = {
  spots: ScheduledSpot[];
  isLoading: boolean;
  error: unknown;
  authToken: string;
  mutate: KeyedMutator<ScheduledSpot[]>;
  onCancelled?: () => void;
};

export const ScheduledSpotsPanel = ({ spots, isLoading, error, authToken, mutate, onCancelled }: ScheduledSpotsPanelProps) => {
  const handleCancel = async (spot: ScheduledSpot) => {
    if (!window.confirm(`「${spot.title}」の予約をキャンセルしますか？`)) {
      return;
    }
    try {
      const response = await fetch(`/api/scheduled_spots/${spot.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "キャンセルに失敗しました");
      }
      await mutate();
      onCancelled?.();
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "キャンセルに失敗しました";
      window.alert(message);
    }
  };

  if (isLoading) {
    return <div className="panel">予約投稿を読み込み中...</div>;
  }

  if (error) {
    const message = error instanceof Error ? error.message : "予約投稿の取得に失敗しました";
    return <div className="panel error">{message}</div>;
  }

  return (
    <div className="panel">
      <h2>予約中の告知</h2>
      <ul className="scheduled-spot-list">
        {spots.map((spot) => (
          <li key={spot.id} className="scheduled-spot-item">
            <div className="scheduled-spot-main">
              <p className="scheduled-spot-status">{statusLabel[spot.status]}</p>
              <h3>{spot.title}</h3>
              <p className="scheduled-spot-meta">
                公開予定: {new Date(spot.publishAt).toLocaleString("ja-JP")}
                <br />イベント開始: {new Date(spot.startTime).toLocaleString("ja-JP")}
              </p>
              {spot.reviewNotes && <p className="status error">{spot.reviewNotes}</p>}
            </div>
            <div className="scheduled-spot-actions">
              {spot.status === "pending" || spot.status === "approved" ? (
                <button type="button" className="button subtle" onClick={() => void handleCancel(spot)}>
                  キャンセル
                </button>
              ) : null}
            </div>
          </li>
        ))}
        {spots.length === 0 && <li className="hint">現在予約中の告知はありません。</li>}
      </ul>
    </div>
  );
};
