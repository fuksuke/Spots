import { useMemo, useState } from "react";

import type { Spot } from "../types";
import { mockSpots } from "../mockData";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { ModernHero, ModernHeroPlaceholder } from "./ModernHero";
import { ModernDetailList } from "./ModernDetailList";
import {
  buildExternalLinks,
  buildMapSearchUrls,
  buildSpotCatchCopy,
  buildSpotDetailItems,
  collectSpotImages,
  formatSpotSchedule,
  splitSpotTitle
} from "../lib/spotPresentation";

// Extract likes and views from a spot. If undefined, treat as zero.
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
  // Optionally substitute mock data if configured via environment variable.
  const useMockTiles = import.meta.env.VITE_USE_MOCK_TILES === 'true';
  const baseData = spots.length > 0 ? spots : mockSpots;
  const listData = useMockTiles ? baseData : spots;
  const loadingState = useMockTiles ? false : isLoading;
  const errorState = useMockTiles ? null : error;

  const [sortKey, setSortKey] = useState<SortKey>("startTime");
  const [expandedSpotId, setExpandedSpotId] = useState<string | null>(null);
  // Map of liked state per spot id. This is only stored locally on the client.
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});

  // Track which image index is currently shown for each spot. When a card
  // contains multiple images, clicking on the page indicators will update
  // this map to display the corresponding image.
  const [imageIndexMap, setImageIndexMap] = useState<Record<string, number>>({});
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isSwiping) {
      setTouchEnd(e.targetTouches[0].clientX);
    }
  };

  const handleTouchEnd = (spotId: string, images: string[]) => {
    if (isSwiping) {
      const swipeDistance = touchStart - touchEnd;
      if (Math.abs(swipeDistance) > 50) {
        const newIndex = (imageIndexMap[spotId] || 0) + (swipeDistance > 0 ? 1 : -1);
        if (newIndex >= 0 && newIndex < images.length) {
          setImageIndexMap((prev) => ({ ...prev, [spotId]: newIndex }));
        }
      }
      setIsSwiping(false);
    }
  };

  // Sort the list according to the selected key.
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
    <>
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
            // Compute labels and derived values up front for clarity.
            const scheduleLabel = formatSpotSchedule(spot.startTime, spot.endTime ?? null);
            const { likes, views } = formatPopularity(spot);
            const viewLabel = views.toLocaleString("ja-JP");
            // Determine like state and display likes accordingly.

            return (
              <article
                key={spot.id}
                role="listitem"
                tabIndex={0}
                className="spot-list-card spot-mobile-card new-card"
                onClick={() => {
                  onSpotSelect?.(spot);
                  setExpandedSpotId((prev) => (prev === spot.id ? null : spot.id));
                  // Remove focus to avoid scroll jumps on expansion.
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onSpotSelect?.(spot);
                    setExpandedSpotId((prev) => (prev === spot.id ? null : spot.id));
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                  }
                }}
              >
                {(() => {
                  const isExpanded = expandedSpotId === spot.id;
                  const catchCopy = buildSpotCatchCopy(spot);
                  // Prepare full and truncated descriptions.
                  const fullDesc = spot.description ?? '';
                  const truncatedDesc = fullDesc.length > 38 ? fullDesc.slice(0, 38) + '…' : fullDesc;
                  const mapUrls = buildMapSearchUrls(spot);
                  const { mainTitle, subTitle } = splitSpotTitle(spot.title);
                  const images = collectSpotImages(spot);
                  const idx = imageIndexMap[spot.id] ?? 0;
                  const imageCount = images.length > 0 ? images.length : 1;
                  const validIdx = Math.min(Math.max(idx, 0), imageCount - 1);
                  const src = images[validIdx] ?? null;
                  // Determine updated like state and counts using local likedMap
                  const isLikedLocal = likedMap[spot.id] ?? false;
                  const displayLikesNumberLocal = likes + (isLikedLocal ? 1 : 0);
                  const likesLabelUpdated = displayLikesNumberLocal.toLocaleString("ja-JP");
                  // Build contact entry and detail items
                  const detailItems = buildSpotDetailItems(spot);
                  const externalLinks = buildExternalLinks(spot);

                  return (
                    <>
                      {/* Modern card layout inspired by SpotDetailSheet */}
                      {/* Card header displaying the owner information */}
                      <div className="modern-card-header">
                        <Avatar name={spot.ownerDisplayName ?? spot.ownerId} photoUrl={spot.ownerPhotoUrl ?? null} size={36} />
                        <span className="owner-name">{spot.ownerDisplayName ?? spot.ownerId}</span>
                      </div>
                      {/* Hero section with image, page indicators and social overlay */}
                      <ModernHero
                        media={
                          src ? (
                            <img src={src} alt="" />
                          ) : (
                            <ModernHeroPlaceholder label={(spot.category ?? 'EVENT').toUpperCase()} />
                          )
                        }
                        indicators={
                          <div className="modern-hero-indicators">
                            {(() => {
                              const count = images.length > 0 ? images.length : 1;
                              return Array.from({ length: count }, (_, idx) => (
                                <span
                                  key={idx}
                                  className={(imageIndexMap[spot.id] ?? 0) === idx ? 'active' : ''}
                                  onClick={(evt) => {
                                    evt.stopPropagation();
                                    setImageIndexMap((prev) => ({ ...prev, [spot.id]: idx }));
                                  }}
                                ></span>
                              ));
                            })()}
                          </div>
                        }
                        socialButton={
                          <button
                            type="button"
                            className="modern-hero-social"
                            aria-label="Instagram"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Icon name="camera" size={22} />
                          </button>
                        }
                        imageProps={{
                          onTouchStart: handleTouchStart,
                          onTouchMove: handleTouchMove,
                          onTouchEnd: () => handleTouchEnd(spot.id, images)
                        }}
                      />
                      {/* Content area containing title, stats, schedule, catch copy, and description */}
                      <div className="modern-content">
                        <div className="modern-title-row">
                          <div className="modern-titles">
                            <h3 className="modern-title">{mainTitle}</h3>
                            {subTitle && <p className="modern-subtitle">{subTitle}</p>}
                          </div>
                          <div className="modern-stats">
                            <div className="metric view">
                              <Icon name="eyesFill" size={18} />
                              {viewLabel}
                            </div>
                            <div
                              className={"metric like" + (isLikedLocal ? ' liked' : '')}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setLikedMap((prev) => ({ ...prev, [spot.id]: !isLikedLocal }));
                              }}
                            >
                              <Icon name="heart" size={18} />
                              {likesLabelUpdated}
                            </div>
                          </div>
                        </div>
                        <div className="modern-schedule">{scheduleLabel}</div>
                        {catchCopy && <div className="modern-catchcopy">{catchCopy}</div>}
                        {fullDesc && (
                          <>
                            <p className="modern-description">{isExpanded ? fullDesc : truncatedDesc}</p>
                            {!isExpanded && (
                              <div className="modern-more-link-wrapper">
                                <span className="modern-more-link">…もっと見る</span>
                              </div>
                            )}
                          </>
                        )}
                        {isExpanded && (
                          <>
                            <div className="modern-map-buttons">
                              <a href={mapUrls.google} target="_blank" rel="noopener noreferrer" className="modern-google">
                                Google Mapで経路を検索
                              </a>
                              <a href={mapUrls.apple} target="_blank" rel="noopener noreferrer" className="modern-apple">
                                Apple Mapで経路を検索
                              </a>
                            </div>
                            {detailItems.length > 0 && (
                              <>
                                <div className="modern-section-title">詳細</div>
                                <ModernDetailList
                                  items={detailItems}
                                  onLinkClick={(event) => {
                                    event.stopPropagation();
                                  }}
                                />
                              </>
                            )}
                            {externalLinks.length > 0 && (
                              <>
                                <div className="modern-section-title">関連リンク</div>
                                <div className="modern-social-icons">
                                  {externalLinks.map((link) => (
                                    <a
                                      key={`${link.label}-${link.url}`}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {link.label}
                                    </a>
                                  ))}
                                </div>
                              </>
                            )}
                            <div className="modern-bottom-actions">
                              <button type="button" onClick={(e) => e.stopPropagation()}>
                                共有
                              </button>
                              <button type="button" onClick={(e) => e.stopPropagation()}>
                                通報
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
};
