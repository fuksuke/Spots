import { useMemo } from "react";
import { User } from "firebase/auth";

import { UserProfile } from "../../types";
import { Icon } from "../../components/ui/Icon";
import { AccountArchiveView } from "./AccountArchiveView";
import "./AccountPage.css";

export type AccountProfileViewProps = {
    user: User | null;
    profile: UserProfile | null;
    spotCount: number;
    onShare: () => void;
    onEdit: () => void;
    onUpgrade: () => void;
};

const normalizeWebsite = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    return `https://${trimmed}`;
};

export const AccountProfileView = ({
    user,
    profile,
    spotCount,
    onShare,
    onEdit,
    onUpgrade
}: AccountProfileViewProps) => {
    const displayName = profile?.displayName ?? user?.displayName ?? "ユーザー";
    const avatarUrl = profile?.photoUrl ?? user?.photoURL ?? undefined;
    const followCount = profile?.followedUserIds?.length ?? 0;
    const followerCount = profile?.followersCount ?? 0;
    const bio = profile?.bio ?? "自己紹介はまだ設定されていません。";
    const website = profile?.websiteUrl ?? "";

    const formattedWebsite = useMemo(() => {
        if (!website) return "";
        try {
            const url = new URL(normalizeWebsite(website));
            return url.href;
        } catch {
            return website;
        }
    }, [website]);

    return (
        <div className="account-profile-view">
            <div className="account-profile-summary">
                <div className="account-profile-avatar" aria-hidden="true">
                    {avatarUrl ? <img src={avatarUrl} alt="" /> : <Icon name="user" label="" size={48} />}
                </div>
                <div className="account-profile-meta">
                    <div className="account-profile-name">{displayName}</div>
                    <dl className="account-profile-stats">
                        <div>
                            <dt>投稿数</dt>
                            <dd>{spotCount}</dd>
                        </div>
                        <div>
                            <dt>フォロー</dt>
                            <dd>{followCount}</dd>
                        </div>
                        <div>
                            <dt>フォロワー</dt>
                            <dd>{followerCount}</dd>
                        </div>
                    </dl>
                </div>
            </div>

            <div className="account-profile-bio" aria-label="自己紹介">
                {bio || "自己紹介はまだ設定されていません。"}
            </div>

            <div className="account-profile-website">
                {formattedWebsite ? (
                    <a href={formattedWebsite} target="_blank" rel="noreferrer">
                        {formattedWebsite.replace(/^https?:\/\//, "")}
                    </a>
                ) : (
                    <span className="hint">ウェブサイトは未登録です。</span>
                )}
            </div>

            <div className="account-profile-actions">
                <div className="account-profile-actions-row">
                    <button type="button" className="button subtle" onClick={onEdit}>
                        編集
                    </button>
                    <button type="button" className="button subtle" onClick={onShare}>
                        共有
                    </button>
                </div>
                <button type="button" className="button primary" onClick={onUpgrade}>
                    アップグレード
                </button>
            </div>

            <div className="account-profile-archive-section">
                <AccountArchiveView />
            </div>
        </div>
    );
};
