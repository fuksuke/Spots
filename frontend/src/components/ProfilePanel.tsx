import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { Spot, SpotCategory, UserProfile } from "../types";
import { Avatar } from "./Avatar";
import { uploadAvatarFile } from "../lib/storage";

type ProfilePanelProps = {
  authToken?: string;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: unknown;
  onUnfollow: (targetUserId: string) => Promise<void>;
  onRemoveFavorite: (spotId: string) => Promise<void>;
  onProfileRefresh: () => Promise<void> | void;
};

const categoryOptions: SpotCategory[] = ["live", "event", "cafe"];

const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  return a.every((value) => b.includes(value));
};

export const ProfilePanel = ({
  authToken,
  user,
  profile,
  isLoading,
  error,
  onUnfollow,
  onRemoveFavorite,
  onProfileRefresh
}: ProfilePanelProps) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingUnfollowIds, setPendingUnfollowIds] = useState<Set<string>>(() => new Set());
  const [pendingFavoriteIds, setPendingFavoriteIds] = useState<Set<string>>(() => new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<SpotCategory[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile && !isEditing) {
      setDisplayNameInput(profile.displayName ?? "");
      setSelectedCategories(profile.followedCategories ?? []);
      setPhotoUrlInput(profile.photoUrl ?? "");
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
        setPhotoPreview(null);
      }
    }
  }, [profile, isEditing, photoPreview]);

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const handleUnfollowClick = async (targetUserId: string) => {
    if (!authToken) {
      setErrorMessage("操作するにはログインが必要です。");
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setPendingUnfollowIds((prev) => new Set(prev).add(targetUserId));
    try {
      await onUnfollow(targetUserId);
      await onProfileRefresh();
      setStatusMessage("フォローを解除しました。");
    } catch (unfollowError) {
      const message = unfollowError instanceof Error ? unfollowError.message : "フォロー解除に失敗しました";
      setErrorMessage(message);
    } finally {
      setPendingUnfollowIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  const handleRemoveFavoriteClick = async (spot: Spot) => {
    if (!authToken) {
      setErrorMessage("操作するにはログインが必要です。");
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setPendingFavoriteIds((prev) => new Set(prev).add(spot.id));
    try {
      await onRemoveFavorite(spot.id);
      await onProfileRefresh();
      setStatusMessage(`お気に入りから「${spot.title}」を外しました。`);
    } catch (favoriteError) {
      const message = favoriteError instanceof Error ? favoriteError.message : "お気に入り解除に失敗しました";
      setErrorMessage(message);
    } finally {
      setPendingFavoriteIds((prev) => {
        const next = new Set(prev);
        next.delete(spot.id);
        return next;
      });
    }
  };

  const handleStartEdit = () => {
    if (!profile) return;
    setStatusMessage(null);
    setErrorMessage(null);
    setDisplayNameInput(profile.displayName ?? "");
    setSelectedCategories(profile.followedCategories ?? []);
    setPhotoUrlInput(profile.photoUrl ?? "");
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    if (profile) {
      setDisplayNameInput(profile.displayName ?? "");
      setSelectedCategories(profile.followedCategories ?? []);
      setPhotoUrlInput(profile.photoUrl ?? "");
    }
  };

  const handlePhotoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
      setPhotoUrlInput("");
    } else {
      setPhotoPreview(null);
    }
  };

  const handleCategoryToggle = (category: SpotCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
    );
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken || !profile) {
      setErrorMessage("ログインが必要です。");
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsSaving(true);

    try {
      let resolvedPhotoUrl: string | null | undefined = undefined;
      if (photoFile) {
        resolvedPhotoUrl = await uploadAvatarFile(photoFile);
      } else if (photoUrlInput.trim() !== profile.photoUrl) {
        resolvedPhotoUrl = photoUrlInput.trim() ? photoUrlInput.trim() : null;
      }

      const trimmedDisplayName = displayNameInput.trim();
      const updates: {
        displayName?: string | null;
        photoUrl?: string | null;
        followedCategories?: SpotCategory[];
      } = {};

      if (trimmedDisplayName !== (profile.displayName ?? "")) {
        updates.displayName = trimmedDisplayName || null;
      }

      if (resolvedPhotoUrl !== undefined) {
        updates.photoUrl = resolvedPhotoUrl;
      }

      if (!arraysEqual(selectedCategories, profile.followedCategories ?? [])) {
        updates.followedCategories = selectedCategories;
      }

      if (Object.keys(updates).length === 0) {
        setStatusMessage("変更はありません。");
        setIsEditing(false);
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

      await onProfileRefresh();
      setStatusMessage("プロフィールを更新しました。");
      setIsEditing(false);
      setPhotoFile(null);
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
        setPhotoPreview(null);
      }
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "プロフィールの更新に失敗しました";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="panel">
        <h2>プロフィール</h2>
        <p className="hint">ログインするとフォロー・お気に入り情報が表示されます。</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="panel">
        <h2>プロフィール</h2>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (error) {
    const message = error instanceof Error ? error.message : "プロフィールの取得に失敗しました";
    return (
      <div className="panel">
        <h2>プロフィール</h2>
        <p className="status error">{message}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="panel">
        <h2>プロフィール</h2>
        <p className="hint">プロフィール情報を取得できませんでした。</p>
        {errorMessage && <p className="status error">{errorMessage}</p>}
      </div>
    );
  }

  const followedUsers = profile.followedUsers ?? [];
  const favoriteSpots = profile.favoriteSpots ?? [];
  const resolvedPreviewPhoto = photoPreview ?? (photoUrlInput.trim() ? photoUrlInput.trim() : null);

  return (
    <div className="panel">
      <h2>プロフィール</h2>
      <div className="profile-header-row">
        <Avatar
          name={profile.displayName ?? user.displayName ?? user.email ?? undefined}
          photoUrl={isEditing ? resolvedPreviewPhoto ?? profile.photoUrl ?? user.photoURL ?? null : profile.photoUrl ?? user.photoURL ?? null}
          size={42}
        />
      <div className="profile-header-text">
        <p className="hint">{profile.displayName ?? user.displayName ?? "表示名未設定"}</p>
        <p className="hint">{profile.email ?? user.email}</p>
        <p className="hint">
          Tier: {profile.posterTier.toUpperCase()} / フォロワー {profile.followersCount.toLocaleString("ja-JP")}
        </p>
        {profile.isVerified && <p className="status success">公式認証済みアカウント</p>}
        <p className={`status ${profile.phoneVerified ? "success" : "error"}`.trim()}>
          {profile.phoneVerified ? "✅ SMS認証済み" : "SMS認証未完了 — 投稿前に本人確認を完了してください"}
        </p>
      </div>
      </div>

      {isEditing ? (
        <form className="profile-edit-form" onSubmit={handleEditSubmit}>
          <label className="form-group">
            <span>表示名</span>
            <input
              className="input"
              value={displayNameInput}
              onChange={(event) => setDisplayNameInput(event.target.value)}
              placeholder="表示名"
            />
          </label>
          <label className="form-group">
            <span>写真をアップロード</span>
            <input type="file" accept="image/*" onChange={handlePhotoFileChange} />
            {photoPreview && <img src={photoPreview} alt="プレビュー" className="image-preview" />}
          </label>
          <label className="form-group">
            <span>写真URL（任意）</span>
            <input
              className="input"
              value={photoUrlInput}
              onChange={(event) => {
                setPhotoUrlInput(event.target.value);
                if (photoPreview) {
                  URL.revokeObjectURL(photoPreview);
                  setPhotoPreview(null);
                }
                setPhotoFile(null);
              }}
              placeholder="Firebase Storage のURLなど"
            />
          </label>
          <div className="form-group">
            <span>フォロー中のカテゴリ</span>
            <div className="category-checkboxes">
              {categoryOptions.map((category) => (
                <label key={category} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category)}
                    onChange={() => handleCategoryToggle(category)}
                  />
                  {category.toUpperCase()}
                </label>
              ))}
            </div>
          </div>
          <div className="profile-edit-actions">
            <button type="submit" className="button primary" disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </button>
            <button type="button" className="button subtle" onClick={handleCancelEdit} disabled={isSaving}>
              キャンセル
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="button subtle" onClick={handleStartEdit}>
          プロフィールを編集
        </button>
      )}

      {profile.followedCategories && profile.followedCategories.length > 0 && (
        <div className="form-group">
          <span>フォロー中のカテゴリ</span>
          <p className="hint">{profile.followedCategories.join(", ")}</p>
        </div>
      )}

      <div className="form-group">
        <span>告知枠の残数</span>
        <p className="hint">
          短期: {profile.promotionQuota.shortTerm ?? "無制限"} / 長期: {profile.promotionQuota.longTerm ?? "未対応"}
        </p>
      </div>

      <div className="form-group">
        <span>フォロー中の投稿者</span>
        {followedUsers.length > 0 ? (
          <ul className="follow-list">
            {followedUsers.map((item) => (
              <li key={item.uid} className="follow-list-item">
                <div className="follow-list-user">
                  <Avatar name={item.displayName ?? item.uid} photoUrl={item.photoUrl} size={28} />
                  <span>{item.displayName ?? item.uid}</span>
                </div>
                <button
                  type="button"
                  className="button subtle"
                  onClick={() => void handleUnfollowClick(item.uid)}
                  disabled={!authToken || pendingUnfollowIds.has(item.uid)}
                >
                  フォロー解除
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">まだフォローがありません。</p>
        )}
      </div>

      <div className="form-group">
        <span>お気に入りスポット</span>
        {favoriteSpots.length > 0 ? (
          <ul className="follow-list">
            {favoriteSpots.map((spot) => (
              <li key={spot.id} className="follow-list-item">
                <div className="follow-list-user">
                  <Avatar name={spot.title} photoUrl={spot.imageUrl ?? spot.ownerPhotoUrl ?? null} size={28} />
                  <div className="favorite-spot-text">
                    <span>{spot.title}</span>
                    <small className="hint">{spot.ownerDisplayName ?? spot.ownerId}</small>
                  </div>
                </div>
                <button
                  type="button"
                  className="button subtle"
                  onClick={() => void handleRemoveFavoriteClick(spot)}
                  disabled={!authToken || pendingFavoriteIds.has(spot.id)}
                >
                  お気に入り解除
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">まだお気に入りがありません。</p>
        )}
      </div>

      {statusMessage && <p className="status success">{statusMessage}</p>}
      {errorMessage && <p className="status error">{errorMessage}</p>}
    </div>
  );
};
