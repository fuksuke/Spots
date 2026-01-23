import { User } from "firebase/auth";

import { Icon } from "../ui/Icon";

export type HeaderBarProps = {
  currentUser: User | null;
  notificationsCount: number;
  onLogoClick: () => void;
  onLoginClick: () => void;
  onNotificationsClick: () => void;
  onAccountClick: () => void;
  language: string;
  onLanguageChange: (language: string) => void;
};

export const HeaderBar = ({
  currentUser,
  notificationsCount,
  onLogoClick,
  onLoginClick,
  onNotificationsClick,
  onAccountClick,
  language,
  onLanguageChange
}: HeaderBarProps) => {
  const renderActions = () => {
    if (!currentUser) {
      return (
        <button type="button" className="text-button" onClick={onLoginClick} aria-label="ログイン">
          Login
        </button>
      );
    }

    return (
      <div className="header-auth-buttons">
        <button
          type="button"
          className="icon-button"
          onClick={onNotificationsClick}
          aria-label="通知"
        >
          <Icon name="bell" label="通知" />
          {notificationsCount > 0 ? <span className="icon-badge">{notificationsCount}</span> : null}
        </button>
        <button
          type="button"
          className="icon-button header-account-button"
          onClick={onAccountClick}
          aria-label="アカウント"
        >
          <Icon name="user" label="アカウント" />
        </button>
      </div>
    );
  };

  const languageSelectId = "language-select";

  return (
    <header className="app-header compact" aria-label="ナビゲーション">
      <button type="button" className="header-logo" onClick={onLogoClick}>
        <img src="/Spots 透過ロゴ.svg" alt="Spots" className="header-logo-image" />
      </button>
      <div className="header-actions">
        <div className="language-select">
          <Icon name="globe" wrapperClassName="language-icon" />
          <label className="sr-only" htmlFor={languageSelectId}>
            言語選択
          </label>
          <select
            id={languageSelectId}
            value={language}
            onChange={(event) => onLanguageChange(event.target.value)}
            aria-label="言語"
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
            <option value="zh">中文</option>
            <option value="ko">한국어</option>
          </select>
        </div>
        {renderActions()}
      </div>
    </header>
  );
};
