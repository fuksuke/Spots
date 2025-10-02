import { Spot } from "../types";

export type InAppNotification = {
  id: string;
  message: string;
  createdAt: string;
  source: "local" | "remote";
  spot?: Spot;
  spotId?: string | null;
  priority?: "standard" | "high";
  docId?: string | null;
};

type InAppNotificationsProps = {
  notifications: InAppNotification[];
  onSelect: (notification: InAppNotification) => void;
  onDismiss: (notification: InAppNotification) => void;
  onDismissAll: () => void;
};

export const InAppNotifications = ({ notifications, onSelect, onDismiss, onDismissAll }: InAppNotificationsProps) => {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-stack" role="status" aria-live="polite">
      <div className="notification-header">
        <span>新着通知 ({notifications.length})</span>
        <button type="button" className="button subtle" onClick={onDismissAll}>
          すべて閉じる
        </button>
      </div>
      <ul>
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className={`notification-card ${notification.priority === "high" ? "notification-card-urgent" : ""}`.trim()}
          >
            <div className="notification-main">
              <p className="notification-message">{notification.message}</p>
              <time className="notification-time" dateTime={notification.createdAt}>
                {new Date(notification.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
              </time>
            </div>
            <div className="notification-actions">
              {(notification.spot || notification.spotId) ? (
                <button type="button" className="button subtle" onClick={() => onSelect(notification)}>
                  {notification.spot ? "地図で見る" : "詳細を開く"}
                </button>
              ) : null}
              <button type="button" className="button subtle" onClick={() => onDismiss(notification)}>
                閉じる
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
