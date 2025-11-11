import { useMemo, useState } from "react";

import type { Spot } from "../types";
import { mockSpots } from "../mockData";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";

// Format the location. If a custom locationName exists it is used, otherwise
// the latitude/longitude are formatted.
const formatLocation = (spot: Spot) => {
  if (spot.locationName && spot.locationName.trim()) {
    return spot.locationName;
  }
  return `緯度 ${spot.lat.toFixed(3)}, 経度 ${spot.lng.toFixed(3)}`;
};

// Format a price string based on pricing information.
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

// Create a human friendly date/time range label for an event.
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

// Extract likes and views from a spot. If undefined, treat as zero.
const formatPopularity = (spot: Spot) => {
  const likes = spot.likes ?? 0;
  const views = spot.viewCount ?? 0;
  return {
    likes,
    views
  };
};

// Determine a primary image for a spot. Prefer the first item in mediaUrls,
// then media array, falling back to imageUrl. Returns null if no image is found.
const getPrimaryImage = (spot: Spot): string | null => {
  const anySpot = spot as any;
  if (Array.isArray(anySpot.mediaUrls) && anySpot.mediaUrls.length > 0) {
    return anySpot.mediaUrls[0] as string;
  }
  if (Array.isArray(anySpot.media) && anySpot.media.length > 0) {
    const first = anySpot.media[0];
    if (typeof first === 'string') return first;
    if (first && typeof first.url === 'string') return first.url;
  }
  return spot.imageUrl ?? null;
};

