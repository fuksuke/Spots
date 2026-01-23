import "../../styles/components/AccountPanel.css";

import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { User } from "firebase/auth";

import { uploadAvatarFile } from "../../lib/storage";
import { UserProfile } from "../../types";
import { Icon } from "../../components/ui/Icon";

export type AccountPanelProps = {
  isOpen: boolean;
  user: User | null;
  profile: UserProfile | null;
  spotCount: number;
  authToken?: string;
  onClose: () => void;
  onShare: () => void;
  onUpgrade: () => void;
  onLogout: () => Promise<void> | void;
  onPrivateToggle?: (next: boolean) => Promise<void> | void;
  onProfileRefresh?: () => Promise<void> | void;
};

type AccountView = "summary" | "settings" | "edit";

const normalizeWebsite = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export const AccountPanel = ({
  isOpen,
  user,
  profile,
  spotCount,
  authToken,
  onClose,
  onShare,
  onUpgrade,
  onLogout,
  onPrivateToggle,
  onProfileRefresh
}: AccountPanelProps) => {
  const [activeView, setActiveView] = useState<AccountView>("summary");
  const [isPrivateAccount, setIsPrivateAccount] = useState(Boolean(profile?.isPrivateAccount));
  const [isTogglingPrivate, setIsTogglingPrivate] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    setIsPrivateAccount(Boolean(profile?.isPrivateAccount));
  }, [profile?.isPrivateAccount]);

  useEffect(() => {
    if (!isOpen) {
      setActiveView("summary");
      setIsLogoutConfirmOpen(false);
      setEditPhotoFile(null);
      if (editPhotoPreview) {
        URL.revokeObjectURL(editPhotoPreview);
        setEditPhotoPreview(null);
      }
      setEditError(null);
      setSettingsError(null);
      setSettingsMessage(null);
    }
  }, [isOpen, editPhotoPreview]);

  useEffect(() => {
    if (activeView === "edit") {
      setEditDisplayName(profile?.displayName ?? user?.displayName ?? "");
      setEditBio(profile?.bio ?? "");
      setEditWebsite(profile?.websiteUrl ?? "");
      setEditError(null);
      setIsSavingEdit(false);
      setEditPhotoFile(null);
      if (editPhotoPreview) {
        URL.revokeObjectURL(editPhotoPreview);
        setEditPhotoPreview(null);
      }
    }
  }, [activeView, profile?.displayName, profile?.bio, profile?.websiteUrl, user?.displayName, editPhotoPreview]);

  const openSettingsView = () => {
    setActiveView("settings");
    setSettingsError(null);
    setSettingsMessage(null);
  };

  const closeSettingsView = () => {
    setActiveView("summary");
    setSettingsError(null);
    setSettingsMessage(null);
  };

  const handlePrivateToggleClick = async () => {
    if (!onPrivateToggle) {
      setSettingsError("プライベート設定の変更機能は現在ご利用いただけません。");
      return;
    }
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
      closeSettingsView();
      onClose();
    }
  };

  const handleCancelLogout = () => {
    setIsLogoutConfirmOpen(false);
  };

  const openEditView = () => {
    setActiveView("edit");
  };

  const closeEditView = () => {
    setActiveView("summary");
    setEditError(null);
    setIsSavingEdit(false);
    if (editPhotoPreview) {
      URL.revokeObjectURL(editPhotoPreview);
      setEditPhotoPreview(null);
    }
    setEditPhotoFile(null);
  };

  const handlePhotoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (editPhotoPreview) {
      URL.revokeObjectURL(editPhotoPreview);
      setEditPhotoPreview(null);
    }
    setEditPhotoFile(file);
    if (file) {
      setEditPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleImageClick();
    }
  };

  const handleSaveEdit = async () => {
    if (!authToken) {
      setEditError("保存するにはログインが必要です。");
      return;
    }
    const trimmedName = editDisplayName.trim();
    const trimmedBio = editBio.trim();
    const normalizedWebsite = normalizeWebsite(editWebsite).trim();

    const originalName = profile?.displayName ?? user?.displayName ?? "";
    const originalBio = profile?.bio ?? "";
    const originalWebsite = profile?.websiteUrl ? normalizeWebsite(profile.websiteUrl) : "";

    const updates: {
      displayName?: string | null;
      bio?: string | null;
      websiteUrl?: string | null;
      photoUrl?: string | null;
    } = {};

    if (trimmedName !== originalName) {
      updates.displayName = trimmedName || null;
    }
    if (trimmedBio !== originalBio) {
      updates.bio = trimmedBio || null;
    }
    if (normalizedWebsite !== originalWebsite) {
      updates.websiteUrl = normalizedWebsite || null;
    }

    setEditError(null);
    setIsSavingEdit(true);

    try {
      if (editPhotoFile) {
        const uploaded = await uploadAvatarFile(editPhotoFile);
        updates.photoUrl = uploaded;
      }

      if (Object.keys(updates).length === 0) {
        closeEditView();
        return;
      }

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "プロフィールの更新に失敗しました");
      }

      await onProfileRefresh?.();
      closeEditView();
    } catch (error) {
      const message = error instanceof Error ? error.message : "プロフィールの更新に失敗しました";
      setEditError(message);
      setIsSavingEdit(false);
    }
  };

  const renderSummaryView = () => (
    <>
      <div className="account-card-body">
        <div className="account-card-summary">
          <div className="account-avatar" aria-hidden="true">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <Icon name="user" label="" size={42} />}
          </div>
          <div className="account-summary-meta">
            <div className="account-display-name">{displayName}</div>
            <dl className="account-stats">
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
        <div className="account-bio" aria-label="自己紹介">
          {bio || "自己紹介はまだ設定されていません。"}
        </div>
        <div className="account-website">
          {formattedWebsite ? (
            <a href={formattedWebsite} target="_blank" rel="noreferrer">
              {formattedWebsite.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            <span className="hint">ウェブサイトは未登録です。</span>
          )}
        </div>
        <div className="account-actions">
          <button type="button" className="button subtle" onClick={openEditView}>
            編集
          </button>
          <button type="button" className="button subtle" onClick={onShare}>
            共有
          </button>
          <button type="button" className="button primary" onClick={onUpgrade}>
            アップグレード
          </button>
        </div>
      </div>
    </>
  );

  const renderSettingsView = () => (
    <div className="account-settings-view">
      <header className="account-settings-header">
        <h2>設定</h2>
      </header>
      <div className="account-settings-body">
        <label className="settings-toggle">
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
        <button type="button" className="button danger" onClick={handleLogoutClick}>
          ログアウト
        </button>
      </div>
    </div>
  );

  const renderEditView = () => {
    const preview = editPhotoPreview ?? avatarUrl ?? null;
    return (
      <div className="account-edit">
        <header className="account-edit-header">
          <h2>プロフィール編集</h2>
        </header>
        <div className="account-edit-body">
          <div
            className="account-edit-avatar"
            onClick={handleImageClick}
            onKeyDown={handleImageKeyDown}
            role="button"
            tabIndex={0}
          >
            {preview ? <img src={preview} alt="プロフィール画像" /> : <Icon name="user" label="" size={56} />}
            <span className="account-edit-avatar-hint">変更</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handlePhotoFileChange}
          />
          <label className="form-group">
            <span>名前</span>
            <input className="input" value={editDisplayName} onChange={(event) => setEditDisplayName(event.target.value)} />
          </label>
          <label className="form-group">
            <span>自己紹介</span>
            <textarea className="textarea" value={editBio} onChange={(event) => setEditBio(event.target.value)} rows={4} />
          </label>
          <label className="form-group">
            <span>ウェブサイト</span>
            <input className="input" value={editWebsite} onChange={(event) => setEditWebsite(event.target.value)} />
          </label>
          {editError ? <p className="status error">{editError}</p> : null}
        </div>
        <div className="account-edit-footer">
          <button type="button" className="button primary" onClick={handleSaveEdit} disabled={isSavingEdit}>
            {isSavingEdit ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="floating-panel account-panel open" role="dialog" aria-modal="true">
      <div className="floating-scrim" aria-hidden="true" onClick={onClose} />
      <section className="floating-body account-card" role="document">
        <header className="account-card-header">
          <button
            type="button"
            className="text-button"
            onClick={
              activeView === "edit" ? closeEditView : activeView === "settings" ? closeSettingsView : onClose
            }
          >
            ← 戻る
          </button>
          <div className="account-header-actions">
            {activeView === "summary" ? (
              <button type="button" className="icon-button" aria-label="設定" onClick={openSettingsView}>
                <Icon name="gear" label="設定" />
              </button>
            ) : null}
          </div>
        </header>
        <div className={`account-card-content view-${activeView}`}>
          {activeView === "summary"
            ? renderSummaryView()
            : activeView === "settings"
              ? renderSettingsView()
              : renderEditView()}
        </div>
      </section>

      {isLogoutConfirmOpen ? (
        <div className="floating-panel logout-dialog open" role="alertdialog" aria-modal="true" aria-labelledby="logout-heading">
          <div className="floating-scrim" aria-hidden="true" onClick={handleCancelLogout} />
          <div className="floating-body logout-card">
            <h3 id="logout-heading">ログアウトしますか？</h3>
            <div className="logout-actions">
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
