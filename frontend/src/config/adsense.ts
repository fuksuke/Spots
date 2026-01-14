/**
 * Google AdSense Configuration
 *
 * This module manages AdSense settings for the Spots MVP.
 * AdSense is the primary monetization strategy for MVP release.
 *
 * Environment Variables:
 * - VITE_ADSENSE_CLIENT_ID: Your AdSense publisher ID (ca-pub-XXXXXXXXXX)
 * - VITE_ADSENSE_TRENDING_SLOT: Ad slot ID for trending page
 * - VITE_ADSENSE_MAP_SLOT: Ad slot ID for map bottom placement
 * - VITE_ADSENSE_ENABLED: Toggle AdSense on/off (default: true)
 */

export const ADSENSE_CONFIG = {
  /**
   * AdSense Client (Publisher) ID
   * Format: ca-pub-XXXXXXXXXX
   */
  CLIENT_ID: import.meta.env.VITE_ADSENSE_CLIENT_ID || 'ca-pub-XXXXXXXXXX',

  /**
   * Ad slot ID for trending page placement
   * Primary monetization location - high visibility
   */
  TRENDING_SLOT_ID: import.meta.env.VITE_ADSENSE_TRENDING_SLOT || 'XXXXXXXXXX',

  /**
   * Ad slot ID for map bottom placement (mobile only)
   * Secondary location - optional, less intrusive
   */
  MAP_SLOT_ID: import.meta.env.VITE_ADSENSE_MAP_SLOT || 'XXXXXXXXXX',

  /**
   * Enable/disable AdSense globally
   * Set to false for development or testing
   */
  ENABLED: import.meta.env.VITE_ADSENSE_ENABLED !== 'false'
} as const;

/**
 * Check if AdSense is properly configured
 */
export const isAdSenseConfigured = (): boolean => {
  return (
    ADSENSE_CONFIG.ENABLED &&
    ADSENSE_CONFIG.CLIENT_ID !== 'ca-pub-XXXXXXXXXX' &&
    ADSENSE_CONFIG.TRENDING_SLOT_ID !== 'XXXXXXXXXX'
  );
};
