import { User } from "firebase/auth";

import { Icon } from "./Icon";

export type HeaderBarProps = {
  currentUser: User | null;
  notificationsCount: number;
  onLogoClick: () => void;
  onLoginClick: () => void;
  onAccountClick: () => void;
  language: string;
  onLanguageChange: (language: string) => void;
};

export const HeaderBar = ({
  currentUser,
  notificationsCount,
  onLogoClick,
  onLoginClick,
  onAccountClick,
  language,
  onLanguageChange
}: HeaderBarProps) => {
  const renderAuthButton = () => {
    if (currentUser) {
      return (
        <button type="button" className="icon-button" onClick={onAccountClick} aria-label="アカウント">
          <Icon name="bell" label="通知" />
          {notificationsCount > 0 ? <span className="icon-badge">{notificationsCount}</span> : null}
        </button>
      );
    }
    return (
      <button type="button" className="text-button" onClick={onLoginClick} aria-label="ログイン">
        Login
      </button>
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
        {renderAuthButton()}
      </div>
    </header>
  );
};
