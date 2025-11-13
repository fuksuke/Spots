import { useCallback, useEffect, useMemo, useState } from "react";

import type { SpotCategory } from "../types";
import {
  CATEGORY_CONFIG,
  CATEGORY_DISPLAY_ORDER,
  CategoryKey,
  loadStoredCategoryKeys,
  mapCategoryKeyToSpotCategory,
  normalizeCategoryKeys,
  persistCategoryKeys
} from "../lib/categories";

type UseCategoryTabsOptions = {
  onCategoryUnavailable?: (key: CategoryKey) => void;
};

type CategoryOption = {
  key: CategoryKey;
  label: string;
  color: string;
};

type CategoryDraftToggle = (key: CategoryKey) => void;

type SaveResult = {
  appliedKeys: CategoryKey[];
  activeKey: CategoryKey;
};

export const useCategoryTabs = ({ onCategoryUnavailable }: UseCategoryTabsOptions = {}) => {
  const initialKeys = useMemo(() => loadStoredCategoryKeys(), []);
  const [categoryKeys, setCategoryKeys] = useState<CategoryKey[]>(initialKeys);
  const [activeCategoryKey, setActiveCategoryKey] = useState<CategoryKey>(initialKeys[0] ?? "top");
  const [categoryFilter, setCategoryFilter] = useState<SpotCategory | "all">(
    mapCategoryKeyToSpotCategory(initialKeys[0] ?? "top") ?? "all"
  );
  const [categoryDraftKeys, setCategoryDraftKeys] = useState<CategoryKey[]>(initialKeys);
  const [isCategoryManagerOpen, setCategoryManagerOpen] = useState(false);

  useEffect(() => {
    persistCategoryKeys(categoryKeys);
  }, [categoryKeys]);

  const categoryOptions: CategoryOption[] = useMemo(
    () => categoryKeys.map((key) => ({ key, label: CATEGORY_CONFIG[key].label, color: CATEGORY_CONFIG[key].color })),
    [categoryKeys]
  );

  const availableCategoryOptions: CategoryOption[] = useMemo(
    () => CATEGORY_DISPLAY_ORDER.map((key) => ({ key, label: CATEGORY_CONFIG[key].label, color: CATEGORY_CONFIG[key].color })),
    []
  );

  const selectCategory = useCallback(
    (key: CategoryKey): boolean => {
      if (!categoryKeys.includes(key)) {
        onCategoryUnavailable?.(key);
        return false;
      }
      const mapped = mapCategoryKeyToSpotCategory(key);
      if (!mapped) {
        onCategoryUnavailable?.(key);
        return false;
      }
      setActiveCategoryKey(key);
      setCategoryFilter(mapped);
      return true;
    },
    [categoryKeys, onCategoryUnavailable]
  );

  const openCategoryManager = useCallback(() => {
    setCategoryDraftKeys(categoryKeys);
    setCategoryManagerOpen(true);
  }, [categoryKeys]);

  const closeCategoryManager = useCallback(() => {
    setCategoryManagerOpen(false);
  }, []);

  const toggleCategoryDraft: CategoryDraftToggle = useCallback((key) => {
    if (key === "top") {
      return;
    }
    setCategoryDraftKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }, []);

  const saveCategoryDraft = useCallback((): SaveResult => {
    const normalized = normalizeCategoryKeys(categoryDraftKeys);
    setCategoryKeys(normalized);
    setCategoryDraftKeys(normalized);

    const ensuredKey = normalized.includes(activeCategoryKey) ? activeCategoryKey : normalized[0] ?? "top";
    if (!normalized.includes(activeCategoryKey)) {
      setActiveCategoryKey(ensuredKey);
      setCategoryFilter(mapCategoryKeyToSpotCategory(ensuredKey) ?? "all");
    }
    setCategoryManagerOpen(false);

    return { appliedKeys: normalized, activeKey: ensuredKey };
  }, [activeCategoryKey, categoryDraftKeys]);

  return {
    categoryKeys,
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
    saveCategoryDraft,
    setCategoryDraftKeys
  };
};

export type { CategoryKey } from "../lib/categories";
