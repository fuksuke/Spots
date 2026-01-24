import { useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { signOut } from "firebase/auth";

import { useAuth } from "../../providers/AuthProvider";
import { useProfile } from "../../hooks/useProfile";
import { useSpotFeed } from "../../hooks/useSpotFeed";
import { auth } from "../../lib/firebase";
import { AccountLayout, AccountTab } from "./AccountLayout";
import { AccountProfileView } from "./AccountProfileView";
import { AccountSettingsView } from "./AccountSettingsView";
import { AccountEditView } from "./AccountEditView";
import "./AccountPage.css";

export const AccountPage = () => {
    const navigate = useNavigate();
    const { tab } = useParams();
    const { currentUser, authToken } = useAuth();

    const activeTab = useMemo<AccountTab>(() => {
        const validTabs: AccountTab[] = ["profile", "settings", "edit"];
        if (tab && validTabs.includes(tab as AccountTab)) {
            return tab as AccountTab;
        }
        return "profile";
    }, [tab]);

    const { profile: userProfile, mutate: mutateProfile } = useProfile(authToken);

    const { data: spotData } = useSpotFeed(undefined, authToken, currentUser?.uid ?? null);

    const mySpotCount = spotData?.filter((spot) => spot.ownerId === currentUser?.uid).length ?? 0;

    const handleTabChange = useCallback((newTab: AccountTab) => {
        navigate(`/account/${newTab}`);
    }, [navigate]);

    const handleShare = useCallback(async () => {
        const shareData = {
            title: userProfile?.displayName ?? "マイアカウント",
            text: `${userProfile?.displayName ?? "ユーザー"} @Shibuya LiveMap`,
            url: `https://shibuya-livemap.example/users/${currentUser?.uid}`
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareData.url);
            }
        } catch (error) {
            console.warn("シェアに失敗しました", error);
        }
    }, [currentUser?.uid, userProfile?.displayName]);

    const handleUpgrade = useCallback(() => {
        // TODO: アップグレードモーダルへの遷移
        navigate("/spots");
    }, [navigate]);

    const handlePrivateToggle = useCallback(async (next: boolean) => {
        if (!authToken) return;
        const response = await fetch("/api/profile", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({ isPrivateAccount: next })
        });
        if (!response.ok) {
            throw new Error("設定の変更に失敗しました");
        }
        await mutateProfile();
    }, [authToken, mutateProfile]);

    const handleLogout = useCallback(async () => {
        await signOut(auth);
        navigate("/spots");
    }, [navigate]);

    const handleProfileSaved = useCallback(() => {
        handleTabChange("profile");
    }, [handleTabChange]);

    const handleProfileRefresh = useCallback(async () => {
        await mutateProfile();
    }, [mutateProfile]);

    // 未ログイン時はリダイレクト
    if (!currentUser) {
        navigate("/spots");
        return null;
    }

    const renderContent = () => {
        switch (activeTab) {
            case "profile":
                return (
                    <AccountProfileView
                        user={currentUser}
                        profile={userProfile ?? null}
                        spotCount={mySpotCount}
                        onShare={handleShare}
                        onEdit={() => handleTabChange("edit")}
                    />
                );
            case "settings":
                return (
                    <AccountSettingsView
                        isPrivateAccount={Boolean(userProfile?.isPrivateAccount)}
                        onPrivateToggle={handlePrivateToggle}
                        onLogout={handleLogout}
                        onUpgrade={handleUpgrade}
                    />
                );
            case "edit":
                return (
                    <AccountEditView
                        user={currentUser}
                        profile={userProfile ?? null}
                        authToken={authToken}
                        onSaved={handleProfileSaved}
                        onProfileRefresh={handleProfileRefresh}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <AccountLayout activeTab={activeTab} onTabChange={handleTabChange}>
            {renderContent()}
        </AccountLayout>
    );
};
