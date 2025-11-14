import { Spot } from "../types";

type PopularSpotsPanelProps = {
  spots: Spot[];
  isLoading: boolean;
  error: unknown;
  onSpotSelect?: (spot: Spot) => void;
  onSpotView?: (spot: Spot) => void;
};

export const PopularSpotsPanel = ({ spots, isLoading, error, onSpotSelect, onSpotView }: PopularSpotsPanelProps) => {
  if (isLoading) {
    return <div className="panel">人気スポットを読み込み中...</div>;
  }

  if (error) {
    const message = error instanceof Error ? error.message : "人気スポットの取得に失敗しました。";
    return <div className="panel error">{message}</div>;
  }

  return (
    <div className="panel">
      <h2>人気ランキング</h2>
      <ul className="popular-spot-list">
        {spots.map((spot, index) => {
          const rank = spot.popularityRank ?? index + 1;
          return (
            <li key={spot.id} className="popular-spot-item">
              <div className="popular-spot-rank">#{rank}</div>
              <div className="popular-spot-body">
                <p className="popular-spot-title">{spot.title}</p>
                <p className="popular-spot-meta">
                  👍 {spot.likes} / 💬 {spot.commentsCount}
                  {typeof spot.popularityScore === "number" && spot.popularityScore > 0 && (
                    <span className="popular-spot-score">スコア {spot.popularityScore}</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                className="button subtle"
                onClick={() => {
                  onSpotView?.(spot);
                  onSpotSelect?.(spot);
                }}
              >
                地図で見る
              </button>
            </li>
          );
        })}
        {spots.length === 0 && <li className="hint">まだランキング対象の投稿がありません。</li>}
      </ul>
    </div>
  );
};
