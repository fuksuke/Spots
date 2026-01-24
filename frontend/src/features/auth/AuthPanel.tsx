import { useState } from "react";
import {
  GoogleAuthProvider,
  User,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "../../lib/firebase";

type AuthPanelProps = {
  user: User | null;
};

export const AuthPanel = ({ user }: AuthPanelProps) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const formatAuthError = (error: unknown, fallback: string) => {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case "auth/account-exists-with-different-credential":
          return "同じメールアドレスが別の認証方法で登録されています。そちらでサインインしてください。";
        case "auth/popup-closed-by-user":
          return "ポップアップが閉じられたためログインできませんでした。もう一度お試しください。";
        case "auth/cancelled-popup-request":
          return "別のログイン操作が進行中です。少し待ってから再度お試しください。";
        default:
          return error.message;
      }
    }
    return fallback;
  };

  const handleSignOut = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await signOut(auth);
      setStatusMessage("ログアウトしました。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "ログアウトに失敗しました";
      setErrorMessage(message);
    }
  };

  const handleGoogleSignIn = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    setIsProcessing(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await signInWithPopup(auth, provider);
      setStatusMessage("Googleアカウントでログインしました。");
    } catch (error) {
      if (error instanceof FirebaseError && error.code === "auth/popup-blocked") {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          const message = formatAuthError(redirectError, "Googleログインに失敗しました。再度お試しください。");
          setErrorMessage(message);
        }
      } else {
        const message = formatAuthError(error, "Googleログインに失敗しました。再度お試しください。");
        setErrorMessage(message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (user) {
    return (
      <div className="panel">
        <h2>アカウント</h2>
        <p className="hint">{user.displayName ?? "表示名未設定"}</p>
        <p className="hint">{user.email}</p>
        {statusMessage && <p className="status success">{statusMessage}</p>}
        {errorMessage && <p className="status error">{errorMessage}</p>}
        <button type="button" className="button subtle" onClick={handleSignOut} disabled={isProcessing}>
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>ログイン</h2>
      {statusMessage && <p className="status success">{statusMessage}</p>}
      {errorMessage && <p className="status error">{errorMessage}</p>}
      <button type="button" className="button oauth-button" onClick={handleGoogleSignIn} disabled={isProcessing}>
        <span className="oauth-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M16.32 7.368h-.648V7.332H9v3.336h4.248a3.864 3.864 0 01-1.656 2.544v2.112h2.688c1.584-1.464 2.5-3.624 2.5-6.12 0-.648-.06-1.272-.18-1.908z"
              fill="#4285F4"
            />
            <path
              d="M9 17.004c2.43 0 4.47-.804 5.964-2.22l-2.688-2.112c-.744.504-1.692.804-3.276.804-2.508 0-4.632-1.692-5.388-3.996H.828v2.16A7.998 7.998 0 009 17.004z"
              fill="#34A853"
            />
            <path
              d="M3.612 9.48c-.168-.504-.264-1.044-.264-1.584s.096-1.08.264-1.584V4.152H.828A7.994 7.994 0 000 7.896c0 1.26.3 2.448.828 3.744l2.784-2.16z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.552c1.332 0 2.232.576 2.748 1.056l2.016-1.98C13.44.9 11.43 0 9 0 5.472 0 2.46 2.016.828 4.968l2.784 2.16C4.368 5.248 6.492 3.552 9 3.552z"
              fill="#EA4335"
            />
            <path d="M0 0h18v18H0V0z" fill="none" />
          </svg>
        </span>
        <span>{isProcessing ? "処理中..." : "Googleでログイン"}</span>
      </button>
    </div>
  );
};
