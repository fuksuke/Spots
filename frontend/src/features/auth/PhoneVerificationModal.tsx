import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AsYouType, CountryCode, parsePhoneNumberFromString } from "libphonenumber-js";
import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  linkWithCredential
} from "firebase/auth";

import { auth } from "../../lib/firebase";
import { UserProfile } from "../../types";

const RESEND_INTERVAL_SECONDS = 60;
const MAX_RESEND_ATTEMPTS = 3;

const COUNTRY_OPTIONS: Array<{ code: CountryCode; label: string }> = [
  { code: "JP", label: "日本 (+81)" },
  { code: "US", label: "アメリカ (+1)" },
  { code: "GB", label: "イギリス (+44)" },
  { code: "KR", label: "韓国 (+82)" },
  { code: "TW", label: "台湾 (+886)" },
  { code: "AU", label: "オーストラリア (+61)" }
];

const detectDefaultCountry = (): CountryCode => {
  if (typeof navigator === "undefined") {
    return "JP";
  }
  const language = navigator.language?.toLowerCase() ?? "";
  if (language.includes("jp") || language.includes("ja")) {
    return "JP";
  }
  if (language.includes("us") || language.includes("en")) {
    return "US";
  }
  if (language.includes("gb") || language.includes("uk")) {
    return "GB";
  }
  return "JP";
};

const sanitizeDigits = (value: string) => value.replace(/[^0-9+]/g, "");

export type PhoneVerificationModalProps = {
  isOpen: boolean;
  authToken?: string;
  onClose: () => void;
  onVerified: (profile: UserProfile) => void;
};

