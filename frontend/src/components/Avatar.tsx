type AvatarProps = {
  name?: string | null;
  photoUrl?: string | null;
  size?: number;
};

const getInitials = (value?: string | null) => {
  if (!value) return "?";
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return value.slice(0, 2).toUpperCase();
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || value.slice(0, 2).toUpperCase();
};

export const Avatar = ({ name, photoUrl, size = 32 }: AvatarProps) => {
  return photoUrl ? (
    <img
      className="avatar"
      src={photoUrl}
      alt={name ?? "ユーザー"}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  ) : (
    <span className="avatar avatar-fallback" style={{ width: size, height: size }}>
      {getInitials(name)}
    </span>
  );
};
