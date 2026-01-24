import { useState, useEffect, useCallback } from "react";
import type { NotificationPreferences } from "../../types";

type NotificationSettingsProps = {
    preferences: NotificationPreferences | undefined;
    onSave: (preferences: NotificationPreferences) => Promise<void>;
    isSaving: boolean;
};

type SettingItem = {
    key: keyof NotificationPreferences;
    label: string;
    description: string;
};

const NOTIFICATION_SETTINGS: SettingItem[] = [
    { key: "like", label: "いいね", description: "投稿やコメントがいいねされた時" },
    { key: "follow", label: "フォロー", description: "新しいフォロワーがいる時" },
    { key: "newPost", label: "フォロー中の投稿", description: "フォロー中のユーザーが投稿した時" },
    { key: "postApproved", label: "承認通知", description: "予約投稿が承認された時" },
    { key: "postRejected", label: "却下通知", description: "予約投稿が却下された時" },
    { key: "postActive", label: "公開通知", description: "予約投稿が公開された時" },
    { key: "adminAction", label: "管理者アクション", description: "管理者からのアクション通知" }
];

const DEFAULT_PREFERENCES: NotificationPreferences = {
    like: true,
    follow: true,
    newPost: true,
    postApproved: true,
    postRejected: true,
    postActive: true,
    adminAction: true
};

export const NotificationSettings = ({
    preferences,
    onSave,
    isSaving
}: NotificationSettingsProps) => {
    const [localPrefs, setLocalPrefs] = useState<NotificationPreferences>(
        () => ({ ...DEFAULT_PREFERENCES, ...preferences })
    );
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        setLocalPrefs({ ...DEFAULT_PREFERENCES, ...preferences });
        setIsDirty(false);
    }, [preferences]);

    const handleToggle = useCallback((key: keyof NotificationPreferences) => {
        setLocalPrefs((prev) => {
            const newPrefs = { ...prev, [key]: !prev[key] };
            setIsDirty(true);
            return newPrefs;
        });
    }, []);

    const handleSave = useCallback(async () => {
        await onSave(localPrefs);
        setIsDirty(false);
    }, [localPrefs, onSave]);

    return (
        <section className="notification-settings">
            <header className="notification-settings__header">
                <h3>通知設定</h3>
                <p className="notification-settings__subtitle">受け取る通知を選択してください</p>
            </header>

            <ul className="notification-settings__list">
                {NOTIFICATION_SETTINGS.map((setting) => (
                    <li key={setting.key} className="notification-setting-item">
                        <div className="notification-setting-info">
                            <span className="notification-setting-label">{setting.label}</span>
                            <span className="notification-setting-description">{setting.description}</span>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={localPrefs[setting.key] ?? true}
                                onChange={() => handleToggle(setting.key)}
                                disabled={isSaving}
                            />
                            <span className="toggle-slider" />
                        </label>
                    </li>
                ))}
            </ul>

            <footer className="notification-settings__footer">
                <button
                    type="button"
                    className="button primary"
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                >
                    {isSaving ? "保存中..." : "保存"}
                </button>
            </footer>
        </section>
    );
};
