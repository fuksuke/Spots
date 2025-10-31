import { useMemo, useState } from "react";

import type { Spot } from "../types";
import { mockSpots } from "../mockData";

const formatCountdown = (startTime: string) => {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  if (Number.isNaN(start)) return "開始時刻未設定";
  const diffMinutes = Math.round((start - now) / (60 * 1000));
  if (diffMinutes <= 0) return "まもなく開始";
  if (diffMinutes < 60) return `開始まで${diffMinutes}分`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `開始まで${days}日${hours % 24}時間`;
  }
  return `開始まで${hours}時間${minutes}分`;
};

const formatLocation = (spot: Spot) => {
  if (spot.locationName && spot.locationName.trim()) {
    return spot.locationName;
  }
  return `緯度 ${spot.lat.toFixed(3)}, 経度 ${spot.lng.toFixed(3)}`;
};

const formatPrice = (spot: Spot) => {
  const pricing = spot.pricing;
  if (!pricing) return "無料";
  if (pricing.isFree) return pricing.label ?? "無料";
  if (typeof pricing.amount === "number") {
    const currency = pricing.currency ?? "¥";
    return `${currency}${pricing.amount.toLocaleString()}`;
  }
  return pricing.label ?? "有料";
};

const formatPopularity = (spot: Spot) => {
  const likes = spot.likes ?? 0;
  const views = spot.viewCount ?? 0;
  return {
    likes,
    views
  };
};

type SortKey = "startTime" | "popularity" | "price" | "newest";

type SpotListViewProps = {
  spots: Spot[];
  isLoading: boolean;
  error: unknown;
  onSpotSelect?: (spot: Spot) => void;
};

export const SpotListView = ({ spots, isLoading, error, onSpotSelect }: SpotListViewProps) => {
  const useMock = import.meta.env.VITE_USE_MOCK_TILES === 'true';
  const listData = useMock ? mockSpots : spots;
  const loadingState = useMock ? false : isLoading;
  const errorState = useMock ? null : error;
  const [sortKey, setSortKey] = useState<SortKey>("startTime");
  const sortedSpots = useMemo(() => {
    const list = [...listData];
    switch (sortKey) {
      case "startTime":
        return list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      case "popularity":
        return list.sort((a, b) => {
          const left = (a.viewCount ?? 0) + (a.likes ?? 0);
          const right = (b.viewCount ?? 0) + (b.likes ?? 0);
          return right - left;
        });
      case "price":
        return list.sort((a, b) => {
          const left = a.pricing?.amount ?? (a.pricing?.isFree ? 0 : Number.POSITIVE_INFINITY);
          const right = b.pricing?.amount ?? (b.pricing?.isFree ? 0 : Number.POSITIVE_INFINITY);
          return (left ?? 0) - (right ?? 0);
        });
      case "newest":
        return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      default:
        return list;
    }
  }, [listData, sortKey]);

  if (loadingState) {
    return <div className="list-placeholder">イベントを読み込み中...</div>;
  }

  if (errorState) {
    return <div className="list-placeholder error">イベントを読み込めませんでした。</div>;
  }

  if (sortedSpots.length === 0) {
    return <div className="list-placeholder">該当するイベントが見つかりません。</div>;
  }

  return (
    <div className="spot-list-view">
      <div className="spot-list-toolbar" role="toolbar" aria-label="並び替え">
        <label className="spot-sort-control">
          <span>並び替え</span>
          <div className="sort-select">
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
              <option value="startTime">開始時間</option>
              <option value="popularity">人気順</option>
              <option value="price">価格順</option>
              <option value="newest">新着順</option>
            </select>
          </div>
        </label>
      </div>

      <div className="spot-list" role="list" aria-label="イベントリスト">
        {sortedSpots.map((spot) => {
          const image = spot.imageUrl;
          const nowLabel = formatCountdown(spot.startTime);
          const { likes, views } = formatPopularity(spot);
          return (
            <article
              key={spot.id}
              role="listitem"
              tabIndex={0}
              className="spot-list-card"
              onClick={() => onSpotSelect?.(spot)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onSpotSelect?.(spot);
                }
              }}
            >
              <div className="spot-card-media" aria-hidden={Boolean(image)}>
                {image ? (
                  <img src={image} alt="" loading="lazy" />
                ) : (
                  <div className={`spot-card-placeholder ${spot.category}`.trim()}>{spot.category.toUpperCase()}</div>
                )}
              </div>
              <div className="spot-card-body">
                <header className="spot-card-header">
                  <h3 className="spot-card-title">{spot.title}</h3>
                  <div className="spot-card-tags">
                    <span className="spot-tag">#{spot.category}</span>
                    {spot.ownerPhoneVerified ? <span className="spot-tag verified">Verified</span> : null}
                  </div>
                </header>
                <p className="spot-card-description">{spot.description}</p>
                <dl className="spot-card-meta">
                  <div>
                    <dt>開始まで</dt>
                    <dd>{nowLabel}</dd>
                  </div>
                  <div>
                    <dt>場所</dt>
                    <dd>{formatLocation(spot)}</dd>
                  </div>
                  <div>
                    <dt>料金</dt>
                    <dd>{formatPrice(spot)}</dd>
                  </div>
                </dl>
                <div className="spot-card-stats" aria-label="人気指標">
                  <span>👍 {likes}</span>
                  <span>👀 {views}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
