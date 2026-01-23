import type { CSSProperties } from "react";

export type AvatarProps = {
  name?: string | null;
  photoUrl?: string | null;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

const getInitials = (value?: string | null) => {
  if (!value) return "?";
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return value.slice(0, 2).toUpperCase();
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || value.slice(0, 2).toUpperCase();
};

export const Avatar = ({ name, photoUrl, size, className, style }: AvatarProps) => {
  const dimensionStyles = size ? { width: size, height: size } : null;
  const composedStyle = dimensionStyles ? { ...dimensionStyles, ...style } : style;
  const baseClass = photoUrl ? "avatar" : "avatar avatar-fallback";
  const classNames = [baseClass, className].filter(Boolean).join(" ");

  return photoUrl ? (
    <img
      className={classNames}
      src={photoUrl}
      alt={name ?? "ユーザー"}
      loading="lazy"
      style={composedStyle as CSSProperties | undefined}
    />
  ) : (
    <span className={classNames} style={composedStyle}>
      {getInitials(name)}
    </span>
  );
};
