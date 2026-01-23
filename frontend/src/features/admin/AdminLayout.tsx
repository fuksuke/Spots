import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../providers/AuthProvider";
import "./AdminLayout.css";

type AdminTab = "scheduled" | "reports" | "analytics";

type AdminLayoutProps = {
    activeTab: AdminTab;
    onTabChange: (tab: AdminTab) => void;
    children: ReactNode;
    title?: string;
    actions?: ReactNode;
};

const TABS: Array<{ key: AdminTab; label: string }> = [
    { key: "scheduled", label: "審査・管理" },
    { key: "reports", label: "通報" },
    { key: "analytics", label: "統計" }
];

export const AdminLayout = ({ activeTab, onTabChange, children, title, actions }: AdminLayoutProps) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const handleBack = () => {
        navigate("/spots");
    };

    return (
        <div className="admin-layout">
            <header className="admin-header">
                <button type="button" className="admin-back-btn" onClick={handleBack}>
                    戻る
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
                <nav className="admin-nav">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`admin-nav-btn ${activeTab === tab.key ? "active" : ""}`}
                            onClick={() => onTabChange(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>

                <main className="admin-main">
                    {children}
                </main>
            </div>
        </div>
    );
};

export type { AdminTab };
