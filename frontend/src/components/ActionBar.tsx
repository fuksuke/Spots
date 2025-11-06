import { PageMode, ViewMode } from "../types";

import { Icon } from "./Icon";

export type ActionBarProps = {
  pageMode: PageMode;
  viewMode: ViewMode;
  onSpotClick: () => void;
  onSelectPage: (page: PageMode) => void;
  onModeToggle: () => void;
};

export const ActionBar = ({ pageMode, viewMode, onSpotClick, onSelectPage, onModeToggle }: ActionBarProps) => {
  const isHome = pageMode === "home";
  const nextModeIcon = viewMode === "map" ? (
    <Icon name="list" wrapperClassName="action-icon" label="リスト表示" />
  ) : (
    <Icon name="map" wrapperClassName="action-icon" label="マップ表示" />
  );
  const nextModeLabel = viewMode === "map" ? "リストビュー" : "マップビュー";

  return (
    <nav className="action-bar" aria-label="アクションバー">
      <button
        type="button"
        className="action-bar-button"
        onClick={() => onSelectPage(isHome ? "trending" : "home")}
      >
        {isHome ? (
          <>
            <Icon name="trend" wrapperClassName="action-icon" label="トレンド" />
            <span>トレンド</span>
          </>
        ) : (
          <>
            <Icon name="home" wrapperClassName="action-icon" label="ホーム" />
            <span>ホーム</span>
          </>
        )}
      </button>
      <button type="button" className="action-bar-button primary" onClick={onSpotClick}>
        <Icon name="add" wrapperClassName="action-icon" label="投稿" />
        <span>投稿</span>
      </button>
      {isHome ? (
        <button type="button" className="action-bar-button" onClick={onModeToggle}>
          {nextModeIcon}
          <span>{nextModeLabel}</span>
        </button>
      ) : null}
    </nav>
  );
};
