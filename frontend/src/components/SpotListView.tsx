import { useMemo, useState } from "react";

import type { Spot } from "../types";
import { mockSpotList } from "../mockData";

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
  return `👍 ${likes} / 👀 ${views}`;
};

type SortKey = "startTime" | "popularity" | "price" | "newest";
type IndoorFilter = "all" | "indoor" | "outdoor";

type SpotListViewProps = {
  spots: Spot[];
  isLoading: boolean;
  error: unknown;
  onSpotSelect?: (spot: Spot) => void;
};

export const SpotListView = ({ spots, isLoading, error, onSpotSelect }: SpotListViewProps) => {
  const useMock = import.meta.env.VITE_USE_MOCK_TILES === 'true';
  const listData = useMock ? (mockSpotList as Spot[]) : spots;
  const loadingState = useMock ? false : isLoading;
  const errorState = useMock ? null : error;
  const [sortKey, setSortKey] = useState<SortKey>("startTime");
  const [freeOnly, setFreeOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [happeningToday, setHappeningToday] = useState(false);
  const [indoorFilter, setIndoorFilter] = useState<IndoorFilter>("all");

  const filteredSpots = useMemo(() => {
    const now = new Date();
        return listData.filter((spot) => {
      if (freeOnly && !(spot.pricing?.isFree ?? true)) return false;
      if (verifiedOnly && !(spot.ownerPhoneVerified ?? false)) return false;
      if (happeningToday) {
        const start = new Date(spot.startTime);
        if (Number.isNaN(start.getTime())) return false;
        if (start.toDateString() !== now.toDateString()) return false;
      }
      if (indoorFilter !== "all") {
        const isIndoor = spot.isIndoor;
        if (isIndoor === undefined || isIndoor === null) return false;
        if (indoorFilter === "indoor" && !isIndoor) return false;
        if (indoorFilter === "outdoor" && isIndoor) return false;
      }
      return true;
    });
  }, [listData, freeOnly, verifiedOnly, happeningToday, indoorFilter]);

  const sortedSpots = useMemo(() => {
    const list = [...filteredSpots];
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
  }, [filteredSpots, sortKey]);

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
      <div className="spot-list-toolbar" role="toolbar" aria-label="リスト操作">
        <div className="spot-sort-control">
          <label>
            並び替え
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
              <option value="startTime">開始時間</option>
              <option value="popularity">人気順</option>
              <option value="price">価格順</option>
              <option value="newest">新着順</option>
            </select>
          </label>
        </div>
        <div className="spot-filter-group">
          <button
            type="button"
            className={`filter-chip ${freeOnly ? "active" : ""}`.trim()}
            onClick={() => setFreeOnly((prev) => !prev)}
          >
            無料のみ
          </button>
          <button
            type="button"
            className={`filter-chip ${verifiedOnly ? "active" : ""}`.trim()}
            onClick={() => setVerifiedOnly((prev) => !prev)}
          >
            Verifiedのみ
          </button>
          <button
            type="button"
            className={`filter-chip ${happeningToday ? "active" : ""}`.trim()}
            onClick={() => setHappeningToday((prev) => !prev)}
          >
            今日開催
          </button>
          <div className="filter-select">
            <label>
              室内/屋外
              <select value={indoorFilter} onChange={(event) => setIndoorFilter(event.target.value as IndoorFilter)}>
                <option value="all">すべて</option>
                <option value="indoor">室内</option>
                <option value="outdoor">屋外</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="spot-list" aria-label="イベントリスト">
        {sortedSpots.map((spot) => {
          const image = spot.imageUrl;
          const nowLabel = formatCountdown(spot.startTime);
          return (
            <article key={spot.id} className="spot-list-card" onClick={() => onSpotSelect?.(spot)}>
              <div className="spot-card-media">
                {image ? (
                  <img src={image} alt={spot.title} loading="lazy" />
                ) : (
                  <div className={`spot-card-placeholder ${spot.category}`.trim()} aria-hidden="true">
                    {spot.category.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="spot-card-body">
                <header className="spot-card-header">
                  <h3>{spot.title}</h3>
                  <div className="spot-card-badges">
                    <span className="spot-badge category">#{spot.category}</span>
                    {spot.ownerPhoneVerified ? <span className="spot-badge verified">Verified</span> : null}
                  </div>
                </header>
                <p className="spot-card-description">{spot.description}</p>
                <div className="spot-card-meta">
                  <span className="spot-meta time">{nowLabel}</span>
                  <span className="spot-meta location">{formatLocation(spot)}</span>
                  <span className="spot-meta price">{formatPrice(spot)}</span>
                </div>
                <div className="spot-card-stats">{formatPopularity(spot)}</div>
                <div className="spot-card-actions">
                  <button type="button" className="button subtle">
                    詳細を見る
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
