import { AdminNotification } from "../../hooks/useAdminNotifications";

type AdminNotificationsPanelProps = {
    notifications: AdminNotification[];
    onMarkRead: (id: string) => void;
    onMarkAllRead: () => void;
};

export const AdminNotificationsPanel = ({
    notifications,
    onMarkRead,
    onMarkAllRead
}: AdminNotificationsPanelProps) => {
    const unreadNotifications = notifications.filter(n => !n.read);
    const unreadCount = unreadNotifications.length;

    return (
        <div className={`admin-notifications-bar ${unreadCount > 0 ? "has-unread" : ""}`}>
            <div className="notifications-header">
                <span className="notifications-title">
                    通知 {unreadCount > 0 && `(${unreadCount}件の未読)`}
                </span>
                {unreadCount > 0 && (
                    <button type="button" className="button subtle small" onClick={onMarkAllRead}>
                        すべて既読
                    </button>
                )}
            </div>
            {unreadCount === 0 ? (
                <p className="notifications-empty">新しい通知はありません</p>
            ) : (
                <ul className="notifications-list">
                    {unreadNotifications.map((n) => (
                        <li
                            key={n.id}
                            className="notification-item"
                            onClick={() => onMarkRead(n.id)}
                        >
                            <span className="notification-icon">
                                {n.type === "report_created" && "🚨"}
                                {n.type === "spot_pending_review" && "📝"}
                                {n.type === "system_alert" && "⚠️"}
                            </span>
                            <span className="notification-message">{n.message}</span>
                            <span className="notification-time">
                                {new Date(n.created_at).toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
