
import { AdSenseUnit } from "../features/spots/AdSenseUnit";
import { PopularSpotsPanel } from "../features/spots/PopularSpotsPanel";
import { TrendingNewSpotsPanel } from "../features/spots/TrendingNewSpotsPanel";
import { ADSENSE_CONFIG } from "../config/adsense";
import { Spot } from "../types";
import { Promotion } from "../hooks/usePromotions";

type TrendingPageProps = {
    popularSpots: Spot[];
    promotions: Promotion[];
    isLoadingPopularSpots: boolean;
    popularError: unknown;
    trendingNewSpots: Spot[];
    isLoadingTrendingNew: boolean;
    trendingNewError: unknown;
    onSpotSelect: (spot: Spot) => void;
    onSpotView: (spot: Spot | null | undefined) => void;
    onPromotionSelect: (promotion: Promotion) => void;
    mobileScrollFooter: React.ReactNode;
};

export const TrendingPage = ({
    popularSpots,
    promotions,
    isLoadingPopularSpots,
    popularError,
    trendingNewSpots,
    isLoadingTrendingNew,
    trendingNewError,
    onSpotSelect,
    onSpotView,
    onPromotionSelect,
    mobileScrollFooter
}: TrendingPageProps) => {
    return (
        <>
            <div className="category-spacer" aria-hidden="true" />
            <main className="app-main content-area trending" aria-label="トレンドとプロモーション">
                <div className="trending-content">
                    <header className="trending-header-hero">
                        <div className="trending-hero-background"></div>
                        <div className="trending-hero-content">
                            <div className="trending-hero-icon">
                                <span className="icon-fire">🔥</span>
                                <span className="icon-star">✨</span>
                            </div>
                            <h1 className="trending-hero-title">トレンド</h1>
                            <p className="trending-hero-subtitle">渋谷で今、話題のイベントを発見しよう</p>
                        </div>
                    </header>

                    {/* Google AdSense - Primary monetization placement */}
                    <AdSenseUnit
                        slotId={ADSENSE_CONFIG.TRENDING_SLOT_ID}
                        format="auto"
                        className="trending-ad"
                    />

                    <PopularSpotsPanel
                        spots={popularSpots}
                        promotions={promotions}
                        isLoading={isLoadingPopularSpots}
                        error={popularError}
                        onSpotSelect={onSpotSelect}
                        onSpotView={onSpotView}
                        onPromotionSelect={onPromotionSelect}
                    />

                    <TrendingNewSpotsPanel
                        spots={trendingNewSpots}
                        isLoading={isLoadingTrendingNew}
                        error={trendingNewError}
                        onSpotSelect={onSpotSelect}
                        onSpotView={onSpotView}
                    />
                </div>
                {mobileScrollFooter}
            </main>
        </>
    );
};
