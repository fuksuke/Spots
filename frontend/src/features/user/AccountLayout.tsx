import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import "./AccountLayout.css";

type AccountTab = "profile" | "settings" | "edit";

type AccountLayoutProps = {
    activeTab: AccountTab;
    onTabChange: (tab: AccountTab) => void;
    children: ReactNode;
    title?: string;
};



export const AccountLayout = ({ activeTab, onTabChange, children, title }: AccountLayoutProps) => {
    const navigate = useNavigate();

    const handleBack = () => {
        if (activeTab !== "profile") {
            onTabChange("profile");
            return;
        }
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
                <div className="account-header-right">
                    <button type="button" className="account-settings-btn" onClick={() => onTabChange("settings")}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                        <span className="account-back-text">設定</span>
                    </button>
                </div>
            </header>

            <div className="account-body">
                <div className="account-content">
                    <main className="account-main">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
};

export type { AccountTab };
