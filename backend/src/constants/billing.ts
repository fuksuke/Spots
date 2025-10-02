import type { PosterTier, PromotionQuota } from "../services/posterProfileService.js";

export type TierConfig = {
  quota: PromotionQuota;
};

const BASE_TIER_CONFIG: Record<PosterTier, TierConfig> = {
  tier_a: {
    quota: {
      short_term: 10,
      long_term: 5
    }
  },
  tier_b: {
    quota: {
      short_term: 5,
      long_term: 0
    }
  },
  tier_c: {
    quota: {}
  }
};

export const getTierConfig = (tier: PosterTier): TierConfig => {
  return BASE_TIER_CONFIG[tier] ?? BASE_TIER_CONFIG.tier_c;
};

export const getDefaultQuotaForTier = (tier: PosterTier): PromotionQuota => {
  return { ...getTierConfig(tier).quota };
};

export const BILLABLE_TIERS: PosterTier[] = ["tier_b", "tier_a"];
