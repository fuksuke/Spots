/**
 * Calculate distance between two coordinates in km using Haversine formula
 */
export const calculateDistanceKm = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Calculate distance bias score multiplier.
 * - Inside threshold: 1.0 (no penalty)
 * - Outside threshold: Penalized heavily based on distance.
 * 
 * Formula: (Threshold / Max(Distance, Threshold)) ^ 2
 */
export const calculateDistanceScoreMultiplier = (
    distanceKm: number,
    thresholdKm: number = 2.0
): number => {
    if (distanceKm <= thresholdKm) return 1.0;
    return Math.pow(thresholdKm / distanceKm, 2);
};
