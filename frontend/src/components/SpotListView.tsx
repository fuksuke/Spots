import { useMemo } from "react";
import { Spot } from "../types";

type SpotListViewProps = {
  spots: Spot[];
  isLoading: boolean;
  error: unknown;
  onSpotSelect?: (spot: Spot) => void;
};

const formatRange = (start: string, end: string) => {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
};

export const SpotListView = ({ spots, isLoading, error, onSpotSelect }: SpotListViewProps) => {
  const sortedSpots = useMemo(() => {
    return [...spots].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [spots]);

  if (isLoading) {
    return <div className="list-placeholder">投稿を読み込み中...</div>;
  }

  if (error) {
    return <div className="list-placeholder error">イベントを読み込めませんでした。</div>;
  }

  if (sortedSpots.length === 0) {
    return <div className="list-placeholder">該当するイベントが見つかりません。</div>;
  }

  return (
    <div className="spot-list" aria-label="イベントリスト">
      {sortedSpots.map((spot) => (
        <article key={spot.id} className="spot-card" onClick={() => onSpotSelect?.(spot)}>
          <div className="spot-card-media">
            {spot.imageUrl ? (
              <img src={spot.imageUrl} alt={spot.title} loading="lazy" />
            ) : (
              <div className={`spot-card-placeholder ${spot.category}`.trim()} aria-hidden="true">
                {spot.category.toUpperCase()}
              </div>
            )}
          </div>
          <div className="spot-card-body">
            <h3>{spot.title}</h3>
            <p className="time">{formatRange(spot.startTime, spot.endTime)}</p>
            <p className="description">{spot.description}</p>
            <div className="meta">
              <span className="category">#{spot.category}</span>
              <span className="stats">👍 {spot.likes}</span>
              <span className="stats">💬 {spot.commentsCount}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};
