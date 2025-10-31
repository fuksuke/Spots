import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { InAppNotification, InAppNotifications } from "./components/InAppNotifications";
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
import { auth, db } from "./lib/firebase";
import { Coordinates, Spot, SpotCategory, ViewMode, PageMode } from "./types";

const AuthPanel = lazy(() => import("./components/AuthPanel").then((module) => ({ default: module.AuthPanel })));

type CategoryKey =
  | "top"
  | "coupon"
  | "entertainment"
  | "sports"
  | "gourmet"
  | "live"
  | "art"
  | "family"
  | "nightlife"
  | "shopping";

type CategoryConfig = {
  label: string;
  color: string;
  spotCategory: SpotCategory | "all";
};

const CATEGORY_CONFIG: Record<CategoryKey, CategoryConfig> = {
  top: { label: "トップ", color: "#0ea5e9", spotCategory: "all" },
  gourmet: { label: "グルメ", color: "#f97316", spotCategory: "cafe" },
  entertainment: { label: "エンタメ", color: "#f59e0b", spotCategory: "event" },
  sports: { label: "スポーツ", color: "#22d3ee", spotCategory: "sports" },
  coupon: { label: "クーポン", color: "#6366f1", spotCategory: "coupon" },
  live: { label: "ライブ", color: "#ef4444", spotCategory: "live" },
  art: { label: "アート", color: "#a855f7", spotCategory: "event" },
  family: { label: "ファミリー", color: "#14b8a6", spotCategory: "event" },
  nightlife: { label: "ナイトライフ", color: "#1d4ed8", spotCategory: "live" },
  shopping: { label: "ショッピング", color: "#f59e0b", spotCategory: "coupon" }
};

const INITIAL_CATEGORY_KEYS: CategoryKey[] = ["top", "gourmet", "entertainment", "sports", "coupon", "live"];
const CATEGORY_DISPLAY_ORDER: CategoryKey[] = [...INITIAL_CATEGORY_KEYS, "art", "family", "nightlife", "shopping"];
const CATEGORY_STORAGE_KEY = "category-tabs:v1";
type AppRoute = "main" | "create-spot";
const CREATE_ROUTE_PATH = "/create";

const resolveRouteFromPath = (path: string): AppRoute => (path === CREATE_ROUTE_PATH ? "create-spot" : "main");

const DEFAULT_HOME_VIEW: MapViewProps['initialView'] = {
  longitude: 139.7016,
  latitude: 35.6595,
  zoom: 14
};

const isCategoryKey = (value: unknown): value is CategoryKey =>
  typeof value === "string" && CATEGORY_DISPLAY_ORDER.includes(value as CategoryKey);

const normalizeCategoryKeys = (keys: CategoryKey[]): CategoryKey[] => {
  const allowedKeys = new Set(CATEGORY_DISPLAY_ORDER);
  const uniqueKeys: CategoryKey[] = [];
  keys.forEach((key) => {
    if (allowedKeys.has(key) && !uniqueKeys.includes(key)) {
      uniqueKeys.push(key);
    }
  });
  if (!uniqueKeys.includes("top")) {
    uniqueKeys.unshift("top");
  }
  const ordered = CATEGORY_DISPLAY_ORDER.filter((key) => uniqueKeys.includes(key));
  return ordered.length > 0 ? ordered : INITIAL_CATEGORY_KEYS;
};

const loadStoredCategoryKeys = (): CategoryKey[] => {
  if (typeof window === "undefined") {
    return INITIAL_CATEGORY_KEYS;
  }
  try {
    const raw = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!raw) {
      return INITIAL_CATEGORY_KEYS;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return INITIAL_CATEGORY_KEYS;
    }
    const filtered = parsed.filter((item): item is CategoryKey => isCategoryKey(item));
    if (filtered.length === 0) {
      return INITIAL_CATEGORY_KEYS;
    }
    return normalizeCategoryKeys(filtered as CategoryKey[]);
  } catch (error) {
    console.warn("Failed to load stored category tabs", error);
    return INITIAL_CATEGORY_KEYS;
  }
};

