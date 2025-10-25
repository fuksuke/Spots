import { Avatar } from "./Avatar";

type SpotOwnerBadgeProps = {
  ownerId: string;
  displayName?: string | null;
  photoUrl?: string | null;
  phoneVerified?: boolean;
};

export const SpotOwnerBadge = ({ ownerId, displayName, photoUrl, phoneVerified }: SpotOwnerBadgeProps) => {
  const label = displayName?.trim() || ownerId;
  return (
    <div className="spot-owner-info">
      <Avatar name={label} photoUrl={photoUrl} size={28} />
      <span className="spot-owner-name">{label}</span>
      {phoneVerified ? (
        <span className="spot-owner-verified" title="SMS認証済み" aria-label="SMS認証済み">
          ✅
        </span>
      ) : null}
    </div>
  );
};
