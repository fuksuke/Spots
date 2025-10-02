import { FormEvent, useMemo } from "react";
import { Spot } from "../types";

const popularQueries = ["ライブ", "フードトラック", "DJセット", "朝活", "限定グッズ"];
const recommendedSpotsMock: Array<Pick<Spot, "id" | "title" | "category" | "imageUrl" | "likes" | "commentsCount">> = [
  {
    id: "rec-1",
    title: "渋谷スクランブルDJナイト",
    category: "event",
    imageUrl: null,
    likes: 128,
    commentsCount: 24
  },
  {
    id: "rec-2",
    title: "ミッドナイトコーヒースタンド",
    category: "cafe",
    imageUrl: null,
    likes: 87,
    commentsCount: 12
  },
  {
    id: "rec-3",
    title: "スポーツバー パブリックビューイング",
    category: "sports",
    imageUrl: null,
    likes: 64,
    commentsCount: 9
  }
];

export type SearchOverlayProps = {
  isOpen: boolean;
  query: string;
  history: string[];
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onSelectQuery: (value: string) => void;
  onClose: () => void;
};

export const SearchOverlay = ({ isOpen, query, history, onChange, onSubmit, onSelectQuery, onClose }: SearchOverlayProps) => {
  const trimmedQuery = query.trim();
  const hasHistory = history.length > 0;

  const recommendationList = useMemo(() => recommendedSpotsMock, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(trimmedQuery);
  };

  return (
    <div className={`search-overlay ${isOpen ? "open" : ""}`.trim()} role="dialog" aria-hidden={!isOpen}>
      <div className="search-scrim" onClick={onClose} aria-hidden="true" />
      <div className="search-sheet">
        <header className="search-header">
          <form className="search-bar" onSubmit={handleSubmit} role="search">
            <span className="search-icon">🔍</span>
            <input
              autoFocus={isOpen}
              value={query}
              onChange={(event) => onChange(event.target.value)}
              placeholder="スポットやイベントを検索"
              aria-label="スポットを検索"
            />
            {trimmedQuery && (
              <button type="button" className="clear-button" onClick={() => onChange("")}>
                クリア
              </button>
            )}
            <button type="submit" className="submit-button">
              検索
            </button>
          </form>
          <button type="button" className="close-button" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </header>

        <section className="search-section">
          <h3>人気キーワード</h3>
          <div className="search-chip-list">
            {popularQueries.map((item) => (
              <button key={item} type="button" className="search-chip" onClick={() => onSelectQuery(item)}>
                #{item}
              </button>
            ))}
          </div>
        </section>

        {hasHistory ? (
          <section className="search-section">
            <h3>最近の検索</h3>
            <div className="history-list">
              {history.slice(0, 5).map((item) => (
                <button key={item} type="button" className="history-item" onClick={() => onSelectQuery(item)}>
                  <span className="history-text">{item}</span>
                  <span className="history-icon">↻</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="search-section">
          <h3>おすすめスポット</h3>
          <div className="recommend-list">
            {recommendationList.map((spot) => (
              <div key={spot.id} className="recommend-card" role="button" tabIndex={0} onClick={() => onSelectQuery(spot.title)}>
                <div className="recommend-image" aria-hidden="true">
                  {spot.imageUrl ? <img src={spot.imageUrl} alt="" /> : <span>{spot.category.toUpperCase()}</span>}
                </div>
                <div className="recommend-body">
                  <p className="recommend-title">{spot.title}</p>
                  <p className="recommend-meta">👍 {spot.likes} ・ 💬 {spot.commentsCount}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