const persistCategoryKeys = (keys: CategoryKey[]) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(keys));
  } catch (error) {
    console.warn("Failed to persist category tabs", error);
  }
};

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
const BILLING_FAQ_PATH = "/billing-faq.html";

const mapCategoryKeyToSpotCategory = (key: CategoryKey): SpotCategory | "all" | null => {
  const config = CATEGORY_CONFIG[key];
  return config?.spotCategory ?? null;
};

const getCategoryKeyForSpot = (spot: Spot): CategoryKey => {
  switch (spot.category) {
    case "coupon":
      return "coupon";
    case "event":
      return "entertainment";
    case "sports":
      return "sports";
    case "cafe":
      return "gourmet";
    case "live":
    default:
      return "live";
  }
};

function App() {
  const initialCategoryKeys = useMemo(() => loadStoredCategoryKeys(), []);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [pageMode, setPageMode] = useState<PageMode>("home");
  const [categoryKeys, setCategoryKeys] = useState<CategoryKey[]>(initialCategoryKeys);
  const [activeCategoryKey, setActiveCategoryKey] = useState<CategoryKey>(initialCategoryKeys[0] ?? "top");
  const [categoryFilter, setCategoryFilter] = useState<SpotCategory | "all">(
    mapCategoryKeyToSpotCategory(initialCategoryKeys[0] ?? "top") ?? "all"
  );
  const categoryOptions = useMemo(
    () => categoryKeys.map((key) => ({ key, label: CATEGORY_CONFIG[key].label, color: CATEGORY_CONFIG[key].color })),
    [categoryKeys]
  );
  const availableCategoryOptions = useMemo(
    () => CATEGORY_DISPLAY_ORDER.map((key) => ({ key, label: CATEGORY_CONFIG[key].label, color: CATEGORY_CONFIG[key].color })),
    []
  );
  const [isCategoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [categoryDraftKeys, setCategoryDraftKeys] = useState<CategoryKey[]>(initialCategoryKeys);

  useEffect(() => {
    persistCategoryKeys(categoryKeys);
  }, [categoryKeys]);

  useEffect(() => {
    setCategoryDraftKeys(categoryKeys);
  }, [categoryKeys]);
  const [searchValue, setSearchValue] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isSearchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("search-history");
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? (parsed.filter((item) => typeof item === "string") as string[]) : [];
    } catch {
      return [];
    }
  });
  const initialRoute = useMemo(() => {
    if (typeof window === "undefined") return "main";
    return resolveRouteFromPath(window.location.pathname);
  }, []);
  const [appRoute, setAppRoute] = useState<AppRoute>(initialRoute);
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
  const profileRefreshTimeoutRef = useRef<number | null>(null);
  const supportMailto = `mailto:${SUPPORT_EMAIL}`;

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

  const navigateToRoute = useCallback(
    (route: AppRoute, { replace = false }: { replace?: boolean } = {}) => {
      if (typeof window === "undefined") {
        setAppRoute(route);
        return;
      }
      const targetPath = route === "create-spot" ? CREATE_ROUTE_PATH : "/";
      const currentPath = window.location.pathname;
      if (currentPath === targetPath) {
        setAppRoute(route);
        return;
      }
      if (replace) {
        window.history.replaceState({ route: targetPath }, "", targetPath);
      } else {
        window.history.pushState({ route: targetPath }, "", targetPath);
      }
      setAppRoute(route);
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      setAppRoute(resolveRouteFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const params = url.searchParams;

    let didUpdate = false;
    let shouldRefreshProfile = false;

    const billingStatus = params.get("billing");
    if (billingStatus) {
      didUpdate = true;
      switch (billingStatus) {
        case "success": {
          triggerMessage("決済が完了しました。設定を更新しています。");
          trackEvent("billing_checkout_complete", {});
          shouldRefreshProfile = true;
          break;
        }
        case "cancel": {
          triggerMessage("Checkoutをキャンセルしました。");
          trackEvent("billing_checkout_cancel", {});
          break;
        }
        case "error": {
          triggerMessage("決済処理でエラーが発生しました。時間をおいて再度お試しください。");
          trackEvent("billing_checkout_error", { result: billingStatus });
          break;
        }
        default: {
          triggerMessage("決済状況を確認できませんでした。");
          trackEvent("billing_checkout_unknown", { result: billingStatus });
        }
      }
      params.delete("billing");
    }

    const portalStatus = params.get("portal");
    if (portalStatus) {
      didUpdate = true;
      if (portalStatus === "done") {
        triggerMessage("Stripeポータルからの変更を反映します。");
        shouldRefreshProfile = true;
      } else {
        triggerMessage("Stripeポータルの処理で問題が発生しました。");
      }
      trackEvent("billing_portal_return", { status: portalStatus });
      params.delete("portal");
    }

    if (shouldRefreshProfile) {
      scheduleProfileRefresh();
    }

    if (didUpdate) {
      const nextSearch = params.toString();
      const newUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [scheduleProfileRefresh, triggerMessage]);

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

  const spots = useMemo(() => spotData ?? [], [spotData]);

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

  const handleSelectLocation = useCallback((coords: Coordinates) => {
    setSelectedLocation(coords);
    setFocusCoordinates(coords);
  }, []);

  const handleLocationReset = useCallback(() => {
    setSelectedLocation(null);
  }, []);

  const handleSpotSelect = useCallback(
    (spot: Spot) => {
      setActiveSpot(spot);
      setFocusCoordinates({ lat: spot.lat, lng: spot.lng });
      if (viewMode === "list") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      const derivedKey = getCategoryKeyForSpot(spot);
      const fallbackKey = categoryKeys.includes(derivedKey)
        ? derivedKey
        : categoryKeys.find((key) => {
            const mappedCategory = mapCategoryKeyToSpotCategory(key);
            if (mappedCategory === "all" || mappedCategory === null) {
              return false;
            }
            return mappedCategory === spot.category;
          }) ?? (categoryKeys[0] ?? "top");
      setActiveCategoryKey(fallbackKey);
      const mapped = mapCategoryKeyToSpotCategory(fallbackKey);
      if (mapped) {
        setCategoryFilter(mapped);
      }
    },
    [viewMode, categoryKeys]
  );

  const handleMapSpotClick = useCallback(
    (spotId: string) => {
      const match = spots.find((spot) => spot.id === spotId);
      if (match) {
        handleSpotSelect(match);
      }
    },
    [spots, handleSpotSelect]
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
    navigateToRoute("create-spot");
  }, [requireAuth, navigateToRoute]);

  const handleModeToggle = useCallback(() => {
    setViewMode((prev) => (prev === "map" ? "list" : "map"));
  }, []);

  const handleRefreshSpots = useCallback(async () => {
    trackEvent("spot_feed_refresh", {});
    await mutateSpots();
  }, [mutateSpots]);

  const handleSelectPage = useCallback(
    (page: PageMode) => {
      navigateToRoute("main");
      setPageMode(page);
      if (page === "home") {
        setViewMode((prev) => prev);
      }
    },
    [navigateToRoute]
  );

  const handleLoginClick = useCallback(() => {
    setAuthModalOpen(true);
  }, []);

  const handleCategorySelect = useCallback(
    (key: string) => {
      const categoryKey = key as CategoryKey;
      if (!categoryKeys.includes(categoryKey)) {
        triggerMessage("このカテゴリは近日公開予定です。");
        return;
      }
      setActiveCategoryKey(categoryKey);
      const mapped = mapCategoryKeyToSpotCategory(categoryKey);
      if (mapped) {
        setCategoryFilter(mapped);
        return;
      }
      triggerMessage("このカテゴリは近日公開予定です。");
    },
    [categoryKeys, triggerMessage]
  );

  const handleCategoryManagerOpen = useCallback(() => {
    setCategoryDraftKeys(categoryKeys);
    setCategoryManagerOpen(true);
  }, [categoryKeys]);

  const handleCategoryManagerClose = useCallback(() => {
    setCategoryManagerOpen(false);
  }, []);

  const handleCategoryDraftToggle = useCallback((key: CategoryKey) => {
    if (key === "top") {
      return;
    }
    setCategoryDraftKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }, []);

  const handleCategoryManagerSave = useCallback(() => {
    const normalized = normalizeCategoryKeys(categoryDraftKeys);
    setCategoryKeys(normalized);
    setCategoryDraftKeys(normalized);
    if (!normalized.includes(activeCategoryKey)) {
      const fallbackKey = normalized[0] ?? "top";
      setActiveCategoryKey(fallbackKey);
      setCategoryFilter(mapCategoryKeyToSpotCategory(fallbackKey) ?? "all");
    }
    setCategoryManagerOpen(false);
    triggerMessage("カテゴリを更新しました");
  }, [categoryDraftKeys, activeCategoryKey, triggerMessage]);

  const handleSearchToggle = useCallback(() => {
    setSearchOverlayOpen(true);
    setSearchInput(searchValue);
  }, [searchValue]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const closeSearchOverlay = useCallback(() => {
    setSearchOverlayOpen(false);
    setSearchInput(searchValue);
  }, [searchValue]);

  const persistRecentSearches = useCallback((entries: string[]) => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("search-history", JSON.stringify(entries));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const applySearch = useCallback(
    (value: string, showMessage = true) => {
      const trimmed = value.trim();
      setSearchInput(trimmed);
      setSearchValue(trimmed);
      setSearchOverlayOpen(false);
      if (trimmed) {
        setRecentSearches((current) => {
          const next = [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, 8);
          persistRecentSearches(next);
          return next;
        });
        if (showMessage) {
          triggerMessage(`"${trimmed}" の結果を表示します`);
        }
      } else if (showMessage && searchValue) {
        triggerMessage("検索条件をクリアしました");
      }
    },
    [persistRecentSearches, searchValue, triggerMessage]
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
      setActiveSpot(normalizedSpot);
      setFocusCoordinates({ lat: normalizedSpot.lat, lng: normalizedSpot.lng });
      setViewMode("map");
      navigateToRoute("main");
      void mutateSpots();
    },
    [currentUser, mutateSpots, navigateToRoute]
  );

  const handleSpotCreateClose = useCallback(() => {
    navigateToRoute("main");
    setSelectedLocation(null);
  }, [navigateToRoute]);

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

  const handleNotify = useCallback(
    (spot: Spot) => {
      if (!requireAuth()) return;
      triggerMessage(`「${spot.title}」の通知をオンにしました (仮)`);
    },
    [requireAuth, triggerMessage]
  );

  const handlePromotionSelect = useCallback(
    async (promotionIdSpotId: string | null | undefined) => {
      if (!promotionIdSpotId) return;
      const existing = spots.find((spot) => spot.id === promotionIdSpotId);
      if (existing) {
        handleSpotSelect(existing);
        setPageMode("home");
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
        handleSpotSelect(spot);
        setPageMode("home");
      } catch (error) {
        console.warn("プロモーションからスポットを取得できませんでした", error);
        triggerMessage("イベント詳細を取得できませんでした");
      }
    },
    [authToken, handleSpotSelect, spots, triggerMessage]
  );

  const handleLogoClick = useCallback(() => {
    navigateToRoute("main");
    setActiveCategoryKey("top");
    setCategoryFilter("all");
    setSearchValue("");
    setSearchInput("");
    setFocusCoordinates(null);
    setViewMode("map");
    setPageMode("home");
    triggerMessage("渋谷周辺の最新イベントへ戻りました");
  }, [navigateToRoute, triggerMessage]);

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
      return;
    }
    trackEvent("admin_dashboard_open", {});
    setAdminPanelOpen(true);
  }, [authToken, currentUser, hasAdminClaim, triggerMessage]);

  const handleNotificationsClick = useCallback(() => {
    if (notifications.length === 0) {
      triggerMessage("新しい通知はありません");
    } else {
      markNotificationsAsRead(notifications.filter((notification) => notification.source === "remote"));
      setNotifications([]);
      triggerMessage("通知をクリアしました");
    }
  }, [markNotificationsAsRead, notifications, triggerMessage]);

  const handleNotificationDismiss = useCallback(
    (notification: InAppNotification) => {
      markNotificationsAsRead([notification]);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
    },
    [markNotificationsAsRead]
  );

  const handleNotificationSelect = useCallback(
    (notification: InAppNotification) => {
      markNotificationsAsRead([notification]);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      if (notification.spot) {
        handleSpotSelect(notification.spot);
      } else if (notification.spotId) {
        void handlePromotionSelect(notification.spotId);
      } else {
        triggerMessage("通知を確認しました");
      }
    },
    [handlePromotionSelect, handleSpotSelect, markNotificationsAsRead, triggerMessage]
  );

  const handleNotificationDismissAll = useCallback(() => {
    markNotificationsAsRead(notifications.filter((notification) => notification.source === "remote"));
    setNotifications([]);
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

  const updateSpotLocally = useCallback(
    (spotId: string, updates: Partial<Spot>) => {
      void mutateSpots(
        (current) => {
          if (!current) return current;
          return current.map((item) => (item.id === spotId ? { ...item, ...updates } : item));
        },
        { revalidate: false }
      );
      setActiveSpot((current) => (current && current.id === spotId ? { ...current, ...updates } : current));
    },
    [mutateSpots]
  );

  const revalidateSpots = useCallback(() => {
    void mutateSpots();
  }, [mutateSpots]);

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

  const isHomePage = pageMode === "home";
  const isMapHomeView = isHomePage && viewMode === "map";
  const spotCreateHeaderActions = currentUser ? (
    <button type="button" className="button secondary" onClick={handleAccountPanelOpen}>
      アカウント
    </button>
  ) : (
    <button type="button" className="button primary" onClick={handleLoginClick}>
      ログイン
    </button>
  );

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
      <div className={`layout-column ${isMapHomeView ? "map-view" : ""}`.trim()}>
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
          <div className={`content-area ${viewMode}`.trim()}>
            {viewMode === "map" ? (
              <MapView
                initialView={DEFAULT_HOME_VIEW}
                spots={displaySpots}
                selectedLocation={selectedLocation}
                onSelectLocation={handleSelectLocation}
                focusCoordinates={focusCoordinates}
                onSpotClick={handleMapSpotClick}
                tileCategories={activeTileCategories}
                authToken={authToken}
              />
            ) : (
              <SpotListView
                spots={displaySpots}
                isLoading={isLoadingSpots}
                error={spotError}
                onSpotSelect={handleSpotSelect}
              />
            )}
          </div>
        ) : (
          <div className="content-area trending">
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
              />
            </div>
          </div>
        )}
        <footer className="app-footer mobile-only">
          <span>© 2025 MyApp</span>
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms of Use</a>
          <a href={BILLING_FAQ_PATH} target="_blank" rel="noreferrer">
            Billing FAQ
          </a>
        </footer>
        <ActionBar
          pageMode={pageMode}
          viewMode={viewMode}
          onSpotClick={handleSpotAction}
          onSelectPage={handleSelectPage}
          onModeToggle={handleModeToggle}
          onRefresh={handleRefreshSpots}
          showAdmin={hasAdminClaim}
          onAdminClick={handleAdminClick}
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
      {appRoute === "create-spot" ? spotCreateLayout : mainLayout}

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

      <SpotDetailSheet
        spot={activeSpot}
        isOpen={Boolean(activeSpot)}
        authToken={authToken}
        currentUser={currentUser}
        onClose={() => setActiveSpot(null)}
        onNotify={handleNotify}
        onShare={handleShareSpot}
        onSpotUpdated={updateSpotLocally}
        onProfileMutate={() => {
          void mutateProfile();
        }}
        onRequireAuth={() => {
          setAuthModalOpen(true);
        }}
        onRevalidateSpots={revalidateSpots}
        onFeedback={triggerMessage}
      />

      <InAppNotifications
        notifications={notifications}
        onSelect={handleNotificationSelect}
        onDismiss={handleNotificationDismiss}
        onDismissAll={handleNotificationDismissAll}
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