// Extract all available image URLs for a spot. This helper returns an array
// containing every media URL associated with the spot in the order of
// preference: mediaUrls array, media array (string or object with a url
// property), and falls back to imageUrl if no other media is present.
const getAllImages = (spot: Spot): string[] => {
  const anySpot = spot as any;
  const result: string[] = [];
  if (Array.isArray(anySpot.mediaUrls) && anySpot.mediaUrls.length > 0) {
    for (const url of anySpot.mediaUrls) {
      if (typeof url === 'string') result.push(url);
    }
  }
  if (Array.isArray(anySpot.media) && anySpot.media.length > 0) {
    for (const item of anySpot.media) {
      if (typeof item === 'string') {
        result.push(item);
      } else if (item && typeof item.url === 'string') {
        result.push(item.url);
      }
    }
  }
  if (result.length === 0 && spot.imageUrl) {
    result.push(spot.imageUrl);
  }
  return result;
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
            const scheduleLabel = formatEventSchedule(spot.startTime, spot.endTime ?? null);
            const { likes, views } = formatPopularity(spot);
            const hostLabel = spot.ownerDisplayName?.trim() || spot.ownerId || "未設定";
            const locationLabel = formatLocation(spot);
            const priceLabel = formatPrice(spot);
            const viewLabel = views.toLocaleString("ja-JP");
            // Determine like state and display likes accordingly.
            const isLiked = likedMap[spot.id] ?? false;
            const displayLikesNumber = likes + (isLiked ? 1 : 0);
            const likesLabel = displayLikesNumber.toLocaleString("ja-JP");

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
                  // Build a catch copy: use speechBubble if present, otherwise the first sentence of description.
                  const catchCopy = (() => {
                    if (spot.speechBubble && spot.speechBubble.trim()) return spot.speechBubble.trim();
                    if (spot.description) {
                      const firstSentence = spot.description.split(/[。.!！\?？]/)[0];
                      return firstSentence.trim();
                    }
                    return spot.title;
                  })();
                  // Prepare full and truncated descriptions.
                  const fullDesc = spot.description ?? '';
                  const truncatedDesc = fullDesc.length > 55 ? fullDesc.slice(0, 55) + '…' : fullDesc;
                  // Prepare map search queries.
                  const query = encodeURIComponent(`${spot.title} ${spot.locationName ?? ''}`);
                    // Compose URLs for external map apps.
                  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
                  const appleMapsUrl = `https://maps.apple.com/?q=${query}`;
                  // Note: page indicators are generated dynamically based on the number of images;
                  // Split title into main and subtitle using parentheses. E.g., "ABC (日本語)".
                  const parseTitle = (title: string): [string, string] => {
                    const match = title.match(/(.+?)\s*\((.+)\)/);
                    if (match) {
                      return [match[1].trim(), match[2].trim()];
                    }
                    return [title, ''];
                  };
                  const [mainTitle, subTitle] = parseTitle(spot.title);
                  // Determine all images for this spot
                  const images = getAllImages(spot);
                  const idx = imageIndexMap[spot.id] ?? 0;
                  const validIdx = Math.min(Math.max(idx, 0), images.length - 1);
                  const src = images[validIdx] ?? null;
                  // Determine updated like state and counts using local likedMap
                  const isLikedLocal = likedMap[spot.id] ?? false;
                  const displayLikesNumberLocal = likes + (isLikedLocal ? 1 : 0);
                  const likesLabelUpdated = displayLikesNumberLocal.toLocaleString("ja-JP");
                  // Build contact entry and detail items
                  const contactEntry = (() => {
                    const anyContact = (spot as any).contact;
                    if (!anyContact) return null;
                    const { phone, email, sns } = anyContact;
                    if (phone) {
                      return { value: phone as string, href: `tel:${(phone as string).replace(/\s+/g, "")}` };
                    }
                    if (email) {
                      return { value: email as string, href: `mailto:${email as string}` };
                    }
                    if (sns) {
                      const first = Object.entries(sns).find(([, url]) => Boolean(url));
                      if (first) {
                        const [keyStr, url] = first;
                        if (url) {
                          return { value: `${keyStr.toUpperCase()}: ${url}`, href: url as string };
                        }
                      }
                    }
                    return null;
                  })();
                  const detailItems: Array<{ type: "contact" | "location" | "price"; content: any; key: string; href?: string }> = [];
                  if (contactEntry) {
                    detailItems.push({ type: "contact", content: contactEntry.value, key: "contact", href: contactEntry.href });
                  }
                  if (spot.locationDetails) {
                    detailItems.push({ type: "location", content: spot.locationDetails, key: "location" });
                  } else if (locationLabel) {
                    detailItems.push({ type: "location", content: locationLabel, key: "location" });
                  }
                  const pricing = (spot as any).pricing;
                  if (pricing && pricing.label) {
                    detailItems.push({ type: "price", content: pricing.label, key: "price" });
                  }

                  return (
                    <>
                      {/* Modern card layout inspired by SpotDetailSheet */}
                      {/* Card header displaying the owner information */}
                      <div className="modern-card-header">
                        <Avatar name={spot.ownerDisplayName ?? spot.ownerId} photoUrl={spot.ownerPhotoUrl ?? null} size={36} />
                        <span className="owner-name">{spot.ownerDisplayName ?? spot.ownerId}</span>
                      </div>
                      {/* Hero section with image, page indicators and social overlay */}
                      <div className="modern-hero">
                        <div
                          className="modern-hero-image"
                          onTouchStart={handleTouchStart}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={() => handleTouchEnd(spot.id, images)}
                        >
                          {src ? (
                            <img src={src} alt="" />
                          ) : (
                            <span style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', fontWeight: 700, color: '#ffffff', background: '#818cf8' }}>
                              {spot.category.toUpperCase()}
                            </span>
                          )}
                          {/* Page indicators overlayed at bottom center of the hero image */}
                          <div className="modern-hero-indicators">
                            {(() => {
                              const images = getAllImages(spot);
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
                          {/* Social overlay button */}
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
                        </div>
                      </div>
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
                              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="modern-google">
                                Google Mapで経路を検索
                              </a>
                              <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer" className="modern-apple">
                                Apple Mapで経路を検索
                              </a>
                            </div>
                            {detailItems.length > 0 && (
                              <>
                                <div className="modern-section-title">詳細</div>
                                <div className="modern-detail-list">
                                  {detailItems.map((item) => (
                                    <div className="modern-detail-item" key={item.key}>
                                      <div className="detail-icon">
                                        {item.type === 'location' && <Icon name="mapLight" size={20} />}
                                        {item.type === 'contact' && <Icon name="userFill" size={20} />}
                                        {item.type === 'price' && <Icon name="currencyJpyFill" size={20} />}
                                      </div>
                                      {item.href ? (
                                        <a href={item.href} className="detail-content" onClick={(e) => e.stopPropagation()}>
                                          {item.content}
                                        </a>
                                      ) : (
                                        <div className="detail-content">{item.content}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                            <div className="modern-section-title">URLs</div>
                            <div className="modern-social-icons">
                              <button type="button" aria-label="Instagram" onClick={(e) => e.stopPropagation()}>
                                <Icon name="camera" size={24} />
                              </button>
                              <button type="button" aria-label="X" onClick={(e) => e.stopPropagation()}>
                                <Icon name="camera" size={24} />
                              </button>
                              <button type="button" aria-label="YouTube" onClick={(e) => e.stopPropagation()}>
                                <Icon name="camera" size={24} />
                              </button>
                              <button type="button" aria-label="Web" onClick={(e) => e.stopPropagation()}>
                                <Icon name="camera" size={24} />
                              </button>
                            </div>
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