import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { MapView } from "./components/MapView";
import type { MapViewProps } from "./components/MapView";
import { SidebarNav } from "./components/SidebarNav";
import { HeaderBar } from "./components/HeaderBar";
import { ActionBar } from "./components/ActionBar";
import { CategoryTabs } from "./components/CategoryTabs";
import { SpotListView } from "./components/SpotListView";
import { SpotDetailSheet } from "./components/SpotDetailSheet";
import { SearchOverlay } from "./components/SearchOverlay";
import { InAppNotifications } from "./components/InAppNotifications";
import type { InAppNotification } from "./components/InAppNotifications";
import { PopularSpotsPanel } from "./components/PopularSpotsPanel";
import { PromotionBanner } from "./components/PromotionBanner";
import { AdminDashboard } from "./components/AdminDashboard";
import { AccountPanel } from "./components/AccountPanel";
import { SpotCreatePage } from "./components/SpotCreatePage";
import { trackEvent, trackError, trackPageView } from "./lib/analytics";
import { setSentryUser } from "./lib/sentry";
import { useSpotFeed } from "./hooks/useSpotFeed";
import { useProfile } from "./hooks/useProfile";
import { usePopularSpots } from "./hooks/usePopularSpots";
import { usePromotions } from "./hooks/usePromotions";
import { useLayoutMetrics } from "./hooks/useLayoutMetrics";
import { useCategoryTabs } from "./hooks/useCategoryTabs";
import type { CategoryKey } from "./hooks/useCategoryTabs";
import { useSearchHistory } from "./hooks/useSearchHistory";
import { useBillingReturn } from "./hooks/useBillingReturn";
import { auth, db } from "./lib/firebase";
import { recordSpotView } from "./lib/spotEngagement";
import { getOrCreateViewSessionId } from "./lib/viewSession";
import { mockSpots } from "./mockData";
import { Coordinates, Spot, SpotCategory, ViewMode, PageMode } from "./types";

const AuthPanel = lazy(() => import("./components/AuthPanel").then((module) => ({ default: module.AuthPanel })));

const DEFAULT_HOME_VIEW: MapViewProps['initialView'] = {
  longitude: 139.7016,
  latitude: 35.6595,
  zoom: 14
};



const BILLING_FAQ_PATH = "/billing-faq.html";

const VIEW_DEBOUNCE_MS = 2 * 60 * 1000;

const MOBILE_SCROLL_FOOTER = (
  <footer className="app-footer scroll-footer">
    <span>© 2025 MyApp</span>
    <a href="#privacy">Privacy</a>
    <a href="#terms">Terms of Use</a>
    <a href={BILLING_FAQ_PATH} target="_blank" rel="noreferrer">
      Billing FAQ
    </a>
  </footer>
);


type NotificationDoc = {
  body?: string;
  title?: string;
  metadata?: {
    spotId?: string | null;
  };
  created_at?: {
    toDate?: () => Date;
  };
  priority?: string;
};

const SUPPORT_EMAIL = "support@shibuya-livemap.local";


