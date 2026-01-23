
import { useRef, useState, useEffect } from "react";
import { AdSenseUnit } from "../features/spots/AdSenseUnit";
import { TrendSection } from "../features/trending/TrendSection";
import { usePopularSpots } from "../hooks/usePopularSpots";
import { useTrendingSpots } from "../hooks/useTrendingSpots";
import { useNewSpots } from "../hooks/useNewSpots";
import { useBuzzSpots } from "../hooks/useBuzzSpots";
import { ADSENSE_CONFIG } from "../config/adsense";
import { Spot } from "../types";
import { useAuth } from "../providers/AuthProvider";
import "../features/trending/trending.css";

type TrendingPageProps = {
    onSpotSelect: (spot: Spot) => void;
    onSpotView: (spot: Spot | null | undefined) => void;
    mobileScrollFooter: React.ReactNode;
};

export const TrendingPage = ({
    onSpotSelect,
    onSpotView,
    mobileScrollFooter
}: TrendingPageProps) => {
    const { authToken } = useAuth();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.warn("Location access denied or failed", error);
                }
            );
        }
    }, []);

    // 1. Popular Spots (Popularity)
    const { spots: popularSpots, isLoading: isLoadingPopular } = usePopularSpots(10, authToken, userLocation);

    // 2. Rising Spots (Trending/Urgent)
    const { spots: trendingSpots, isLoading: isLoadingTrending } = useTrendingSpots(10, authToken, userLocation);

    // 3. New Spots (New Arrivals)
    const { spots: newSpots, isLoading: isLoadingNew } = useNewSpots(10, authToken, userLocation);

    // 4. Buzz Spots (Domestic/Japan)
    const { spots: buzzSpots, isLoading: isLoadingBuzz } = useBuzzSpots(10, authToken);

    const handleSpotClick = (spot: Spot) => {
        onSpotView(spot);
        onSpotSelect(spot);
    };

    return (
        <>
            <div className="category-spacer" aria-hidden="true" />
            <main
                ref={scrollRef}
                className="app-main content-area trending-page-container"
                aria-label="トレンドとプロモーション"
            >
                <header className="trending-header">
                    <div className="trending-header-content">
                        <h1 className="trending-title">TRENDING</h1>
                        <p className="trending-subtitle">渋谷の今を見逃さない</p>
                    </div>
                </header>

                {/* 1. Popular (Ranked) */}
                <TrendSection
                    title="人気ランキング"
                    icon="🏆"
                    spots={popularSpots}
                    isLoading={isLoadingPopular}
                    onSpotClick={handleSpotClick}
                    showRank={true}
                />

                {/* AdSense Unit 1 */}
                <div className="trend-ad-container">
                    <AdSenseUnit
                        slotId={ADSENSE_CONFIG.TRENDING_SLOT_ID}
                        format="auto"
                        className="trending-ad"
                    />
                </div>

                {/* 2. Rising / Trending */}
                <TrendSection
                    title="急上昇"
                    icon="📈"
                    spots={trendingSpots}
                    isLoading={isLoadingTrending}
                    onSpotClick={handleSpotClick}
                />

                {/* 3. New Arrivals */}
                <TrendSection
                    title="新着"
                    icon="🆕"
                    spots={newSpots}
                    isLoading={isLoadingNew}
                    onSpotClick={handleSpotClick}
                />

                {/* AdSense Unit 2 - Using same ID for now, or could be different if config allows */}
                <div className="trend-ad-container">
                    <AdSenseUnit
                        slotId={ADSENSE_CONFIG.TRENDING_SLOT_ID}
                        format="auto"
                        className="trending-ad"
                    />
                </div>

                {/* 4. Domestic Buzz (Japan) */}
                <TrendSection
                    title="国内で話題"
                    icon="🇯🇵"
                    spots={buzzSpots}
                    isLoading={isLoadingBuzz}
                    onSpotClick={handleSpotClick}
                />

                {mobileScrollFooter}
            </main>
        </>
    );
};