export const PhoneVerificationModal = ({ isOpen, authToken, onClose, onVerified }: PhoneVerificationModalProps) => {
  const [country, setCountry] = useState<CountryCode>(() => detectDefaultCountry());
  const [rawInput, setRawInput] = useState("");
  const [formattedInput, setFormattedInput] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [phase, setPhase] = useState<"input" | "code" | "success">("input");
  const [resendRemaining, setResendRemaining] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const verificationIdRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPhase("input");
      setRawInput("");
      setFormattedInput("");
      setVerificationCode("");
      setStatusMessage(null);
      setErrorMessage(null);
      setResendRemaining(0);
      setResendAttempts(0);
      setNormalizedPhone(null);
      verificationIdRef.current = null;
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (resendRemaining <= 0) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = window.setInterval(() => {
      setResendRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [resendRemaining]);

  useEffect(() => {
    if (!rawInput) return;
    const formatter = new AsYouType(country);
    setFormattedInput(formatter.input(rawInput));
  }, [country, rawInput]);

  const resolvedDefaultCountry = useMemo(() => country, [country]);

  const ensureRecaptcha = async () => {
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }
    const verifier = new RecaptchaVerifier(auth, "sms-verification-recaptcha", {
      size: "invisible"
    });
    await verifier.render();
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const validatePhoneNumber = (input: string): string => {
    const candidate = sanitizeDigits(input);
    if (!candidate) {
      throw new Error("電話番号を入力してください。");
    }
    const parsed = parsePhoneNumberFromString(candidate, resolvedDefaultCountry);
    if (!parsed || !parsed.isValid()) {
      throw new Error("電話番号の形式が正しくありません。");
    }
    const digits = (parsed.nationalNumber ?? "").replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      throw new Error("電話番号の桁数が正しくありません。");
    }
    if (/^(\d)\1{5,}$/.test(digits)) {
      throw new Error("同じ数字の繰り返しは使用できません。");
    }
    return parsed.number;
  };

  const handleSendCode = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const e164 = validatePhoneNumber(formattedInput || rawInput);
      const user = auth.currentUser;
      if (!user) {
        throw new Error("SMS認証を行うにはログインが必要です。");
      }
      if (resendAttempts >= MAX_RESEND_ATTEMPTS) {
        throw new Error("再送は3回までです。しばらくしてから再試行してください。");
      }
      setIsSending(true);
      const verifier = await ensureRecaptcha();
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(e164, verifier);
      verificationIdRef.current = verificationId;
      setNormalizedPhone(e164);
      setPhase("code");
      setStatusMessage("SMSコードを送信しました。届かない場合は1分後に再送をお試しください。");
      setResendRemaining(RESEND_INTERVAL_SECONDS);
      setResendAttempts((prev) => prev + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMS送信に失敗しました";
      setErrorMessage(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    const code = verificationCode.trim();
    if (code.length !== 6 || /\D/.test(code)) {
      setErrorMessage("6桁の確認コードを入力してください。");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setErrorMessage("ログインがタイムアウトしました。再度ログインしてください。");
      return;
    }
    const verificationId = verificationIdRef.current;
    const phoneNumber = normalizedPhone;
    if (!verificationId || !phoneNumber) {
      setErrorMessage("認証コードを再送してからもう一度お試しください。");
      return;
    }

    try {
      setIsVerifying(true);
      const credential = PhoneAuthProvider.credential(verificationId, code);
      await linkWithCredential(user, credential);

      if (!authToken) {
        throw new Error("認証トークンを取得できませんでした。ページを更新して再度お試しください。");
      }

      const response = await fetch("/api/profile/verify-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ phoneNumber })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error(body.message ?? "この電話番号は既に使用されています。");
        }
        throw new Error(body.message ?? "電話番号の登録に失敗しました。");
      }

      const profile = (await response.json()) as UserProfile;
      setPhase("success");
      setStatusMessage("SMS認証が完了しました。これで投稿できます。");
      setVerificationCode("");
      onVerified(profile);
    } catch (error) {
      const message = error instanceof Error ? error.message : "認証に失敗しました。コードを確認してください。";
      setErrorMessage(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendClick = async () => {
    if (resendRemaining > 0) return;
    await handleSendCode();
  };

  return (
    <div className={`auth-modal phone-verification-modal ${isOpen ? "open" : ""}`.trim()} role="dialog" aria-modal="true">
      <div className="modal-scrim" aria-hidden="true" onClick={onClose} />
      <div className="modal-body">
        <div className="panel">
          <h2>SMSで本人確認</h2>
          <p className="hint">初回投稿時のみ、電話番号で本人確認を行います。</p>

          {statusMessage && <p className="status success">{statusMessage}</p>}
          {errorMessage && <p className="status error">{errorMessage}</p>}

          {phase === "input" ? (
            <form className="auth-form" onSubmit={(event) => void handleSendCode(event)}>
              <label className="form-group">
                <span>国／地域</span>
                <select
                  className="input"
                  value={country}
                  onChange={(event) => setCountry(event.target.value as CountryCode)}
                >
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-group">
                <span>電話番号</span>
                <input
                  className="input"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={formattedInput}
                  onChange={(event) => {
                    const value = sanitizeDigits(event.target.value);
                    setRawInput(value);
                    setErrorMessage(null);
                  }}
                  placeholder="09012345678"
                  required
                />
              </label>
              <button type="submit" className="button primary" disabled={isSending}>
                {isSending ? "送信中..." : "SMSコードを送る"}
              </button>
            </form>
          ) : null}

          {phase === "code" ? (
            <form className="auth-form" onSubmit={handleVerifyCode}>
              <p className="hint">SMSで届いた6桁のコードを入力してください。</p>
              <label className="form-group">
                <span>確認コード</span>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(event) => {
                    setVerificationCode(event.target.value.replace(/[^0-9]/g, ""));
                    setErrorMessage(null);
                  }}
                  required
                />
              </label>
              <div className="button-row">
                <button type="button" className="button subtle" onClick={handleResendClick} disabled={isSending || resendRemaining > 0}>
                  {resendRemaining > 0 ? `再送 (${resendRemaining}s)` : "コードを再送"}
                </button>
                <button type="submit" className="button primary" disabled={isVerifying}>
                  {isVerifying ? "確認中..." : "認証する"}
                </button>
              </div>
            </form>
          ) : null}

          {phase === "success" ? (
            <div className="auth-form">
              <p className="hint">認証が完了しました。ウィンドウを閉じて投稿を再開してください。</p>
              <button type="button" className="button primary" onClick={onClose}>
                閉じる
              </button>
            </div>
          ) : null}
        </div>
        <div id="sms-verification-recaptcha" style={{ display: "none" }} aria-hidden="true" />
      </div>
    </div>
  );
};
