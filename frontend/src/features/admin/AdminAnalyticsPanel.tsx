import { AnalyticsOverview } from "../../hooks/useAdminAnalytics";

const formatNumber = (value: number) => value.toLocaleString("ja-JP");

const formatSeconds = (value: number) => `${Math.round(value)} 秒`;

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const SparkLine = ({ points }: { points: Array<number> }) => {
  if (points.length === 0) return null;
  const max = Math.max(...points, 1);
  const normalized = points.map((value, index) => ({
    x: (index / (points.length - 1 || 1)) * 100,
    y: 100 - (value / max) * 100
  }));
  const d = normalized
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" role="presentation">
      <path d={d} fill="none" stroke="url(#sparklineGradient)" strokeWidth="3" />
      <defs>
        <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const AdminAnalyticsPanel = ({ overview }: { overview: AnalyticsOverview }) => {
  return (
    <div className="panel admin-analytics-panel">
      <h2>アナリティクス</h2>
      <p className="hint">計測期間: {overview.timeRange} / 更新: {new Date(overview.generatedAt).toLocaleString("ja-JP")}</p>
      <div className="analytics-grid">
        <div className="analytics-card major">
          <span>アクティブユーザー</span>
          <strong>{formatNumber(overview.metrics.activeUsers)}</strong>
        </div>
        <div className="analytics-card">
          <span>マップ滞在時間</span>
          <strong>{formatSeconds(overview.metrics.avgMapDwellSeconds)}</strong>
        </div>
        <div className="analytics-card">
          <span>スクロール深度</span>
          <strong>{formatPercent(overview.metrics.avgScrollDepth)}</strong>
        </div>
        <div className="analytics-card">
          <span>スポット閲覧数</span>
          <strong>{formatNumber(overview.metrics.spotViews)}</strong>
        </div>
        <div className="analytics-card">
          <span>未処理通報</span>
          <strong>{formatNumber(overview.metrics.reportsOpen)}</strong>
        </div>
      </div>
      <div className="analytics-trend">
        <header>
          <div>
            <h3>24h トレンド</h3>
            <p className="hint">アクティブユーザーと閲覧数の推移</p>
          </div>
          <div className="trend-legend">
            <span className="legend active-users">アクティブユーザー</span>
            <span className="legend spot-views">スポット閲覧</span>
          </div>
        </header>
        <div className="trend-chart">
          <SparkLine points={overview.trend.map((point) => point.activeUsers)} />
        </div>
      </div>
    </div>
  );
};
