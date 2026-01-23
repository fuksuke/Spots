import { Spot } from "../../types";
import { usePopularSpots } from "../../hooks/usePopularSpots";
import { SpotListView } from "./SpotListView";
import { Promotion } from "../../hooks/usePromotions";

import { formatDate } from "../../lib/spotPresentation";

type PopularSpotsPanelProps = {
  spots: Spot[];
  promotions?: Promotion[];
  isLoading: boolean;
  error: unknown;
  onSpotSelect?: (spot: Spot) => void;
  onSpotView?: (spot: Spot) => void;
  onPromotionSelect?: (promotion: Promotion) => void;
};

export const PopularSpotsPanel = ({
  spots,
  promotions = [],
  isLoading,
  error,
  onSpotSelect,
  onSpotView,
  onPromotionSelect
}: PopularSpotsPanelProps) => {
  if (isLoading) {
    return <div className="panel">人気スポットを読み込み中...</div>;
  }

  if (error) {
    const message = error instanceof Error ? error.message : "人気スポットの取得に失敗しました。";
    return <div className="panel error">{message}</div>;
  }

  // Create interleaved list: spots with inline promotions
  // Insert promotions after position 3 and 8 (0-indexed: 2 and 7)
  const renderItems = () => {
    const items: JSX.Element[] = [];
    const insertPositions = [3, 8]; // After 3rd and 8th spot
    let promoIndex = 0;

    spots.forEach((spot, index) => {
      const rank = spot.popularityRank ?? index + 1;

      // Determine if spot is live now
      const now = Date.now();
      const startTime = new Date(spot.startTime).getTime();
      const endTime = new Date(spot.endTime).getTime();
      const isLive = now >= startTime && now <= endTime;

      // Medal icon for top 3
      const getMedalIcon = (rank: number) => {
        if (rank === 1) return "🥇";
        if (rank === 2) return "🥈";
        if (rank === 3) return "🥉";
        return null;
      };
      const medalIcon = getMedalIcon(rank);

      // Normalize score for progress bar (0-100)
      const maxScore = 200; // Approximate max popularity score
      const normalizedScore = Math.min(
        100,
        ((spot.popularityScore ?? 0) / maxScore) * 100
      );

      // Get image URL
      const imageUrl = spot.imageUrl || spot.mediaUrls?.[0] || null;

      // Add spot item with new visual design
      items.push(
        <li
          key={spot.id}
          className="popular-spot-card"
          onClick={() => {
            onSpotView?.(spot);
            onSpotSelect?.(spot);
          }}
        >
          {/* Rank badge - floating */}
          <div className="card-rank-badge">
            {medalIcon ? (
              <span className="rank-medal">{medalIcon}</span>
            ) : (
              <span className="rank-number">#{rank}</span>
            )}
          </div>

          {/* Image section */}
          <div className="card-image-container">
            {imageUrl ? (
              <img src={imageUrl} alt={spot.title} className="card-image" />
            ) : (
              <div className="card-image-placeholder">
                <span className="placeholder-icon">📍</span>
              </div>
            )}
            {isLive && (
              <div className="card-live-overlay">
                <span className="live-badge-compact">● LIVE</span>
              </div>
            )}
          </div>

          {/* Content section */}
          <div className="card-content">
            <h3 className="card-title">{spot.title}</h3>

            {spot.locationName && (
              <p className="card-location">📍 {spot.locationName}</p>
            )}

            <div className="card-stats">
              <span className="stat-item">
                <span className="stat-icon">👍</span>
                {spot.likes.toLocaleString()}
              </span>
              <span className="stat-item">
                <span className="stat-icon">👀</span>
                {(spot.viewCount ?? 0).toLocaleString()}
              </span>
              <span className="stat-item">
                <span className="stat-icon">💬</span>
                {spot.commentsCount.toLocaleString()}
              </span>
            </div>

            {typeof spot.popularityScore === "number" && spot.popularityScore > 0 && (
              <div className="card-score-bar">
                <div className="score-bar-track">
                  <div
                    className="score-bar-fill"
                    style={{ width: `${normalizedScore}%` }}
                  />
                </div>
                <span className="score-label">
                  人気スコア {Math.round(spot.popularityScore)}
                </span>
              </div>
            )}
          </div>
        </li>
      );

      // Insert promotion after this position if applicable
      if (insertPositions.includes(index + 1) && promoIndex < promotions.length) {
        const promo = promotions[promoIndex];
        items.push(
          <li key={`promo-${promo.id}`} className="popular-spot-item promotion-inline">
            <div className="promotion-badge">
              <span className="badge-icon">🏷️</span>
              <span className="badge-text">公式告知</span>
            </div>
            <div className="promotion-inline-content">
              {promo.imageUrl && (
                <img
                  src={promo.imageUrl}
                  alt={promo.headline ?? "イベント告知"}
                  className="promotion-inline-image"
                />
              )}
              <div className="promotion-inline-body">
                <h3 className="promotion-inline-headline">{promo.headline ?? "イベント情報"}</h3>
                <p className="promotion-inline-date">
                  公開: {formatDate(new Date(promo.publishAt))}
                </p>
                <div className="promotion-inline-actions">
                  {promo.ctaUrl && (
                    <a
                      className="button primary"
                      href={promo.ctaUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      詳細を見る
                    </a>
                  )}
                  {promo.spotId && (
                    <button
                      type="button"
                      className="button subtle"
                      onClick={() => onPromotionSelect?.(promo)}
                    >
                      地図でチェック
                    </button>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
        promoIndex++;
      }
    });

    return items;
  };

  return (
    <section className="trending-section">
      <div className="section-header">
        <h2 className="section-title">
          <span className="section-icon">🏆</span>
          人気ランキング
        </h2>
        <p className="section-subtitle">今、最も注目されているイベント</p>
      </div>
      <ul className="trending-grid">
        {spots.length > 0 ? renderItems() : (
          <li className="empty-state">
            <span className="empty-icon">📭</span>
            <p>まだランキング対象の投稿がありません</p>
          </li>
        )}
      </ul>
    </section>
  );
};
