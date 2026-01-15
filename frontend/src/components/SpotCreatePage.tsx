import { ReactNode, useEffect, useState } from "react";
import { Coordinates, Spot, UserProfile } from "../types";
import { SpotForm } from "./SpotForm";
import { PhoneVerificationModal } from "./PhoneVerificationModal";

export type SpotCreatePageProps = {
  selectedLocation: Coordinates | null;
  onSelectLocation: (coords: Coordinates) => void;
  onLocationReset: () => void;
  onCreated: (spot: Spot) => void;
  onCancel: () => void;
  authToken?: string;
  canPostLongTerm?: boolean;
  canPostRecurring?: boolean;
  headerActions?: ReactNode;
  profile: UserProfile | null;
  onProfileRefresh?: () => Promise<void> | void;
};

export const SpotCreatePage = ({
  selectedLocation,
  onSelectLocation,
  onLocationReset,
  onCreated,
  onCancel,
  authToken,
  canPostLongTerm,
  canPostRecurring,
  headerActions,
  profile,
  onProfileRefresh
}: SpotCreatePageProps) => {
  const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isVerificationOpen, setVerificationOpen] = useState(false);
  const [localPhoneVerified, setLocalPhoneVerified] = useState<boolean>(Boolean(profile?.phoneVerified));
  const [draftSaveFn, setDraftSaveFn] = useState<(() => void) | null>(null);

  useEffect(() => {
    setLocalPhoneVerified(Boolean(profile?.phoneVerified));
  }, [profile?.phoneVerified]);

  const handleVerificationSuccess = (nextProfile: UserProfile) => {
    setLocalPhoneVerified(Boolean(nextProfile.phoneVerified));
    setVerificationOpen(false);
    onProfileRefresh?.();
  };

  return (
    <div className="spot-create-page">
      <header className="spot-create-header">
        <div className="spot-create-header-left">
          <button type="button" className="button subtle" onClick={() => setCancelConfirmOpen(true)}>
            キャンセル
          </button>
          <h1>スポット投稿</h1>
        </div>
        <div className="spot-create-header-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => draftSaveFn?.()}
            disabled={!draftSaveFn}
            title="下書きを保存"
          >
            下書き保存
          </button>
        </div>
      </header>
      <main className="spot-create-main">
        <SpotForm
          selectedLocation={selectedLocation}
          onSelectLocation={onSelectLocation}
          onLocationReset={onLocationReset}
          onCreated={onCreated}
          authToken={authToken}
          canPostLongTerm={canPostLongTerm}
          canPostRecurring={canPostRecurring}
          phoneVerified={localPhoneVerified}
          onRequirePhoneVerification={() => setVerificationOpen(true)}
          onSaveDraft={(saveFn) => setDraftSaveFn(() => saveFn)}
        />
      </main>

      {isCancelConfirmOpen ? (
        <div className="spot-cancel-overlay" role="dialog" aria-modal="true">
          <div className="spot-cancel-dialog">
            <h2>投稿を中止しますか？</h2>
            <p className="hint">入力内容は破棄され、ホームへ戻ります。</p>
            <div className="spot-cancel-actions">
              <button type="button" className="button subtle" onClick={() => setCancelConfirmOpen(false)}>
                いいえ
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  setCancelConfirmOpen(false);
                  onCancel();
                }}
              >
                はい
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PhoneVerificationModal
        isOpen={isVerificationOpen}
        authToken={authToken}
        onClose={() => setVerificationOpen(false)}
        onVerified={handleVerificationSuccess}
      />
    </div>
  );
};
