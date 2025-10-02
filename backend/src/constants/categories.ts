export const SPOT_CATEGORY_VALUES = ["live", "event", "cafe", "coupon", "sports"] as const;
export type SpotCategory = typeof SPOT_CATEGORY_VALUES[number];
