import { Avatar } from "./Avatar";

type SpotOwnerBadgeProps = {
  ownerId: string;
  displayName?: string | null;
  photoUrl?: string | null;
};

export const SpotOwnerBadge = ({ ownerId, displayName, photoUrl }: SpotOwnerBadgeProps) => {
  const label = displayName?.trim() || ownerId;
  return (
    <div className="spot-owner-info">
      <Avatar name={label} photoUrl={photoUrl} size={28} />
      <span className="spot-owner-name">{label}</span>
    </div>
  );
};
