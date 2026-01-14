import { Promotion } from "../hooks/usePromotions";

type PromotionBannerProps = {
  promotions: Promotion[];
  onSelect?: (promotion: Promotion) => void;
};

export const PromotionBanner = ({ promotions, onSelect }: PromotionBannerProps) => {
  if (promotions.length === 0) {
    return null;
  }

  // Limit to top 3 promotions for better UX
  const displayPromotions = promotions.slice(0, 3);

  return (
    <div className="promotion-banner" role="region" aria-label="公式告知">
      {displayPromotions.map((promo) => (
        <article key={promo.id} className="promotion-card">
          {promo.imageUrl && <img src={promo.imageUrl} alt={promo.headline ?? "イベント告知"} className="promotion-image" />}
          <div className="promotion-body">
            <p className="promotion-label">公式告知</p>
            <h3 className="promotion-headline">{promo.headline ?? "イベント情報"}</h3>
            <p className="promotion-dates">
              公開: {new Date(promo.publishAt).toLocaleDateString("ja-JP")}
            </p>
            <div className="promotion-actions">
              {promo.ctaUrl && (
                <a className="button primary" href={promo.ctaUrl} target="_blank" rel="noreferrer">
                  詳細を見る
                </a>
              )}
              {promo.spotId && (
                <button type="button" className="button subtle" onClick={() => onSelect?.(promo)}>
                  地図でチェック
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};
