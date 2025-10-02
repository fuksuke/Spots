import { User } from "firebase/auth";
import { ReactNode } from "react";
import { PageMode, ViewMode } from "../types";

export type SidebarNavProps = {
  currentUser: User | null;
  notificationsCount: number;
  pageMode: PageMode;
  viewMode: ViewMode;
  onLogoClick: () => void;
  onSpotClick: () => void;
  onLoginClick: () => void;
  onSelectPage: (page: PageMode) => void;
  onModeToggle: () => void;
  onRefreshClick: () => void;
  onLanguageClick: () => void;
  onSettingsClick: () => void;
  onNotificationsClick: () => void;
  showAdminButton?: boolean;
  onAdminClick?: () => void;
};

const NavButton = ({
  children,
  onClick,
  isPrimary = false,
  badge
}: {
  children: ReactNode;
  onClick: () => void;
  isPrimary?: boolean;
  badge?: number;
}) => {
  return (
    <button
      type="button"
      className={`nav-button ${isPrimary ? "primary" : ""}`.trim()}
      onClick={onClick}
    >
      <span>{children}</span>
      {badge && badge > 0 ? <span className="nav-badge">{badge}</span> : null}
    </button>
  );
};

export const SidebarNav = ({
  currentUser,
  notificationsCount,
  pageMode,
  viewMode,
  onLogoClick,
  onSpotClick,
  onLoginClick,
  onSelectPage,
  onModeToggle,
  onRefreshClick,
  onLanguageClick,
  onSettingsClick,
  onNotificationsClick,
  showAdminButton = false,
  onAdminClick
}: SidebarNavProps) => {
  const modeLabel = viewMode === "map" ? "List Mode" : "Map Mode";

  return (
    <aside className="sidebar-nav" aria-label="アプリケーションメニュー">
      <div className="sidebar-section">
        <button type="button" className="logo-button" onClick={onLogoClick}>
          <img src="/Spots 透過ロゴ.svg" alt="Spots" className="logo-image" />
        </button>
        <NavButton onClick={onSpotClick}>
          spot(投稿)
        </NavButton>
        {currentUser ? (
          <>
            <NavButton onClick={() => onSelectPage(pageMode === "home" ? "trending" : "home")}>
              {pageMode === "home" ? "トレンド" : "ホーム"}
            </NavButton>
            <NavButton onClick={onNotificationsClick} badge={notificationsCount}>
              通知
            </NavButton>
            <NavButton onClick={onRefreshClick}>更新</NavButton>
            <NavButton onClick={onSettingsClick}>アカウント</NavButton>
            {showAdminButton ? <NavButton onClick={onAdminClick ?? (() => undefined)}>審査</NavButton> : null}
          </>
        ) : (
          <NavButton onClick={onLoginClick}>Login</NavButton>
        )}
      </div>
      <div className="sidebar-section bottom">
        {pageMode === "home" ? <NavButton onClick={onModeToggle}>{modeLabel}</NavButton> : null}
        <NavButton onClick={onLanguageClick}>Language</NavButton>
        <NavButton onClick={onSettingsClick}>設定</NavButton>
      </div>
    </aside>
  );
};
