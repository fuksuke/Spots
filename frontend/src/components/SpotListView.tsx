import { useMemo, useState } from "react";

import type { Spot } from "../types";
import { mockSpots } from "../mockData";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";

const CATEGORY_ACCENT: Record<Spot["category"], string> = {
  live: "#ef4444",
  event: "#f59e0b",
  cafe: "#10b981",
  coupon: "#8b5cf6",
  sports: "#3b82f6"
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


const formatEventSchedule = (startTime: string, endTime?: string | null) => {
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) {
    return "日程未設定";
  }

  const end = endTime ? new Date(endTime) : null;
  const hasValidEnd = end && !Number.isNaN(end.getTime());

  const formatDate = (date: Date) =>
    date.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false });

  let label = `${formatDate(start)} ${formatTime(start)}`;

  if (hasValidEnd && end) {
    const sameDay = formatDate(start) === formatDate(end);
    label += sameDay ? `~${formatTime(end)}` : `~${formatDate(end)} ${formatTime(end)}`;
  }

  return label;
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
  const useMockTiles = import.meta.env.VITE_USE_MOCK_TILES === 'true';
  const baseData = spots.length > 0 ? spots : mockSpots;
  const listData = useMockTiles ? baseData : spots;
  const loadingState = useMockTiles ? false : isLoading;
  const errorState = useMockTiles ? null : error;
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
          const scheduleLabel = formatEventSchedule(spot.startTime, spot.endTime ?? null);
          const { likes, views } = formatPopularity(spot);
          const hostLabel = spot.ownerDisplayName?.trim() || spot.ownerId || "未設定";
          const locationLabel = formatLocation(spot);
          const priceLabel = formatPrice(spot);
          const description = spot.summary?.trim() || spot.description;
          const viewLabel = views.toLocaleString("ja-JP");
          const likesLabel = likes.toLocaleString("ja-JP");
          const tagCandidates: string[] = [];
          tagCandidates.push(`#${spot.category}`);
          if (spot.locationName) {
            const compactLocation = spot.locationName.replace(/\s+/g, "");
            if (compactLocation.length > 0) {
              tagCandidates.push(`#${compactLocation}`);
            }
          }
          if (spot.ownerDisplayName) {
            const compactHost = spot.ownerDisplayName.replace(/\s+/g, "");
            if (compactHost.length > 0 && tagCandidates.length < 3) {
              tagCandidates.push(`#${compactHost}`);
            }
          }

          return (
            <article
              key={spot.id}
              role="listitem"
              tabIndex={0}
              className="spot-list-card spot-mobile-card"
              onClick={() => onSpotSelect?.(spot)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onSpotSelect?.(spot);
                }
              }}
            >
              <header className="spot-mobile-card__title" aria-label="イベント名">
                <span className="spot-mobile-card__avatar" aria-hidden="true">
                  <Avatar name={spot.ownerDisplayName ?? spot.ownerId} photoUrl={spot.ownerPhotoUrl ?? null} size={32} />
                </span>
                <h3>{spot.title}</h3>
              </header>
              <section className="spot-mobile-card__meta" aria-label="イベント概要">
                <div className="spot-mobile-card__thumb" aria-hidden={image ? undefined : true}>
                  {image ? (
                    <img src={image} alt="" loading="lazy" />
                  ) : (
                    <span>{spot.category.toUpperCase()}</span>
                  )}
                </div>
                <ul className="spot-mobile-card__facts">
                  <li>
                    <span className="spot-mobile-card__fact-icon">
                      <Icon name="calendarSimple" size={18} />
                    </span>
                    <span>{scheduleLabel}</span>
                  </li>
                  <li>
                    <span className="spot-mobile-card__fact-icon">
                      <Icon name="mapLight" size={18} />
                    </span>
                    <span>{locationLabel}</span>
                  </li>
                  <li>
                    <span className="spot-mobile-card__fact-icon">
                      <Icon name="currencyJpyFill" size={18} />
                    </span>
                    <span>{priceLabel}</span>
                  </li>
                  <li>
                    <span className="spot-mobile-card__fact-icon">
                      <Icon name="userFill" size={18} />
                    </span>
                    <span>{hostLabel}</span>
                  </li>
                </ul>
              </section>
              <section className="spot-mobile-card__detail clamp-2" aria-label="イベント詳細">
                {description}
              </section>
              <footer className="spot-mobile-card__footer">
                <div className="spot-mobile-card__tags" aria-label="タグ">
                  {tagCandidates.map((tag) => (
                    <span key={tag} className="spot-mobile-card__tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="spot-mobile-card__metrics" aria-label="閲覧数といいね">
                  <span>
                    <Icon name="eyesFill" size={16} />
                    {viewLabel}
                  </span>
                  <span>
                    <Icon name="heart" size={16} />
                    {likesLabel}
                  </span>
                </div>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
};