function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const layoutRootRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "map";
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("view") === "list" ? "list" : "map";
    } catch {
      return "map";
    }
  });
  const {
    categoryOptions,
    availableCategoryOptions,
    activeCategoryKey,
    categoryFilter,
    categoryDraftKeys,
    isCategoryManagerOpen,
    selectCategory,
    openCategoryManager,
    closeCategoryManager,
    toggleCategoryDraft,
    saveCategoryDraft
  } = useCategoryTabs();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextView = params.get("view") === "list" ? "list" : "map";
    setViewMode((current) => (current === nextView ? current : nextView));
  }, [location.search]);

  const applyViewModeToQuery = useCallback(
    (mode: ViewMode) => {
      const params = new URLSearchParams(location.search);
      if (mode === "map") {
        params.delete("view");
      } else {
        params.set("view", "list");
      }
      setSearchParams(params, { replace: false });
    },
    [location.search, setSearchParams]
  );

  const {
    searchValue,
    searchInput,
    recentSearches,
    isSearchOverlayOpen,
    setSearchInput,
    openSearchOverlay,
    closeSearchOverlay,
    applySearch: applySearchRaw
  } = useSearchHistory();
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [isAccountPanelOpen, setAccountPanelOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [focusCoordinates, setFocusCoordinates] = useState<Coordinates | null>(null);
  const [authToken, setAuthToken] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null);
  const [appMessage, setAppMessage] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>(() => {
    if (typeof window === "undefined") return "ja";
    return window.localStorage.getItem("ui-language") ?? "ja";
  });
  const toastTimeoutRef = useRef<number | null>(null);
  const knownSpotIdsRef = useRef<Set<string>>(new Set());
  const notifiedSpotIdsRef = useRef<Set<string>>(new Set());
  const notificationsInitializedRef = useRef(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isUpgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [isBillingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [hasAdminClaim, setHasAdminClaim] = useState(false);
  const [isAdminPanelOpen, setAdminPanelOpen] = useState(false);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [isSheetModalOpen, setSheetModalOpen] = useState(false);
  const profileRefreshTimeoutRef = useRef<number | null>(null);
  const viewSessionIdRef = useRef<string>(getOrCreateViewSessionId());
  const recentViewMapRef = useRef<Map<string, number>>(new Map());
  const supportMailto = `mailto:${SUPPORT_EMAIL}`;
  const isAnyModalOpen =
    isAdminPanelOpen ||
    isAccountPanelOpen ||
    isAuthModalOpen ||
    isCategoryManagerOpen ||
    isUpgradeModalOpen ||
    isNotificationsOpen ||
    isSheetModalOpen;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("modal-open", isAnyModalOpen);
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [isAnyModalOpen]);

  const triggerMessage = useCallback((message: string) => {
    setAppMessage(message);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setAppMessage(null);
      toastTimeoutRef.current = null;
    }, 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      if (profileRefreshTimeoutRef.current) {
        window.clearTimeout(profileRefreshTimeoutRef.current);
        profileRefreshTimeoutRef.current = null;
      }
    };
  }, []);

  const hasTrackedInitialPageViewRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasTrackedInitialPageViewRef.current) return;
    hasTrackedInitialPageViewRef.current = true;
    trackPageView(window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setSentryUser(null);
      return;
    }
    setSentryUser({ id: currentUser.uid, email: currentUser.email ?? undefined });
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const [token, idTokenResult] = await Promise.all([user.getIdToken(), user.getIdTokenResult()]);
          setCurrentUser(user);
          setAuthToken(token);
          setHasAdminClaim(Boolean(idTokenResult.claims?.admin));
        } catch (error) {
          console.warn("トークン取得に失敗しました", error);
          setCurrentUser(user);
          setAuthToken("");
          setHasAdminClaim(false);
        }
      } else {
        setCurrentUser(null);
        setAuthToken("");
        setHasAdminClaim(false);
        setAdminPanelOpen(false);
        knownSpotIdsRef.current = new Set();
        notifiedSpotIdsRef.current = new Set();
        notificationsInitializedRef.current = false;
        setNotifications([]);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    if (path === "/spots/new" && !currentUser) {
      triggerMessage("スポットを投稿するにはログインしてください");
      setAuthModalOpen(true);
      navigate("/spots", { replace: true });
    }
  }, [currentUser, location.pathname, navigate, triggerMessage]);

  const profileState = useProfile(authToken);

  const {
    profile: userProfile,
    isLoading: isProfileLoading,
    mutate: mutateProfile
  } = profileState;

  const stripeCustomerId = userProfile?.stripeCustomerId ?? null;
  const promotionQuotaSummary = userProfile?.promotionQuota ?? {};
  const promotionQuotaUpdatedAt = userProfile?.promotionQuotaUpdatedAt ?? null;
  const promotionQuotaUpdatedLabel = promotionQuotaUpdatedAt
    ? new Date(promotionQuotaUpdatedAt).toLocaleString("ja-JP")
    : "未更新";

  const markNotificationsAsRead = useCallback((items: InAppNotification[]) => {
    items.forEach((notification) => {
      if (notification.source === "remote" && notification.docId) {
        void updateDoc(doc(db, "notifications", notification.docId), { read: true });
      }
    });
  }, []);

  const scheduleProfileRefresh = useCallback(() => {
    void mutateProfile();
    if (profileRefreshTimeoutRef.current) {
      window.clearTimeout(profileRefreshTimeoutRef.current);
    }
    profileRefreshTimeoutRef.current = window.setTimeout(() => {
      void mutateProfile();
      profileRefreshTimeoutRef.current = null;
    }, 5000);
  }, [mutateProfile]);

  const handleQuotaRefreshClick = useCallback(() => {
    trackEvent("billing_quota_refresh_manual", {});
    scheduleProfileRefresh();
  }, [scheduleProfileRefresh]);

  useEffect(() => {
    if (!currentUser) return;
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("user_id", "==", currentUser.uid),
      where("read", "==", false),
      orderBy("created_at", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const remoteNotifications = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as NotificationDoc;
          const createdAtValue =
            data.created_at && typeof data.created_at.toDate === "function"
              ? data.created_at.toDate().toISOString()
              : new Date().toISOString();

          return {
            id: docSnap.id,
            docId: docSnap.id,
            source: "remote" as const,
            message: typeof data.body === "string" ? data.body : typeof data.title === "string" ? data.title : "通知があります",
            createdAt: createdAtValue,
            spotId: data.metadata?.spotId ?? null,
            priority: data.priority === "high" ? "high" : "standard"
          } satisfies InAppNotification;
        });

        setNotifications((current) => {
          const localOnly = current.filter((notification) => notification.source === "local");
          return [...localOnly, ...remoteNotifications];
        });
      },
      (error) => {
        console.warn("通知の購読に失敗しました", error);
        setNotifications((current) => current.filter((notification) => notification.source === "local"));
        unsubscribe();
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  useBillingReturn({ onMessage: triggerMessage, onRefreshProfile: scheduleProfileRefresh });

  useEffect(() => {
    if (!currentUser || !authToken) return;
    if (!userProfile || isProfileLoading) return;

    const profile = userProfile;
    const shouldSyncDisplay = !profile.displayName && Boolean(currentUser.displayName);
    const shouldSyncPhoto = !profile.photoUrl && Boolean(currentUser.photoURL);

    if (!shouldSyncDisplay && !shouldSyncPhoto) {
      return;
    }

    const payload: { displayName?: string | null; photoUrl?: string | null } = {};
    if (shouldSyncDisplay) {
      payload.displayName = currentUser.displayName ?? null;
    }
    if (shouldSyncPhoto) {
      payload.photoUrl = currentUser.photoURL ?? null;
    }

    let cancelled = false;
    (async () => {
      try {
        await fetch("/api/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });
        if (!cancelled) {
          await mutateProfile();
        }
      } catch (error) {
        console.warn("プロフィール同期に失敗しました", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser, authToken, userProfile, isProfileLoading, mutateProfile]);

  const {
    data: spotData,
    error: spotError,
    isLoading: isLoadingSpots,
    mutate: mutateSpots
  } = useSpotFeed(undefined, authToken, currentUser?.uid ?? null);

  const {
    spots: popularSpots,
    isLoading: isLoadingPopularSpots,
    error: popularError
  } = usePopularSpots(6, authToken);

  const { promotions, isLoading: isLoadingPromotions, error: promotionsError } = usePromotions();

  const useMockTiles = import.meta.env.VITE_USE_MOCK_TILES === "true";

  const spots = useMemo(() => {
    if (Array.isArray(spotData) && spotData.length > 0) {
      return spotData;
    }
    return useMockTiles ? mockSpots : [];
  }, [spotData, useMockTiles]);

  const filteredByCategory = useMemo(() => {
    if (categoryFilter === "all") return spots;
    return spots.filter((spot) => spot.category === categoryFilter);
  }, [spots, categoryFilter]);

  const activeTileCategories = useMemo<SpotCategory[] | undefined>(() => {
    if (categoryFilter === "all") return undefined;
    return [categoryFilter];
  }, [categoryFilter]);

  const currentSearch = useMemo(() => {
    const raw = (isSearchOverlayOpen ? searchInput : searchValue) ?? "";
    return raw.trim().toLowerCase();
  }, [isSearchOverlayOpen, searchInput, searchValue]);

  const displaySpots = useMemo(() => {
    if (!currentSearch) return filteredByCategory;
    return filteredByCategory.filter((spot) =>
      spot.title.toLowerCase().includes(currentSearch) || spot.description.toLowerCase().includes(currentSearch)
    );
  }, [filteredByCategory, currentSearch]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const followedIds = new Set(userProfile?.followedUserIds ?? []);
    const knownSpotIds = knownSpotIdsRef.current;
    const notifiedSpotIds = notifiedSpotIdsRef.current;
    const nextKnown = new Set(knownSpotIds);
    const newNotifications: InAppNotification[] = [];

    spots.forEach((spot) => {
      if (!nextKnown.has(spot.id)) {
        nextKnown.add(spot.id);
        if (
          followedIds.has(spot.ownerId) &&
          spot.ownerId !== currentUser.uid &&
          !notifiedSpotIds.has(spot.id)
        ) {
          notifiedSpotIds.add(spot.id);
          newNotifications.push({
            id: `${spot.id}-${Date.now()}`,
            source: "local",
            spot,
            spotId: spot.id,
            message: `${spot.ownerDisplayName ?? spot.ownerId} が「${spot.title}」を投稿しました。`,
            createdAt: new Date().toISOString(),
            priority: "standard",
            docId: null
          });
        }
      }
    });

    knownSpotIdsRef.current = nextKnown;

    if (!notificationsInitializedRef.current) {
      notificationsInitializedRef.current = true;
      return;
    }

    if (newNotifications.length > 0) {
      setNotifications((current) => [...current, ...newNotifications]);
    }
  }, [spots, currentUser, userProfile?.followedUserIds]);

  useEffect(() => {
    if (viewMode === "list" && activeSpot) {
      setActiveSpot(null);
    }
  }, [viewMode, activeSpot]);

  const handleSelectLocation = useCallback((coords: Coordinates) => {
    setSelectedLocation(coords);
    setFocusCoordinates(coords);
  }, []);

  const handleLocationReset = useCallback(() => {
    setSelectedLocation(null);
  }, []);

  const trackSpotView = useCallback(
    (spotId: string | null | undefined) => {
      if (!spotId) return;
      const now = Date.now();
      const lastRecorded = recentViewMapRef.current.get(spotId);
      if (lastRecorded && now - lastRecorded < VIEW_DEBOUNCE_MS) {
        return;
      }
      recentViewMapRef.current.set(spotId, now);
      const sessionId = viewSessionIdRef.current;
      const token = authToken?.trim() ? authToken : undefined;
      void recordSpotView({ spotId, sessionId, authToken: token }).catch((error) => {
        if (import.meta.env.DEV) {
          console.warn("視聴記録の送信に失敗しました", error);
        }
      });
    },
    [authToken]
  );

  const handleSpotViewById = useCallback(
    (spotId: string | null | undefined) => {
      trackSpotView(spotId);
    },
    [trackSpotView]
  );

  const handleSpotViewFromSpot = useCallback(
    (spot: Spot | null | undefined) => {
      if (!spot) return;
      handleSpotViewById(spot.id);
    },
    [handleSpotViewById]
  );

  const handleSpotSelect = useCallback(
    (spot: Spot) => {
      setActiveSpot(spot);
      setFocusCoordinates({ lat: spot.lat, lng: spot.lng });
    },
    []
  );

  const handleMapSpotClick = useCallback(
    (spotId: string) => {
      const match = spots.find((spot) => spot.id === spotId);
      if (match) {
        handleSpotViewFromSpot(match);
        handleSpotSelect(match);
      }
    },
    [handleSpotSelect, handleSpotViewFromSpot, spots]
  );

  const requireAuth = useCallback(() => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return false;
    }
    return true;
  }, [currentUser]);

  const handleSpotAction = useCallback(() => {
    if (!requireAuth()) return;
    navigate("/spots/new");
  }, [navigate, requireAuth]);

  const goToMapViewRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const goToMapView = useCallback(() => goToMapViewRef.current(), []);

  const handleModeToggle = useCallback(() => {
    if (viewMode === "map") {
      applyViewModeToQuery("list");
      return;
    }

    void goToMapView();
  }, [applyViewModeToQuery, goToMapView, viewMode]);

  const handleRefreshSpots = useCallback(async () => {
    trackEvent("spot_feed_refresh", {});
    await mutateSpots();
  }, [mutateSpots]);

  const handleSelectPage = useCallback(
    (page: PageMode) => {
      if (page === "trending") {
        navigate("/spots/trending");
      } else {
        navigate("/spots");
      }
    },
    [navigate]
  );

  const handleLoginClick = useCallback(() => {
    setAuthModalOpen(true);
  }, []);

  const handleCategorySelect = useCallback(
    (key: string) => {
      const categoryKey = key as CategoryKey;
      const applied = selectCategory(categoryKey);
      if (!applied) {
        triggerMessage("このカテゴリは近日公開予定です。");
      }
    },
    [selectCategory, triggerMessage]
  );

  const handleCategoryManagerOpen = useCallback(() => {
    openCategoryManager();
  }, [openCategoryManager]);

  const handleCategoryManagerClose = useCallback(() => {
    closeCategoryManager();
  }, [closeCategoryManager]);

  const handleCategoryDraftToggle = useCallback(
    (key: CategoryKey) => {
      toggleCategoryDraft(key);
    },
    [toggleCategoryDraft]
  );

  const handleCategoryManagerSave = useCallback(() => {
    saveCategoryDraft();
    triggerMessage("カテゴリを更新しました");
  }, [saveCategoryDraft, triggerMessage]);

  const handleSearchToggle = useCallback(() => {
    openSearchOverlay();
  }, [openSearchOverlay]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
    },
    [setSearchInput]
  );

  const applySearch = useCallback(
    (value: string, showMessage = true) => {
      const result = applySearchRaw(value, showMessage);
      if (!showMessage) {
        return;
      }
      if (result.status === "applied" && result.query) {
        triggerMessage(`"${result.query}" の結果を表示します`);
      } else if (result.status === "cleared") {
        triggerMessage("検索条件をクリアしました");
      }
    },
    [applySearchRaw, triggerMessage]
  );

  const handleSpotCreated = useCallback(
    (spot: Spot) => {
      const normalizedSpot: Spot = {
        ...spot,
        likedByViewer: false,
        favoritedByViewer: false,
        ownerDisplayName: spot.ownerDisplayName ?? currentUser?.displayName ?? spot.ownerId,
        ownerPhotoUrl: spot.ownerPhotoUrl ?? currentUser?.photoURL ?? null
      };
      mutateSpots(
        (current) => {
          return current ? [normalizedSpot, ...current] : [normalizedSpot];
        },
        { revalidate: false }
      );
      setSelectedLocation(null);
      handleSpotViewFromSpot(normalizedSpot);
      setActiveSpot(normalizedSpot);
      setFocusCoordinates({ lat: normalizedSpot.lat, lng: normalizedSpot.lng });
      void (async () => {
        await goToMapView();
        navigate("/spots");
      })();
      void mutateSpots();
    },
    [currentUser, goToMapView, handleSpotViewFromSpot, mutateSpots, navigate]
  );

  const handleSpotCreateClose = useCallback(() => {
    navigate("/spots");
    setSelectedLocation(null);
  }, [navigate]);

  const handleShareSpot = useCallback(
    async (spot: Spot) => {
      const shareData = {
        title: spot.title,
        text: `${spot.title} @Shibuya LiveMap`,
        url: `https://shibuya-livemap.example/spots/${spot.id}`
      };
      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareData.url);
          triggerMessage("リンクをコピーしました");
        } else {
          window.open(shareData.url, "_blank");
        }
      } catch (error) {
        console.warn("シェアに失敗しました", error);
        triggerMessage("リンクの共有に失敗しました");
      }
    },
    [triggerMessage]
  );

  const handleLike = useCallback((spotId: string) => {
    if (!requireAuth()) return;

    // Optimistically update the UI
    const updateSpot = (spot: Spot) => {
      if (spot.id === spotId) {
        return {
          ...spot,
          likedByViewer: !spot.likedByViewer,
          likes: spot.likedByViewer ? (spot.likes ?? 1) - 1 : (spot.likes ?? 0) + 1,
        };
      }
      return spot;
    };

    mutateSpots(
      (currentSpots) => {
        if (!currentSpots) return [];
        return currentSpots.map(updateSpot);
      },
      { revalidate: false }
    );

    setActiveSpot(prev => prev ? updateSpot(prev) : null);

    // Here you would also make an API call to persist the like
    // For now, we'll just do the optimistic update.
    // Example:
    // fetch(`/api/spots/${spotId}/like`, {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${authToken}` },
    // }).catch(() => {
    //   // Revert on error
    //   mutateSpots(spots, { revalidate: false });
    // });

  }, [requireAuth, mutateSpots]);

  const handleSheetOverlayToggle = useCallback((open: boolean) => {
    setSheetModalOpen(open);
  }, []);

  const handlePromotionSelect = useCallback(
    async (promotionIdSpotId: string | null | undefined) => {
      if (!promotionIdSpotId) return;
      const existing = spots.find((spot) => spot.id === promotionIdSpotId);
      if (existing) {
        handleSpotViewFromSpot(existing);
        handleSpotSelect(existing);
        navigate("/spots");
        return;
      }
      try {
        const response = await fetch(`/api/spots/${promotionIdSpotId}`, {
          headers: authToken
            ? {
                Authorization: `Bearer ${authToken}`
              }
            : undefined
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch spot: ${response.status}`);
        }
        const spot = (await response.json()) as Spot;
        handleSpotViewFromSpot(spot);
        handleSpotSelect(spot);
        navigate("/spots");
      } catch (error) {
        console.warn("プロモーションからスポットを取得できませんでした", error);
        triggerMessage("イベント詳細を取得できませんでした");
      }
    },
    [authToken, handleSpotSelect, handleSpotViewFromSpot, navigate, spots, triggerMessage]
  );

  const handleLogoClick = useCallback(() => {
    navigate("/spots");
    selectCategory("top");
    applySearchRaw("", false);
    setFocusCoordinates(null);
    void goToMapView();
    triggerMessage("渋谷周辺の最新イベントへ戻りました");
  }, [applySearchRaw, goToMapView, navigate, selectCategory, setFocusCoordinates, triggerMessage]);

  const handleLanguageClick = useCallback(() => {
    triggerMessage("多言語対応は近日公開予定です");
  }, [triggerMessage]);

  const handleUpgradeClick = useCallback(() => {
    if (!currentUser) {
      triggerMessage("設定を開くにはログインしてください");
      setAuthModalOpen(true);
      return;
    }
    setBillingError(null);
    setUpgradeModalOpen(true);
  }, [currentUser, triggerMessage]);

  const handleAdminClick = useCallback(() => {
    if (!currentUser || !authToken || !hasAdminClaim) {
      triggerMessage("審査ツールを開くには管理者としてログインしてください");
      if (!currentUser) {
        setAuthModalOpen(true);
      }
      setNotificationsOpen(false);
      return;
    }
    trackEvent("admin_dashboard_open", {});
    setNotificationsOpen(false);
    setAdminPanelOpen(true);
  }, [authToken, currentUser, hasAdminClaim, triggerMessage]);

  const handleNotificationsClick = useCallback(() => {
    setNotificationsOpen((open) => !open);
  }, []);

  const handleNotificationDismiss = useCallback(
    (notification: InAppNotification) => {
      markNotificationsAsRead([notification]);
      setNotifications((current) => {
        const next = current.filter((item) => item.id !== notification.id);
        if (next.length === 0) {
          setNotificationsOpen(false);
        }
        return next;
      });
    },
    [markNotificationsAsRead]
  );

  const handleNotificationSelect = useCallback(
    (notification: InAppNotification) => {
      markNotificationsAsRead([notification]);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      if (notification.spot) {
        handleSpotViewFromSpot(notification.spot);
        handleSpotSelect(notification.spot);
      } else if (notification.spotId) {
        void handlePromotionSelect(notification.spotId);
      } else {
        triggerMessage("通知を確認しました");
      }
      setNotificationsOpen(false);
    },
    [handlePromotionSelect, handleSpotSelect, handleSpotViewFromSpot, markNotificationsAsRead, triggerMessage]
  );

  const handleNotificationDismissAll = useCallback(() => {
    markNotificationsAsRead(notifications.filter((notification) => notification.source === "remote"));
    setNotifications([]);
    setNotificationsOpen(false);
  }, [markNotificationsAsRead, notifications]);

  const handleAccountPanelOpen = useCallback(() => {
    if (!currentUser) {
      triggerMessage("アカウント情報を確認するにはログインしてください");
      setAuthModalOpen(true);
      return;
    }
    setAccountPanelOpen(true);
  }, [currentUser, triggerMessage]);

  const handleAccountPanelClose = useCallback(() => {
    setAccountPanelOpen(false);
  }, []);

  const handleAccountShare = useCallback(async () => {
    if (!currentUser) {
      triggerMessage("共有するにはログインしてください");
      return;
    }
    if (typeof navigator === "undefined") {
      triggerMessage("この環境では共有できません");
      return;
    }
    const profileUrl = `https://shibuya-livemap.example/users/${currentUser.uid}`;
    const displayName = currentUser.displayName ?? userProfile?.displayName ?? "Spots ユーザー";
    const shareData = {
      title: displayName,
      text: `${displayName} さんのスポット投稿をチェックしよう`,
      url: profileUrl
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(profileUrl);
        triggerMessage("プロフィールリンクをコピーしました");
      } else {
        triggerMessage("共有機能をサポートしていないブラウザです");
      }
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") {
        triggerMessage("共有に失敗しました。再度お試しください");
      }
    }
  }, [currentUser, triggerMessage, userProfile?.displayName]);

  const handleAccountPrivateToggle = useCallback(
    async (next: boolean) => {
      if (!authToken) {
        throw new Error("ログインが必要です。");
      }
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ isPrivateAccount: next })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "プライバシー設定の更新に失敗しました");
      }

      await mutateProfile();
      triggerMessage(next ? "アカウントを非公開に設定しました" : "アカウントを公開に設定しました");
    },
    [authToken, mutateProfile, triggerMessage]
  );

  const handleAccountLogout = useCallback(async () => {
    try {
      await signOut(auth);
      triggerMessage("ログアウトしました");
    } catch (error) {
      const message = error instanceof Error ? error.message : "ログアウトに失敗しました";
      triggerMessage(message);
    }
  }, [triggerMessage]);

  const startCheckout = useCallback(
    async (plan: "tier_b" | "tier_a") => {
      if (!currentUser || !authToken) {
        setUpgradeModalOpen(false);
        setAuthModalOpen(true);
        triggerMessage("ログインしてから再度お試しください");
        return;
      }

      setBillingError(null);
      setBillingLoading(true);
      try {
        const buildReturnUrl = (key: string, value: string) => {
          if (typeof window === "undefined") return undefined;
          const url = new URL(window.location.origin + window.location.pathname);
          url.searchParams.set(key, value);
          return url.toString();
        };

        const successUrl = buildReturnUrl("billing", "success");
        const cancelUrl = buildReturnUrl("billing", "cancel");

        trackEvent("billing_checkout_start", { plan });
        const response = await fetch("/api/billing/create_checkout_session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ plan, successUrl, cancelUrl })
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.message ?? "Checkoutセッションの作成に失敗しました");
        }

        const payload = (await response.json()) as { id: string; url?: string | null };
        if (payload.url) {
          trackEvent("billing_checkout_redirect", { plan });
          window.location.href = payload.url;
          return;
        }

        triggerMessage("Checkout URLが取得できませんでした。Stripeダッシュボードで確認してください");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Checkoutセッションの作成に失敗しました";
        setBillingError(message);
        trackError("billing_checkout_failure", error, { plan });
      } finally {
        setBillingLoading(false);
      }
    },
    [authToken, currentUser, triggerMessage]
  );

  const openBillingPortal = useCallback(async () => {
    if (!currentUser || !authToken) {
      setUpgradeModalOpen(false);
      setAuthModalOpen(true);
      triggerMessage("ログインしてから再度お試しください");
      return;
    }
    if (!stripeCustomerId) {
      triggerMessage("Stripeポータルはまだ利用できません。決済が完了しているか確認してください");
      return;
    }

    setBillingError(null);
    setBillingLoading(true);
    try {
      const portalReturnUrl = (() => {
        if (typeof window === "undefined") return undefined;
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set("portal", "done");
        return url.toString();
      })();

      const response = await fetch("/api/billing/create_portal_session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ returnUrl: portalReturnUrl })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "StripeポータルURLの取得に失敗しました");
      }

      const payload = (await response.json()) as { url?: string | null };
      if (payload.url) {
        trackEvent("billing_portal_open", {});
        window.location.href = payload.url;
        return;
      }

      triggerMessage("ポータルURLが取得できませんでした。管理者にお問い合わせください");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripeポータルの生成に失敗しました";
      setBillingError(message);
      trackError("billing_portal_failure", error, {});
    } finally {
      setBillingLoading(false);
    }
  }, [authToken, currentUser, stripeCustomerId, triggerMessage]);

  const notificationsCount = notifications.length;
  const mySpotCount = useMemo(() => {
    if (!currentUser) return 0;
    return spots.filter((spot) => spot.ownerId === currentUser.uid).length;
  }, [currentUser, spots]);

  const canPostLongTerm = useMemo(() => {
    const tier = userProfile?.posterTier;
    if (!tier) return false;
    return tier === "tier_a" || tier === "tier_b";
  }, [userProfile?.posterTier]);

  const canPostRecurring = useMemo(() => {
    const tier = userProfile?.posterTier;
    return tier === "tier_a";
  }, [userProfile?.posterTier]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ui-language", language);
    }
  }, [language]);

  const normalizedPath = location.pathname.replace(/\/$/, "") || "/";
  const pageMode: PageMode = normalizedPath === "/spots/trending" ? "trending" : "home";
  const isHomePage = pageMode === "home" && normalizedPath === "/spots";
  const isMapHomeView = isHomePage && viewMode === "map";
  const isListModeActive = isHomePage && viewMode === "list";
  const homeMainAriaLabel = viewMode === "map" ? "スポットマップ" : "スポット一覧";

  useEffect(() => {
    const previousCategory = previousCategoryKeyRef.current;

    if (!activeSpot) {
      previousCategoryKeyRef.current = categoryFilter;
      return;
    }

    if (!isMapHomeView || categoryFilter !== previousCategory) {
      setActiveSpot(null);
    }

    previousCategoryKeyRef.current = categoryFilter;
  }, [isMapHomeView, categoryFilter, activeSpot]);

  const spotCreateHeaderActions = currentUser ? (
    <button type="button" className="button secondary" onClick={handleAccountPanelOpen}>
      アカウント
    </button>
  ) : (
    <button type="button" className="button primary" onClick={handleLoginClick}>
      ログイン
    </button>
  );

  const [isListHeaderHidden, setListHeaderHidden] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const previousCategoryKeyRef = useRef(categoryFilter);

  useLayoutMetrics(layoutRootRef, {
    dependencies: [isHomePage, viewMode, isMapHomeView]
  });

  const exitListMode = useCallback(() => {
    setListHeaderHidden(false);
  }, []);

  useEffect(() => {
    goToMapViewRef.current = async () => {
      exitListMode();
      applyViewModeToQuery("map");
    };
  }, [applyViewModeToQuery, exitListMode]);

  useEffect(() => {
    const mainEl = mainRef.current;

    if (!isHomePage) {
      document.body.classList.remove("mode-list");
      if (mainEl) {
        mainEl.style.overflow = "";
        mainEl.style.blockSize = "";
        mainEl.style.minBlockSize = "";
      }
      return () => {
        document.body.classList.remove("mode-list");
      };
    }

    if (viewMode === "list") {
      document.body.classList.add("mode-list");
      if (mainEl) {
        mainEl.style.overflow = "visible";
        mainEl.style.blockSize = "auto";
        mainEl.style.minBlockSize = "auto";
      }
    } else {
      document.body.classList.remove("mode-list");
      if (mainEl) {
        mainEl.style.overflow = "";
        mainEl.style.blockSize = "";
        mainEl.style.minBlockSize = "";
      }
    }

    return () => {
      if (viewMode === "list") {
        document.body.classList.remove("mode-list");
      }
    };
  }, [isHomePage, viewMode]);

  useEffect(() => {
    if (!isListModeActive) {
      setListHeaderHidden(false);
      return;
    }

    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    let ticking = false;

    const update = () => {
      ticking = false;
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY;

      if (currentY <= 24) {
        setListHeaderHidden(false);
      } else if (delta > 6) {
        setListHeaderHidden(true);
      } else if (delta < -6) {
        setListHeaderHidden(false);
      }

      lastScrollY = currentY;
    };

    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isListModeActive]);
  const mainLayout = (
    <div className="app-shell">
      <SidebarNav
        currentUser={currentUser}
        notificationsCount={notificationsCount}
        pageMode={pageMode}
        viewMode={viewMode}
        onLogoClick={handleLogoClick}
        onSpotClick={handleSpotAction}
        onLoginClick={handleLoginClick}
        onSelectPage={handleSelectPage}
        onModeToggle={handleModeToggle}
        onRefreshClick={handleRefreshSpots}
        onLanguageClick={handleLanguageClick}
        onAccountClick={handleAccountPanelOpen}
        onNotificationsClick={handleNotificationsClick}
        showAdminButton={hasAdminClaim}
        onAdminClick={handleAdminClick}
      />
      <div
        ref={layoutRootRef}
        className={[
          "layout-column",
          isMapHomeView ? "map-view" : "",
          isListModeActive ? "list-mode" : "",
          isListModeActive && isListHeaderHidden ? "list-header-hidden" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <HeaderBar
          currentUser={currentUser}
          notificationsCount={notificationsCount}
          onLogoClick={handleLogoClick}
          onLoginClick={handleLoginClick}
          onNotificationsClick={handleNotificationsClick}
          onAccountClick={handleAccountPanelOpen}
          language={language}
          onLanguageChange={setLanguage}
        />
        {isHomePage ? (
          <CategoryTabs
            options={categoryOptions}
            activeKey={activeCategoryKey}
            onSelect={handleCategorySelect}
            onSearchToggle={handleSearchToggle}
            onManageCategories={handleCategoryManagerOpen}
          />
        ) : (
          <div className="category-spacer" aria-hidden="true" />
        )}
        {isHomePage ? (
          <main
            ref={mainRef}
            className={`app-main content-area ${viewMode}`.trim()}
            aria-label={homeMainAriaLabel}
          >
          {viewMode === "map" ? (
            <MapView
              initialView={DEFAULT_HOME_VIEW}
              spots={displaySpots}
              selectedLocation={selectedLocation}
              onSelectLocation={handleSelectLocation}
              focusCoordinates={focusCoordinates}
              onSpotClick={handleMapSpotClick}
              onSpotView={handleSpotViewById}
              tileCategories={activeTileCategories}
              authToken={authToken}
            />
          ) : (
            <>
              <SpotListView
                spots={displaySpots}
                isLoading={isLoadingSpots}
                error={spotError}
                onSpotSelect={handleSpotSelect}
                onSpotView={handleSpotViewFromSpot}
              />
              {MOBILE_SCROLL_FOOTER}
            </>
          )}
          </main>
        ) : (
          <main className="app-main content-area trending" aria-label="トレンドとプロモーション">
            <div className="trending-content">
              <header className="trending-header">
                <h2>トレンド & プロモーション</h2>
                <p className="hint">注目のイベントと公式告知をまとめて確認できます。</p>
              </header>
              {promotionsError ? (
                <div className="panel error">公式告知の取得に失敗しました。</div>
              ) : isLoadingPromotions ? (
                <div className="panel">公式告知を読み込み中...</div>
              ) : (
                <PromotionBanner promotions={promotions} onSelect={(promotion) => handlePromotionSelect(promotion.spotId)} />
              )}
              <PopularSpotsPanel
                spots={popularSpots}
                isLoading={isLoadingPopularSpots}
                error={popularError}
                onSpotSelect={handleSpotSelect}
                onSpotView={handleSpotViewFromSpot}
              />
            </div>
            {MOBILE_SCROLL_FOOTER}
          </main>
        )}
        <ActionBar
          pageMode={pageMode}
          viewMode={viewMode}
          onSpotClick={handleSpotAction}
          onSelectPage={handleSelectPage}
          onModeToggle={handleModeToggle}
        />
      </div>
    </div>
  );

  const spotCreateLayout = (
    <SpotCreatePage
      selectedLocation={selectedLocation}
      onSelectLocation={handleSelectLocation}
      onLocationReset={handleLocationReset}
      onCreated={handleSpotCreated}
      onCancel={handleSpotCreateClose}
      authToken={authToken}
      canPostLongTerm={canPostLongTerm}
      canPostRecurring={canPostRecurring}
      headerActions={spotCreateHeaderActions}
      profile={userProfile ?? null}
      onProfileRefresh={scheduleProfileRefresh}
    />
  );

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/spots" replace />} />
        <Route path="/spots" element={mainLayout} />
        <Route path="/spots/trending" element={mainLayout} />
        <Route path="/spots/new" element={spotCreateLayout} />
        <Route path="*" element={<Navigate to="/spots" replace />} />
      </Routes>

      <div className={`floating-panel admin-panel ${isAdminPanelOpen ? "open" : ""}`.trim()} role="dialog" aria-hidden={!isAdminPanelOpen}>
        <div className="floating-scrim" aria-hidden="true" onClick={() => setAdminPanelOpen(false)} />
        <section className="floating-body">
          {hasAdminClaim && authToken ? (
            <AdminDashboard authToken={authToken} onClose={() => setAdminPanelOpen(false)} />
          ) : (
            <div className="panel">管理者権限がないか、ログインが必要です。</div>
          )}
        </section>
      </div>

      <AccountPanel
        isOpen={isAccountPanelOpen}
        user={currentUser}
        profile={userProfile ?? null}
        spotCount={mySpotCount}
        authToken={authToken}
        onClose={handleAccountPanelClose}
        onShare={handleAccountShare}
        onUpgrade={handleUpgradeClick}
        onLogout={handleAccountLogout}
        onPrivateToggle={handleAccountPrivateToggle}
        onProfileRefresh={() => {
          void mutateProfile();
        }}
      />

      <div className={`auth-modal ${isAuthModalOpen ? "open" : ""}`.trim()} role="dialog" aria-hidden={!isAuthModalOpen}>
        <div className="modal-scrim" aria-hidden="true" onClick={() => setAuthModalOpen(false)} />
        <div className="modal-body">
          <button
            type="button"
            className="icon-button modal-close"
            aria-label="閉じる"
            onClick={() => setAuthModalOpen(false)}
          >
            ✕
          </button>
          <Suspense fallback={<div className="panel">認証フォームを読み込み中...</div>}>
            <AuthPanel user={currentUser} />
          </Suspense>
        </div>
      </div>

      <div
        className={`category-modal ${isCategoryManagerOpen ? "open" : ""}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-hidden={!isCategoryManagerOpen}
      >
        <div className="modal-scrim" aria-hidden="true" onClick={handleCategoryManagerClose} />
        <div className="modal-body">
          <section className="panel category-manager">
            <header className="floating-header">
              <h2>カテゴリをカスタマイズ</h2>
              <button type="button" className="icon-button" aria-label="閉じる" onClick={handleCategoryManagerClose}>
                ✕
              </button>
            </header>
            <p className="hint">表示するカテゴリを選択してください（トップは常に表示されます）。</p>
            <ul className="category-option-list">
              {availableCategoryOptions.map(({ key, label, color }) => {
                const checked = categoryDraftKeys.includes(key);
                const disabled = key === "top";
                return (
                  <li key={key}>
                    <label className="category-option">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleCategoryDraftToggle(key)}
                        disabled={disabled}
                      />
                      <span
                        className="category-option-chip"
                        data-active={checked ? "true" : "false"}
                        style={{ borderColor: color, backgroundColor: checked ? `${color}1A` : undefined }}
                      >
                        {label}
                        {disabled ? <span className="category-option-note">固定</span> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="category-manager-actions">
              <button type="button" className="button subtle" onClick={handleCategoryManagerClose}>
                キャンセル
              </button>
              <button type="button" className="button primary" onClick={handleCategoryManagerSave}>
                保存
              </button>
            </div>
          </section>
        </div>
      </div>

      <div
        className={`auth-modal billing-modal ${isUpgradeModalOpen ? "open" : ""}`.trim()}
        role="dialog"
        aria-hidden={!isUpgradeModalOpen}
      >
        <div className="modal-scrim" aria-hidden="true" onClick={() => setUpgradeModalOpen(false)} />
        <div className="modal-body">
          <section className="panel">
            <header className="floating-header">
              <h2>プランをアップグレード</h2>
              <button type="button" className="icon-button" aria-label="閉じる" onClick={() => setUpgradeModalOpen(false)}>
                ✕
              </button>
            </header>
            <p className="hint">
              現在のTier: {userProfile?.posterTier.toUpperCase() ?? "TIER_C"}。Stripe Checkoutに遷移します。
            </p>
            <section>
              <h3>ご利用前にお読みください</h3>
              <p className="hint">• ご請求はStripeを通じて安全に処理され、プラン変更やキャンセルはStripeポータルからいつでも行えます。</p>
              <p className="hint">• クォータは決済完了後すぐに反映されますが、最大で数分ほど更新に時間がかかる場合があります。</p>
              <p className="hint">
                • 詳しい説明とトラブルシュートは <a href={BILLING_FAQ_PATH} target="_blank" rel="noreferrer">Billing FAQ</a> をご確認ください。
                不明点や返金のご相談は <a href={supportMailto}>サポート窓口 ({SUPPORT_EMAIL})</a> までご連絡ください。
              </p>
            </section>
            <div className="form-group">
              <button
                type="button"
                className="button primary"
                disabled={isBillingLoading}
                onClick={() => startCheckout("tier_b")}
              >
                クリエイタープラン (Tier B)
              </button>
              <p className="hint">短期告知の予約枠が拡張され、フォロワー向け機能が強化されます。</p>
            </div>
            <div className="form-group">
              <button
                type="button"
                className="button primary"
                disabled={isBillingLoading}
                onClick={() => startCheckout("tier_a")}
              >
                スポンサー (Tier A)
              </button>
              <p className="hint">長期キャンペーン、公式バナー掲載、優先審査などが利用可能になります。</p>
            </div>
            <div className="form-group quota-summary">
              <h3>現在のクォータ</h3>
              <dl>
                <div>
                  <dt>短期告知 (7日):</dt>
                  <dd>{promotionQuotaSummary.shortTerm ?? "―"} 件</dd>
                </div>
                <div>
                  <dt>長期キャンペーン (30日):</dt>
                  <dd>{promotionQuotaSummary.longTerm ?? "―"} 件</dd>
                </div>
                <div>
                  <dt>最終更新:</dt>
                  <dd>{promotionQuotaUpdatedLabel}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="button subtle"
                onClick={handleQuotaRefreshClick}
                disabled={isProfileLoading || isBillingLoading}
              >
                クォータを再取得
              </button>
              <p className="hint">更新が反映されない場合は数分後に再取得してください。</p>
            </div>
            {stripeCustomerId ? (
              <div className="form-group">
                <button
                  type="button"
                  className="button secondary"
                  disabled={isBillingLoading}
                  onClick={() => void openBillingPortal()}
                >
                  Stripeポータルを開く
                </button>
                <p className="hint">支払い情報や請求履歴の確認、プランのキャンセル/復旧が行えます。</p>
              </div>
            ) : null}
            {billingError ? (
              <div className="status error">
                <p>{billingError}</p>
                <p className="hint">
                  解決しない場合は <a href={supportMailto}>サポート窓口 ({SUPPORT_EMAIL})</a> にお問い合わせください。
                </p>
              </div>
            ) : null}
            {isBillingLoading ? <p className="status">Stripe Checkout を準備しています...</p> : null}
          </section>
        </div>
      </div>

      {isMapHomeView ? (
        <SpotDetailSheet
          spot={activeSpot}
          isOpen={Boolean(activeSpot)}
          onClose={() => setActiveSpot(null)}
          onLike={handleLike}
          onShare={handleShareSpot}
          onOverlayToggle={handleSheetOverlayToggle}
          authToken={authToken}
          onReportFeedback={triggerMessage}
        />
      ) : null}

      <InAppNotifications
        notifications={notifications}
        onSelect={handleNotificationSelect}
      isOpen={isNotificationsOpen}
      hasAdminAccess={hasAdminClaim}
      onDismiss={handleNotificationDismiss}
      onDismissAll={handleNotificationDismissAll}
      onAdminClick={handleAdminClick}
      onClose={() => setNotificationsOpen(false)}
      />

      <SearchOverlay
        isOpen={isSearchOverlayOpen}
        query={searchInput}
        history={recentSearches}
        onChange={handleSearchChange}
        onSubmit={(value) => applySearch(value, true)}
        onSelectQuery={(value) => applySearch(value, true)}
        onClose={closeSearchOverlay}
      />

      {appMessage ? <div className="app-toast">{appMessage}</div> : null}
    </>
  );
}

export default App;
