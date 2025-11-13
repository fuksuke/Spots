import { useEffect } from "react";

import { trackEvent } from "../lib/analytics";

type UseBillingReturnOptions = {
  onMessage: (message: string) => void;
  onRefreshProfile: () => void;
};

export const useBillingReturn = ({ onMessage, onRefreshProfile }: UseBillingReturnOptions) => {
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
          onMessage("決済が完了しました。設定を更新しています。");
          trackEvent("billing_checkout_complete", {});
          shouldRefreshProfile = true;
          break;
        }
        case "cancel": {
          onMessage("Checkoutをキャンセルしました。");
          trackEvent("billing_checkout_cancel", {});
          break;
        }
        case "error": {
          onMessage("決済処理でエラーが発生しました。時間をおいて再度お試しください。");
          trackEvent("billing_checkout_error", { result: billingStatus });
          break;
        }
        default: {
          onMessage("決済状況を確認できませんでした。");
          trackEvent("billing_checkout_unknown", { result: billingStatus });
        }
      }
      params.delete("billing");
    }

    const portalStatus = params.get("portal");
    if (portalStatus) {
      didUpdate = true;
      if (portalStatus === "done") {
        onMessage("Stripeポータルからの変更を反映します。");
        shouldRefreshProfile = true;
      } else {
        onMessage("Stripeポータルの処理で問題が発生しました。");
      }
      trackEvent("billing_portal_return", { status: portalStatus });
      params.delete("portal");
    }

    if (shouldRefreshProfile) {
      onRefreshProfile();
    }

    if (didUpdate) {
      const nextSearch = params.toString();
      const newUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [onMessage, onRefreshProfile]);
};
