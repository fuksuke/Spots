import { useEffect, useRef, useState } from 'react';
import { ADSENSE_CONFIG } from "../../config/adsense";
import '../../styles/components/AdSenseUnit.css';

/**
 * AdSense Unit Component Props
 */
export type AdSenseUnitProps = {
  /** Ad slot ID from AdSense */
  slotId: string;
  /** Ad format type */
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  /** Enable full-width responsive ads */
  fullWidthResponsive?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Test mode - shows skeleton without loading real ads */
  testMode?: boolean;
};

/**
 * Google AdSense Unit Component
 *
 * Displays AdSense ads with:
 * - Skeleton loading state
 * - "スポンサー" (Sponsor) label
 * - Responsive design
 * - Graceful degradation on failure
 * - No layout shift (fixed min-height)
 *
 * @example
 * ```tsx
 * <AdSenseUnit
 *   slotId={ADSENSE_CONFIG.TRENDING_SLOT_ID}
 *   format="auto"
 *   className="trending-ad"
 * />
 * ```
 */
export const AdSenseUnit = ({
  slotId,
  format = 'auto',
  fullWidthResponsive = true,
  className = '',
  testMode = false
}: AdSenseUnitProps) => {
  const insRef = useRef<HTMLModElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);
  const initAttemptedRef = useRef(false);

  useEffect(() => {
    // Don't load ads if disabled or in test mode
    if (!ADSENSE_CONFIG.ENABLED || testMode) {
      setAdLoaded(true);
      return;
    }

    // Prevent multiple initialization attempts
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    /**
     * Initialize AdSense ad unit
     */
    const loadAd = () => {
      try {
        if (insRef.current && window.adsbygoogle) {
          // Push ad to AdSense queue
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          setAdLoaded(true);
        }
      } catch (error) {
        console.warn('[AdSense] Initialization failed:', error);
        setAdFailed(true);
      }
    };

    // Check if AdSense script is already loaded
    if (window.adsbygoogle) {
      loadAd();
    } else {
      // Poll for AdSense script availability
      const checkInterval = setInterval(() => {
        if (window.adsbygoogle) {
          clearInterval(checkInterval);
          loadAd();
        }
      }, 100);

      // Timeout after 5 seconds
      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        if (!adLoaded) {
          console.warn('[AdSense] Script load timeout');
          setAdFailed(true);
        }
      }, 5000);

      return () => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }
  }, [adLoaded, testMode]);

  // Don't render if AdSense is disabled
  if (!ADSENSE_CONFIG.ENABLED) {
    return null;
  }

  // Silent failure - don't show anything if ad fails to load
  if (adFailed) {
    return null;
  }

  return (
    <div className={`adsense-wrapper ${className}`}>
      {/* Sponsor label */}
      <div className="adsense-label">スポンサー</div>

      {/* Ad container with skeleton */}
      <div className={`adsense-container ${adLoaded ? 'loaded' : 'loading'}`}>
        {/* Skeleton placeholder */}
        {!adLoaded && <div className="adsense-skeleton" />}

        {/* AdSense ad unit */}
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={ADSENSE_CONFIG.CLIENT_ID}
          data-ad-slot={slotId}
          data-ad-format={format}
          data-full-width-responsive={fullWidthResponsive ? 'true' : 'false'}
        />
      </div>
    </div>
  );
};

/**
 * TypeScript global type declaration for AdSense
 */
declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}
