type AvatarProps = {
  name?: string | null;
  photoUrl?: string | null;
};

const getInitials = (value?: string | null) => {
  if (!value) return "?";
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return value.slice(0, 2).toUpperCase();
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || value.slice(0, 2).toUpperCase();
};

export const Avatar = ({ name, photoUrl }: AvatarProps) => {
  return photoUrl ? (
    <img
      className="avatar"
      src={photoUrl}
      alt={name ?? "ユーザー"}
      loading="lazy"
    />
  ) : (
    <span className="avatar avatar-fallback">
      {getInitials(name)}
    </span>
  );
};
