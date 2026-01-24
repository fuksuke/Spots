import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../providers/AuthProvider";
import "./AdminLayout.css";
import { useAdminNotifications } from "../../hooks/useAdminNotifications";
import { AdminNotificationsPanel } from "./AdminNotificationsPanel";

type AdminTab = "scheduled" | "reports" | "analytics";

type AdminLayoutProps = {
    activeTab: AdminTab;
    onTabChange: (tab: AdminTab) => void;
    children: ReactNode;
    title?: string;
    actions?: ReactNode;
};

const TABS: Array<{ key: AdminTab; label: string; icon: string }> = [
    { key: "scheduled", label: "審査", icon: "clipboard" },
    { key: "reports", label: "通報", icon: "flag" },
    { key: "analytics", label: "統計", icon: "chart" }
];

const TabIcon = ({ icon }: { icon: string }) => {
    switch (icon) {
        case "clipboard":
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    <path d="M9 14l2 2 4-4" />
                </svg>
            );
        case "flag":
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
            );
        case "chart":
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
            );
        default:
            return null;
    }
};

export const AdminLayout = ({ activeTab, onTabChange, children, title, actions }: AdminLayoutProps) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useAdminNotifications(currentUser?.uid ? (currentUser as any).accessToken : undefined);

    const handleBack = () => {
        navigate("/spots");
    };

    return (
        <div className="admin-layout">
            <header className="admin-header">
                <button type="button" className="admin-back-btn" onClick={handleBack}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    <span className="admin-back-text">戻る</span>
                </button>
                <h1 className="admin-title">{title ?? "管理パネル"}</h1>
                <div className="admin-header-right">
                    {actions}
                    <span className="admin-user">
                        {currentUser?.email?.split("@")[0] ?? "管理者"}
                    </span>
                </div>
            </header>

            <div className="admin-body">
                {/* デスクトップ用サイドナビ */}
                <nav className="admin-nav admin-nav-desktop">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`admin-nav-btn ${activeTab === tab.key ? "active" : ""}`}
                            onClick={() => onTabChange(tab.key)}
                        >
                            <TabIcon icon={tab.icon} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="admin-content">
                    <AdminNotificationsPanel
                        notifications={notifications}
                        onMarkRead={markAsRead}
                        onMarkAllRead={markAllAsRead}
                    />
                    <main className="admin-main">
                        {children}
                    </main>
                </div>
            </div>

            {/* モバイル用ボトムタブバー */}
            <nav className="admin-bottom-tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        className={`admin-bottom-tab ${activeTab === tab.key ? "active" : ""}`}
                        onClick={() => onTabChange(tab.key)}
                    >
                        <TabIcon icon={tab.icon} />
                        <span className="admin-bottom-tab-label">{tab.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};

export type { AdminTab };
