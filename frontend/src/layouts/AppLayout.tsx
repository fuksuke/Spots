
import { Outlet } from "react-router-dom";
import { MainLayout } from "./MainLayout";
import { SidebarNav } from "../components/layout/SidebarNav";
import { HeaderBar } from "../components/layout/HeaderBar";
import { ActionBar } from "../components/layout/ActionBar";
import { User } from "firebase/auth";
import { PageMode, ViewMode, Spot } from "../types";

export type AppLayoutProps = {
    currentUser: User | null;
    notificationsCount: number;
    pageMode: PageMode;
    viewMode: ViewMode;
    language: string;
    hasAdminClaim: boolean;
    onLogoClick: () => void;
    onSpotClick: () => void;
    onLoginClick: () => void;
    onSelectPage: (page: PageMode) => void;
    onModeToggle: () => void;
    onRefreshClick: () => void;
    onLanguageClick: () => void;
    onAccountClick: () => void;
    onNotificationsClick: () => void;
    onAdminClick: () => void;
    onLanguageChange: (lang: string) => void;
    layoutRef: React.RefObject<HTMLDivElement>;
    isMapHomeView: boolean;
    isListModeActive: boolean;
    isListHeaderHidden: boolean;
};

export const AppLayout = ({
    currentUser,
    notificationsCount,
    pageMode,
    viewMode,
    language,
    hasAdminClaim,
    onLogoClick,
    onSpotClick,
    onLoginClick,
    onSelectPage,
    onModeToggle,
    onRefreshClick,
    onLanguageClick,
    onAccountClick,
    onNotificationsClick,
    onAdminClick,
    onLanguageChange,
    layoutRef,
    isMapHomeView,
    isListModeActive,
    isListHeaderHidden
}: AppLayoutProps) => {
    const scrollMode = viewMode === "list" ? "fluid" : "fixed";

    return (
        <MainLayout
            scrollMode={scrollMode}
            sidebar={
                <SidebarNav
                    currentUser={currentUser}
                    notificationsCount={notificationsCount}
                    pageMode={pageMode}
                    viewMode={viewMode}
                    onLogoClick={onLogoClick}
                    onSpotClick={onSpotClick}
                    onLoginClick={onLoginClick}
                    onSelectPage={onSelectPage}
                    onModeToggle={onModeToggle}
                    onRefreshClick={onRefreshClick}
                    onLanguageClick={onLanguageClick}
                    onAccountClick={onAccountClick}
                    onNotificationsClick={onNotificationsClick}
                    showAdminButton={hasAdminClaim}
                    onAdminClick={onAdminClick}
                />
            }
            header={
                <HeaderBar
                    currentUser={currentUser}
                    notificationsCount={notificationsCount}
                    onLogoClick={onLogoClick}
                    onLoginClick={onLoginClick}
                    onNotificationsClick={onNotificationsClick}
                    onAccountClick={onAccountClick}
                    language={language}
                    onLanguageChange={onLanguageChange}
                    showAdminButton={hasAdminClaim}
                    onAdminClick={onAdminClick}
                />
            }
            actionBar={
                <ActionBar
                    pageMode={pageMode}
                    viewMode={viewMode}
                    onSpotClick={onSpotClick}
                    onSelectPage={onSelectPage}
                    onModeToggle={onModeToggle}
                />
            }
            layoutRef={layoutRef}
            className={[
                isMapHomeView ? "map-view" : "",
                isListModeActive ? "list-mode" : "",
                isListModeActive && isListHeaderHidden ? "list-header-hidden" : ""
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <Outlet />
        </MainLayout>
    );
};
