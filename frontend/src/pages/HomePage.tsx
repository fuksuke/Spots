
import { CategoryTabs } from "../features/spots/CategoryTabs";
import { MapView } from "../features/map/MapView";
import { SpotListView } from "../features/spots/SpotListView";
import { Coordinates, Spot, SpotCategory, TileCoordinate, ViewMode } from "../types";
import { CategoryOption } from "../hooks/useCategoryTabs";

type HomePageProps = {
    viewMode: ViewMode;
    categoryOptions: CategoryOption[];
    activeCategoryKey: string;
    onCategorySelect: (key: string) => void;
    onSearchToggle: () => void;
    onManageCategories: () => void;
    mainRef: React.RefObject<HTMLElement>;
    homeMainAriaLabel: string;
    displaySpots: Spot[];
    selectedLocation: Coordinates | null;
    onSelectLocation: (coords: Coordinates) => void;
    focusCoordinates: Coordinates | null;
    onSpotClick: (spotId: string) => void;
    onSpotView: (spotId: string | null | undefined) => void;
    onSpotSelectList: (spot: Spot) => void;
    onSpotViewList: (spot: Spot | null | undefined) => void;
    activeTileCategories: SpotCategory[] | undefined;
    authToken: string;
    isLoadingSpots: boolean;
    spotError: unknown;
    mobileScrollFooter: React.ReactNode;
};

export const HomePage = ({
    viewMode,
    categoryOptions,
    activeCategoryKey,
    onCategorySelect,
    onSearchToggle,
    onManageCategories,
    mainRef,
    homeMainAriaLabel,
    displaySpots,
    selectedLocation,
    onSelectLocation,
    focusCoordinates,
    onSpotClick,
    onSpotView,
    onSpotSelectList,
    onSpotViewList,
    activeTileCategories,
    authToken,
    isLoadingSpots,
    spotError,
    mobileScrollFooter
}: HomePageProps) => {
    return (
        <>
            <CategoryTabs
                options={categoryOptions}
                activeKey={activeCategoryKey}
                onSelect={onCategorySelect}
                onSearchToggle={onSearchToggle}
                onManageCategories={onManageCategories}
            />
            <main
                ref={mainRef}
                className={`app-main content-area ${viewMode}`.trim()}
                aria-label={homeMainAriaLabel}
            >
                {viewMode === "map" ? (
                    <MapView
                        initialView={{
                            longitude: 139.7016,
                            latitude: 35.6595,
                            zoom: 14
                        }}
                        spots={displaySpots}
                        selectedLocation={selectedLocation}
                        onSelectLocation={onSelectLocation}
                        focusCoordinates={focusCoordinates}
                        onSpotClick={onSpotClick}
                        onSpotView={onSpotView}
                        tileCategories={activeTileCategories}
                        authToken={authToken}
                    />
                ) : (
                    <>
                        <SpotListView
                            spots={displaySpots}
                            isLoading={isLoadingSpots}
                            error={spotError}
                            onSpotSelect={onSpotSelectList}
                            onSpotView={onSpotViewList}
                        />
                        {mobileScrollFooter}
                    </>
                )}
            </main>
        </>
    );
};
