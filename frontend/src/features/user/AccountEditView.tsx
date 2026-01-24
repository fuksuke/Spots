import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { User } from "firebase/auth";

import { uploadAvatarFile } from "../../lib/storage";
import { UserProfile } from "../../types";
import { Icon } from "../../components/ui/Icon";

export type AccountEditViewProps = {
    user: User | null;
    profile: UserProfile | null;
    authToken?: string;
    onSaved: () => void;
    onProfileRefresh?: () => Promise<void> | void;
};

const normalizeWebsite = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    return `https://${trimmed}`;
};

export const AccountEditView = ({
    user,
    profile,
    authToken,
    onSaved,
    onProfileRefresh
}: AccountEditViewProps) => {
    const [editDisplayName, setEditDisplayName] = useState("");
    const [editBio, setEditBio] = useState("");
    const [editWebsite, setEditWebsite] = useState("");
    const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
    const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
    const [editError, setEditError] = useState<string | null>(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const avatarUrl = profile?.photoUrl ?? user?.photoURL ?? undefined;

    useEffect(() => {
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.displayName, profile?.bio, profile?.websiteUrl, user?.displayName]);

    useEffect(() => {
        return () => {
            if (editPhotoPreview) {
                URL.revokeObjectURL(editPhotoPreview);
            }
        };
    }, [editPhotoPreview]);

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
                onSaved();
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
            onSaved();
        } catch (error) {
            const message = error instanceof Error ? error.message : "プロフィールの更新に失敗しました";
            setEditError(message);
            setIsSavingEdit(false);
        }
    };

    const preview = editPhotoPreview ?? avatarUrl ?? null;

    return (
        <div className="account-edit-view-page">
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
