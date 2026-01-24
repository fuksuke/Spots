import { Spot } from "../types";

export type NotificationType =
  | "like"
  | "follow"
  | "new_post"
  | "post_approved"
  | "post_rejected"
  | "post_active"
  | "post_ended"
  | "admin_action"
  | "moderation"
  | "system";

export type InAppNotification = {
  id: string;
  message: string;
  title?: string;
  type?: NotificationType;
  createdAt: string;
  source: "local" | "remote";
  spot?: Spot;
  spotId?: string | null;
  priority?: "standard" | "high";
  docId?: string | null;
  metadata?: Record<string, unknown>;
};

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  like: "❤️",
  follow: "👤",
  new_post: "📍",
  post_approved: "✅",
  post_rejected: "❌",
  post_active: "🎉",
  post_ended: "⏰",
  admin_action: "⚠️",
  moderation: "📋",
  system: "📢"
};

const getNotificationIcon = (type?: NotificationType): string => {
  if (!type) return "🔔";
  return NOTIFICATION_ICONS[type] ?? "🔔";
};

type InAppNotificationsProps = {
  notifications: InAppNotification[];
  isOpen: boolean;
  hasAdminAccess: boolean;
  onSelect: (notification: InAppNotification) => void;
  onDismiss: (notification: InAppNotification) => void;
  onDismissAll: () => void;
  onAdminClick?: () => void;
  onClose: () => void;
};

export const InAppNotifications = ({
  notifications,
  isOpen,
  hasAdminAccess,
  onSelect,
  onDismiss,
  onDismissAll,
  onAdminClick,
  onClose
}: InAppNotificationsProps) => {
  if (!isOpen) {
    return null;
  }

  const hasNotifications = notifications.length > 0;

  return (
    <div className="floating-panel notification-panel open" role="dialog" aria-modal="true" aria-label="通知">
      <div className="floating-scrim" aria-hidden="true" onClick={onClose} />
      <section className="floating-body notification-panel-card" role="document">
        <header className="notification-panel__header">
          <div>
            <h3>通知</h3>
            <p className="notification-panel__subtitle">
              {hasNotifications ? `新着通知 (${notifications.length})` : "通知はありません"}
            </p>
          </div>
          <div className="notification-panel__actions">
            {hasNotifications ? (
              <button type="button" className="button subtle" onClick={onDismissAll}>
                すべて既読
              </button>
            ) : null}
            <button type="button" className="button subtle" onClick={onClose}>
              閉じる
            </button>
          </div>
        </header>

        <section className="notification-panel__body">
          {hasNotifications ? (
            <ul>
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`notification-card ${notification.priority === "high" ? "notification-card-urgent" : ""}`.trim()}
                >
                  <div className="notification-icon" aria-hidden="true">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-main">
                    {notification.title ? (
                      <p className="notification-title">{notification.title}</p>
                    ) : null}
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
          ) : (
            <div className="notification-panel__empty">
              <p>最新情報をこちらでお知らせします。</p>
            </div>
          )}
        </section>


      </section>
    </div>
  );
};
