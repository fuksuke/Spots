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
          ) : (
            <div className="notification-panel__empty">
              <p>最新情報をこちらでお知らせします。</p>
            </div>
          )}
        </section>

        {hasAdminAccess ? (
          <footer className="notification-panel__footer">
            <button type="button" className="button primary" onClick={onAdminClick}>
              管理画面
            </button>
            <p className="hint">審査・通報の管理画面を開きます。</p>
          </footer>
        ) : null}
      </section>
    </div>
  );
};
