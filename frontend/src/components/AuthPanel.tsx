import { FormEvent, useState } from "react";
import { User, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { auth } from "../lib/firebase";

type AuthPanelProps = {
  user: User | null;
};

type Mode = "login" | "signup";

export const AuthPanel = ({ user }: AuthPanelProps) => {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setDisplayName("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        setStatusMessage("ログインしました。");
      } else {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (credential.user && displayName.trim()) {
          await updateProfile(credential.user, { displayName: displayName.trim() });
        }
        setStatusMessage("アカウントを作成しました。");
      }
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "認証処理に失敗しました";
      setErrorMessage(message);
    } finally {
      setIsProcessing(false);
    }
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
      <h2>{mode === "login" ? "ログイン" : "新規登録"}</h2>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="form-group">
          <span>Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="form-group">
          <span>パスワード</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
        </label>
        {mode === "signup" && (
          <label className="form-group">
            <span>表示名</span>
            <input
              className="input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </label>
        )}
        {statusMessage && <p className="status success">{statusMessage}</p>}
        {errorMessage && <p className="status error">{errorMessage}</p>}
        <button type="submit" className="button primary" disabled={isProcessing}>
          {isProcessing ? "処理中..." : mode === "login" ? "ログイン" : "登録"}
        </button>
      </form>
      <button
        type="button"
        className="button subtle"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setStatusMessage(null);
          setErrorMessage(null);
          resetForm();
        }}
      >
        {mode === "login" ? "アカウントを作成" : "既存アカウントでログイン"}
      </button>
    </div>
  );
};
