import "../../styles/components/SpotListView.css";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Spot } from "../../types";
import { mockSpots } from "../../mockData";
import { Icon } from "../../components/ui/Icon";
import { Avatar } from "../../components/ui/Avatar";
import { ModernHero, ModernHeroPlaceholder } from "../../components/ui/ModernHero";
import { ModernDetailList } from "../../components/ui/ModernDetailList";
import {
  buildExternalLinks,
  buildMapSearchUrls,
  buildSpotCatchCopy,
  buildSpotDetailItems,
  collectSpotImages,
  formatSpotSchedule,
  splitSpotTitle
} from "../../lib/spotPresentation";
import { trackEvent } from "../../lib/analytics";
import { useScrollParent } from "../../hooks/useScrollParent";

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
  onSpotView?: (spot: Spot) => void;
};

export const SpotListView = ({ spots, isLoading, error, onSpotSelect, onSpotView }: SpotListViewProps) => {
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
  const listRef = useRef<HTMLDivElement | null>(null);
  const maxScrollDepthRef = useRef(0);
  const scrollParent = useScrollParent(listRef);

  useEffect(() => {
    if (!scrollParent) return;

    const handleScroll = () => {
      let scrollTop = 0;
      let scrollHeight = 0;
      let clientHeight = 0;

      if (scrollParent instanceof Window) {
        scrollTop = window.scrollY;
        scrollHeight = document.documentElement.scrollHeight;
        clientHeight = window.innerHeight;
      } else {
        const el = scrollParent as HTMLElement;
        scrollTop = el.scrollTop;
        scrollHeight = el.scrollHeight;
        clientHeight = el.clientHeight;
      }

      if (scrollHeight <= clientHeight) {
        maxScrollDepthRef.current = 1;
        return;
      }
      const depth = Math.min(1, scrollTop / (scrollHeight - clientHeight));
      maxScrollDepthRef.current = Math.max(maxScrollDepthRef.current, depth);
    };

    scrollParent.addEventListener("scroll", handleScroll);
    return () => {
      scrollParent.removeEventListener("scroll", handleScroll);
      trackEvent("list_scroll_depth", { percent: maxScrollDepthRef.current });
    };
  }, [scrollParent]);

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
      <div className="spot-list-view" ref={listRef}>
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
            const isExpanded = expandedSpotId === spot.id;
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
                  onSpotView?.(spot);
                  onSpotSelect?.(spot);
                  setExpandedSpotId((prev) => (prev === spot.id ? null : spot.id));
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onSpotView?.(spot);
                    onSpotSelect?.(spot);
                    setExpandedSpotId((prev) => (prev === spot.id ? null : spot.id));
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                  }
                }}
              >
                {(() => {
                  const catchCopy = buildSpotCatchCopy(spot);
                  // Prepare full and truncated descriptions.
                  const fullDesc = spot.description ?? '';
                  const truncatedDesc = fullDesc.length > 38 ? fullDesc.slice(0, 38) + '…' : fullDesc;
                  const mapUrls = buildMapSearchUrls(spot);
                  const { mainTitle, subTitle } = splitSpotTitle(spot.title);
                  const images = collectSpotImages(spot);
                  // Always use first image if available
                  const src = images.length > 0 ? images[0] : null;

                  // Determine updated like state and counts using local likedMap
                  const isLikedLocal = likedMap[spot.id] ?? false;
                  const displayLikesNumberLocal = likes + (isLikedLocal ? 1 : 0);
                  const likesLabelUpdated = displayLikesNumberLocal.toLocaleString("ja-JP");
                  // Build contact entry and detail items
                  const detailItems = buildSpotDetailItems(spot);
                  const externalLinks = buildExternalLinks(spot);

                  // 1. Remove multiple image support (carousel). 
                  // 2. Remove modern-card-header area, overlay on image.
                  // 4. Social links: Instagram or X icon or hidden.
                  let socialIconNode: React.ReactNode = null;
                  const sns = spot.contact?.sns;
                  const instagramLink = sns?.instagram || externalLinks.find(l => l.url.includes("instagram.com"))?.url;
                  const xLink = sns?.x || sns?.twitter || externalLinks.find(l => l.url.includes("twitter.com") || l.url.includes("x.com"))?.url;

                  if (instagramLink) {
                    socialIconNode = (
                      <a
                        href={instagramLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="modern-hero-social instagram"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Instagram"
                      >
                        <img src="/logos/instagram-logo.png" alt="Instagram" />
                      </a>
                    );
                  } else if (xLink) {
                    socialIconNode = (
                      <a
                        href={xLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="modern-hero-social x"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="X (Twitter)"
                      >
                        <img src="/logos/x-logo.svg" alt="X" />
                      </a>
                    );
                  }

                  return (
                    <>
                      {/* Hero section with image overlay header and social icon */}
                      <ModernHero
                        header={
                          <div className="modern-hero-header-overlay">
                            <Avatar name={spot.ownerDisplayName ?? spot.ownerId} photoUrl={spot.ownerPhotoUrl ?? null} size={32} />
                            <span className="owner-name-overlay">{spot.ownerDisplayName ?? spot.ownerId}</span>
                          </div>
                        }
                        media={
                          src ? (
                            <img src={src} alt="" />
                          ) : (
                            <ModernHeroPlaceholder label={(spot.category ?? 'EVENT').toUpperCase()} />
                          )
                        }
                        // No indicators as carousel is removed
                        socialButton={socialIconNode}
                      />
                      {/* Content area containing title, stats, schedule, catch copy, and description */}
                      <div className="modern-content">
                        <div className="modern-header-row">
                          <div className="modern-header-main">
                            <h3 className="modern-title">{mainTitle}</h3>
                            <div className="modern-schedule">{scheduleLabel}</div>
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
                              <Icon name={isLikedLocal ? "heartFill" : "heart"} size={18} />
                              {likesLabelUpdated}
                            </div>
                          </div>
                        </div>
                        {subTitle && <p className="modern-subtitle">{subTitle}</p>}
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
                                  {externalLinks.map((link) => {
                                    let brandClass = "web";
                                    const urlLower = link.url.toLowerCase();
                                    let logoSrc: string | null = null;

                                    if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) {
                                      brandClass = "x";
                                      logoSrc = "/logos/x-logo.svg";
                                    } else if (urlLower.includes("instagram.com")) {
                                      brandClass = "instagram";
                                      logoSrc = "/logos/instagram-logo.png";
                                    } else if (urlLower.includes("youtube.com")) {
                                      brandClass = "youtube";
                                      logoSrc = "/logos/youtube-logo.png";
                                    } else if (urlLower.includes("facebook.com")) {
                                      brandClass = "facebook";
                                      logoSrc = "/logos/facebook-logo.png";
                                    }

                                    return (
                                      <a
                                        key={`${link.label}-${link.url}`}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`modern-social-icon-link ${brandClass}`}
                                        onClick={(event) => event.stopPropagation()}
                                        aria-label={link.label}
                                      >
                                        {logoSrc ? (
                                          <img src={logoSrc} alt={link.label} />
                                        ) : (
                                          <Icon name="globe" size={28} />
                                        )}
                                      </a>
                                    );
                                  })}
                                </div>

                              </>
                            )}
                            {spot?.hashtags && spot.hashtags.trim() && (
                              <>
                                <div className="modern-section-title">ハッシュタグ</div>
                                <div className="hashtags-container">
                                  {spot.hashtags.split(/\s+/).filter(Boolean).map((tag, index) => (
                                    <span key={`${tag}-${index}`} className="hashtag-badge">
                                      {tag.startsWith('#') ? tag : `#${tag}`}
                                    </span>
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
                      </div >
                    </>
                  );
                })()}
              </article>
            );
          })}
        </div >
      </div >
    </>
  );
};
