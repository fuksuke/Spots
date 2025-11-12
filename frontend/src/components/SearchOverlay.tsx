import { FormEvent } from "react";
// Spot やモックデータはこのコンポーネントでは使用しない
import { Icon } from "./Icon";

const popularQueries = ["ライブ", "フードトラック", "DJセット", "朝活", "限定グッズ"];

// JSON から読み込んだスポット情報は検索結果の表示で使用しないため、このコンポーネントでは定義しない

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

  // 推薦リストや検索結果の表示はモーダル外で行うため、ここでは計算しない

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
            <input
              autoFocus={isOpen}
              value={query}
              onChange={(event) => onChange(event.target.value)}
              placeholder="検索"
              aria-label="検索"
            />
            {/* 検索実行ボタンとして虫眼鏡アイコンを配置 */}
            <button type="submit" className="search-button" aria-label="検索">
              <Icon name="search" wrapperClassName="search-icon" />
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
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* 検索結果やおすすめスポットは別画面で表示するため、ここでは非表示 */}
      </div>
    </div>
  );
};
