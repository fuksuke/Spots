import { ReactNode, useState } from "react";
import { Coordinates, Spot } from "../types";
import { SpotForm } from "./SpotForm";

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
  headerActions
}: SpotCreatePageProps) => {
  const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  return (
    <div className="spot-create-page">
      <header className="spot-create-header">
        <div className="spot-create-header-left">
          <button type="button" className="button subtle" onClick={() => setCancelConfirmOpen(true)}>
            キャンセル
          </button>
          <h1>スポット投稿</h1>
        </div>
        <div className="spot-create-header-actions">{headerActions}</div>
      </header>
      <main className="spot-create-main">
        <div className="spot-create-content">
          <SpotForm
            selectedLocation={selectedLocation}
            onSelectLocation={onSelectLocation}
            onLocationReset={onLocationReset}
            onCreated={onCreated}
            authToken={authToken}
            canPostLongTerm={canPostLongTerm}
            canPostRecurring={canPostRecurring}
          />
        </div>
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
    </div>
  );
};
