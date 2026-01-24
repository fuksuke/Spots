import { useState } from "react";

export type AccountSettingsViewProps = {
    isPrivateAccount: boolean;
    onPrivateToggle: (next: boolean) => Promise<void> | void;
    onLogout: () => Promise<void> | void;
    onUpgrade: () => void;
};

export const AccountSettingsView = ({
    isPrivateAccount: initialPrivate,
    onPrivateToggle,
    onLogout,
    onUpgrade
}: AccountSettingsViewProps) => {
    const [isPrivateAccount, setIsPrivateAccount] = useState(initialPrivate);
    const [isTogglingPrivate, setIsTogglingPrivate] = useState(false);
    const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
    const [settingsError, setSettingsError] = useState<string | null>(null);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

    const handlePrivateToggleClick = async () => {
        const next = !isPrivateAccount;
        setIsTogglingPrivate(true);
        setSettingsError(null);
        try {
            await onPrivateToggle(next);
            setIsPrivateAccount(next);
            setSettingsMessage(next ? "アカウントを非公開に設定しました。" : "アカウントを公開に設定しました。");
        } catch (error) {
            const message = error instanceof Error ? error.message : "設定の変更に失敗しました";
            setSettingsError(message);
        } finally {
            setIsTogglingPrivate(false);
        }
    };

    const handleLogoutClick = () => {
        setIsLogoutConfirmOpen(true);
    };

    const handleConfirmLogout = async () => {
        try {
            await onLogout();
        } finally {
            setIsLogoutConfirmOpen(false);
        }
    };

    const handleCancelLogout = () => {
        setIsLogoutConfirmOpen(false);
    };

    return (
        <div className="account-settings-view-page">
            <div className="settings-section">
                <h2 className="settings-section-title">プライバシー</h2>
                <label className="settings-toggle-row">
                    <span>プライベートアカウント</span>
                    <button
                        type="button"
                        className={`toggle ${isPrivateAccount ? "on" : "off"}`.trim()}
                        onClick={handlePrivateToggleClick}
                        disabled={isTogglingPrivate}
                        aria-pressed={isPrivateAccount}
                        aria-label="プライベートアカウントの切り替え"
                    >
                        <span className="sr-only">{isPrivateAccount ? "オン" : "オフ"}</span>
                    </button>
                </label>
                {settingsMessage ? <p className="status success">{settingsMessage}</p> : null}
                {settingsError ? <p className="status error">{settingsError}</p> : null}
            </div>

            <div className="settings-section">
                <h2 className="settings-section-title">アカウント</h2>
                <button type="button" className="button primary" onClick={onUpgrade} style={{ marginBottom: "12px", width: "100%" }}>
                    アップグレード
                </button>
                <button type="button" className="button danger" onClick={handleLogoutClick}>
                    ログアウト
                </button>
            </div>

            {isLogoutConfirmOpen ? (
                <div className="logout-confirm-overlay">
                    <div className="logout-confirm-card">
                        <h3>ログアウトしますか？</h3>
                        <div className="logout-confirm-actions">
                            <button type="button" className="button primary" onClick={handleConfirmLogout}>
                                ログアウト
                            </button>
                            <button type="button" className="button subtle" onClick={handleCancelLogout}>
                                キャンセル
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};
