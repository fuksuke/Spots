import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import "./AccountLayout.css";

type AccountTab = "profile" | "settings" | "edit" | "archive";

type AccountLayoutProps = {
    activeTab: AccountTab;
    onTabChange: (tab: AccountTab) => void;
    children: ReactNode;
    title?: string;
};

const TABS: Array<{ key: AccountTab; label: string; icon: string }> = [
    { key: "profile", label: "プロフィール", icon: "user" },
    { key: "settings", label: "設定", icon: "gear" },
    { key: "edit", label: "編集", icon: "pencil" },
    { key: "archive", label: "アーカイブ", icon: "archive" }
];

const TabIcon = ({ icon }: { icon: string }) => {
    switch (icon) {
        case "user":
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>
            );
        case "gear":
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
            );
        case "pencil":
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
            );
        case "archive":
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="21 8 21 21 3 21 3 8" />
                    <rect x="1" y="3" width="22" height="5" />
                    <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
            );
        default:
            return null;
    }
};

export const AccountLayout = ({ activeTab, onTabChange, children, title }: AccountLayoutProps) => {
    const navigate = useNavigate();

    const handleBack = () => {
        navigate("/spots");
    };

    return (
        <div className="account-layout">
            <header className="account-header">
                <button type="button" className="account-back-btn" onClick={handleBack}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    <span className="account-back-text">戻る</span>
                </button>
                <h1 className="account-title">{title ?? "アカウント"}</h1>
                <div className="account-header-right" />
            </header>

            <div className="account-body">
                {/* デスクトップ用サイドナビ */}
                <nav className="account-nav account-nav-desktop">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`account-nav-btn ${activeTab === tab.key ? "active" : ""}`}
                            onClick={() => onTabChange(tab.key)}
                        >
                            <TabIcon icon={tab.icon} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="account-content">
                    <main className="account-main">
                        {children}
                    </main>
                </div>
            </div>

            {/* モバイル用ボトムタブバー */}
            <nav className="account-bottom-tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        className={`account-bottom-tab ${activeTab === tab.key ? "active" : ""}`}
                        onClick={() => onTabChange(tab.key)}
                    >
                        <TabIcon icon={tab.icon} />
                        <span className="account-bottom-tab-label">{tab.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};

export type { AccountTab };
