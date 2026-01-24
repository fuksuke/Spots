import { useArchivedSpots } from "../../hooks/useArchivedSpots";

export const AccountArchiveView = () => {
    const { spots: archivedSpots, isLoading: isLoadingArchive } = useArchivedSpots();

    return (
        <div className="account-archive-view-page">
            <h2 className="archive-title">過去の投稿</h2>
            <div className="archive-body">
                {isLoadingArchive ? (
                    <p className="status-message">読み込み中...</p>
                ) : archivedSpots.length === 0 ? (
                    <p className="empty-message">アーカイブされた投稿はありません。</p>
                ) : (
                    <ul className="archive-list">
                        {archivedSpots.map((spot) => (
                            <li key={spot.id} className="archive-item">
                                <span className="archive-date">
                                    {new Date(spot.startTime).toLocaleDateString("ja-JP", {
                                        year: "numeric",
                                        month: "2-digit",
                                        day: "2-digit"
                                    })}
                                </span>
                                <span className="archive-spot-title">{spot.title}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};
