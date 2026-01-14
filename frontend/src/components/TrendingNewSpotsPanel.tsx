import { Spot } from "../types";

type TrendingNewSpotsPanelProps = {
  spots: Spot[];
  isLoading: boolean;
  error: unknown;
  onSpotSelect?: (spot: Spot) => void;
  onSpotView?: (spot: Spot) => void;
};

export const TrendingNewSpotsPanel = ({
  spots,
  isLoading,
  error,
  onSpotSelect,
  onSpotView
}: TrendingNewSpotsPanelProps) => {
  if (isLoading) {
    return <div className="panel">注目の新着を読み込み中...</div>;
  }

  if (error) {
    const message = error instanceof Error ? error.message : "注目の新着の取得に失敗しました。";
    return <div className="panel error">{message}</div>;
  }

  if (spots.length === 0) {
    return null; // Hide section if no trending new spots
  }

  return (
    <section className="trending-section trending-new-section">
      <div className="section-header">
        <h2 className="section-title">
          <span className="section-icon">🔥</span>
          注目の新着
        </h2>
        <p className="section-subtitle">24時間以内に投稿された急上昇イベント</p>
      </div>
      <div className="trending-new-carousel">
        {spots.map((spot) => {
          const hoursAgo = Math.floor(
            (Date.now() - new Date(spot.createdAt).getTime()) / (60 * 60 * 1000)
          );
          const imageUrl = spot.imageUrl || spot.mediaUrls?.[0] || null;

          return (
            <div
              key={spot.id}
              className="trending-new-card"
              onClick={() => {
                onSpotView?.(spot);
                onSpotSelect?.(spot);
              }}
            >
              {/* Time badge */}
              <div className="new-time-badge">
                <span className="flame-icon">🔥</span>
                <span className="time-text">{hoursAgo}時間前</span>
              </div>

              {/* Image */}
              <div className="new-card-image-container">
                {imageUrl ? (
                  <img src={imageUrl} alt={spot.title} className="new-card-image" />
                ) : (
                  <div className="new-card-placeholder">
                    <span className="placeholder-icon">⚡</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="new-card-content">
                <h3 className="new-card-title">{spot.title}</h3>
                {spot.locationName && (
                  <p className="new-card-location">📍 {spot.locationName}</p>
                )}
                <div className="new-card-stats">
                  <span>👍 {spot.likes}</span>
                  <span>👀 {spot.viewCount ?? 0}</span>
                  <span>💬 {spot.commentsCount}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
