import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { uploadImageFile } from "../lib/storage";
import { Coordinates, Spot, SpotCategory, SPOT_CATEGORY_VALUES } from "../types";
import { MapView } from "./MapView";

const categories: SpotCategory[] = [...SPOT_CATEGORY_VALUES];

type PostingPlan = "short_term" | "long_term" | "recurring";

type PostingPlanOption = {
  id: PostingPlan;
  title: string;
  description: string;
  locked: boolean;
  badge?: string;
};

const toDatetimeLocal = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

const toIsoString = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const parseLocalDateTime = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

type SpotFormProps = {
  selectedLocation: Coordinates | null;
  onLocationReset: () => void;
  onSelectLocation: (coords: Coordinates) => void;
  onCreated: (spot: Spot) => void;
  authToken?: string;
  canPostLongTerm?: boolean;
  canPostRecurring?: boolean;
  phoneVerified?: boolean;
  onRequirePhoneVerification?: () => void;
};

export const SpotForm = ({
  selectedLocation,
  onLocationReset,
  onSelectLocation,
  onCreated,
  authToken,
  canPostLongTerm = false,
  canPostRecurring = false,
  phoneVerified = false,
  onRequirePhoneVerification
}: SpotFormProps) => {
  const totalSteps = 3;
  const [step, setStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<PostingPlan>("short_term");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const planOptions = useMemo<PostingPlanOption[]>(
    () => [
      {
        id: "short_term" as PostingPlan,
        title: "短期イベント",
        description: "1日または数日のスポット情報を共有するプランです。",
        locked: false
      },
      {
        id: "long_term" as PostingPlan,
        title: "長期イベント",
        description: "数週間以上開催するイベント向けの投稿です。",
        locked: !canPostLongTerm,
        badge: "有料"
      },
      {
        id: "recurring" as PostingPlan,
        title: "定期イベント",
        description: "定期開催のワークショップやライブなどに最適です。",
        locked: !canPostRecurring,
        badge: "有料"
      }
    ],
    [canPostLongTerm, canPostRecurring]
  );

  const stepLabels: string[] = ["位置を選択", "イベント種別", "詳細入力"];

  useEffect(() => {
    const current = planOptions.find((option) => option.id === selectedPlan);
    if (current?.locked) {
      setSelectedPlan("short_term");
    }
  }, [planOptions, selectedPlan]);

  useEffect(() => {
    if (selectedLocation) {
      setLocationError(null);
    }
  }, [selectedLocation]);

  const initialMapView = useMemo(
    () => ({
      longitude: selectedLocation?.lng ?? 139.7016,
      latitude: selectedLocation?.lat ?? 35.6595,
      zoom: selectedLocation ? 16 : 14
    }),
    [selectedLocation]
  );

  const handlePlanSelect = useCallback(
    (plan: PostingPlan) => {
      const option = planOptions.find((item) => item.id === plan);
      if (option?.locked) {
        setPlanError("このプランを利用するには有料プランへのアップグレードが必要です。");
        return;
      }
      setSelectedPlan(plan);
      setPlanError(null);
    },
    [planOptions]
  );

  const handleUseCurrentLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("現在地取得に対応していない環境です。");
      return;
    }
    setIsRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setIsRequestingLocation(false);
        setLocationError(null);
        onSelectLocation({ lat: coords.latitude, lng: coords.longitude });
      },
      () => {
        setIsRequestingLocation(false);
        setLocationError("現在地を取得できませんでした。");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onSelectLocation]);

  const handleSearchByCoordinate = useCallback(() => {
    const value = window.prompt("緯度,経度をカンマ区切りで入力してください (例: 35.6595,139.7016)");
    if (!value) {
      return;
    }
    const [latRaw, lngRaw] = value.split(",");
    const lat = Number(latRaw?.trim());
    const lng = Number(lngRaw?.trim());
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      onSelectLocation({ lat, lng });
      setLocationError(null);
      return;
    }
    setLocationError("緯度・経度を正しく入力してください。");
  }, [onSelectLocation]);

  const handleNextStep = useCallback(() => {
    if (step === 0 && !selectedLocation) {
      setLocationError("地図をクリックして位置を選択してください。");
      return;
    }
    if (step === 1) {
      const option = planOptions.find((item) => item.id === selectedPlan);
      if (!option || option.locked) {
        setPlanError("このプランを利用するには有料プランへのアップグレードが必要です。");
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [step, selectedLocation, planOptions, selectedPlan, totalSteps]);

  const handlePreviousStep = useCallback(() => {
    setStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const activePlan = useMemo(() => planOptions.find((item) => item.id === selectedPlan), [planOptions, selectedPlan]);

  const isLastStep = step === totalSteps - 1;

  const isNextDisabled = useMemo(() => {
    if (isLastStep) {
      return false;
    }
    if (step === 0) {
      return !selectedLocation;
    }
    if (step === 1) {
      const option = planOptions.find((item) => item.id === selectedPlan);
      return !option || option.locked;
    }
    return false;
  }, [isLastStep, step, selectedLocation, planOptions, selectedPlan]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SpotCategory>("live");
  const [startTime, setStartTime] = useState(() => toDatetimeLocal(new Date()));
  const [endTime, setEndTime] = useState(() => toDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const startTimeMin = useMemo(() => toDatetimeLocal(new Date()), []);

  useEffect(() => {
    if (phoneVerified) {
      setErrorMessage(null);
    }
  }, [phoneVerified]);

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="spot-step spot-step-map">
            <div className="spot-map-wrapper">
              <div className="spot-map-shell">
                <MapView
                  initialView={initialMapView}
                  selectedLocation={selectedLocation}
                  focusCoordinates={selectedLocation}
                  onSelectLocation={onSelectLocation}
                />
                <div className="spot-map-crosshair" aria-hidden="true" />
              </div>
              <div className="spot-map-actions">
                <button
                  type="button"
                  className="spot-chip"
                  onClick={handleUseCurrentLocation}
                  disabled={isRequestingLocation}
                >
                  {isRequestingLocation ? "現在地取得中..." : "現在地"}
                </button>
                <button type="button" className="spot-chip" onClick={handleSearchByCoordinate}>
                  検索
                </button>
                <button
                  type="button"
                  className="spot-chip subtle"
                  onClick={() => {
                    onLocationReset();
                    setLocationError(null);
                  }}
                  disabled={!selectedLocation}
                >
                  クリア
                </button>
              </div>
            </div>
            <div className="spot-map-summary">
              {selectedLocation ? (
                <p className="spot-map-coords">
                  Lat: {selectedLocation.lat.toFixed(5)}, Lng: {selectedLocation.lng.toFixed(5)}
                </p>
              ) : (
                <p className="hint">地図をクリックして会場の位置にピンを置いてください。</p>
              )}
              {locationError ? <p className="spot-status error">{locationError}</p> : null}
            </div>
            <p className="spot-step-hint">ピンはドラッグして微調整できます。</p>
          </div>
        );
      case 1:
        return (
          <div className="spot-step spot-step-plan">
            <div className="spot-plan-cards">
              {planOptions.map((option) => {
                const isSelected = option.id === selectedPlan;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`spot-plan-card ${isSelected ? "selected" : ""} ${option.locked ? "locked" : ""}`.trim()}
                    onClick={() => handlePlanSelect(option.id)}
                  >
                    {option.locked ? <span className="spot-plan-lock" aria-hidden="true">🔒</span> : null}
                    {option.badge ? <span className="spot-plan-badge">{option.badge}</span> : null}
                    <span className="spot-plan-title">{option.title}</span>
                    <span className="spot-plan-desc">{option.description}</span>
                    {option.locked ? <span className="spot-plan-note">課金が必要です</span> : null}
                  </button>
                );
              })}
            </div>
            {planError ? <p className="spot-status error">{planError}</p> : null}
            <p className="spot-step-hint">長期・定期イベントの投稿には有料プランが必要です。</p>
          </div>
        );
      default:
        return (
          <div className="spot-step spot-step-form">
            <div className="spot-plan-summary">
              <span className="spot-plan-summary-label">選択中のプラン</span>
              <span className="spot-plan-summary-value">{activePlan?.title ?? "短期イベント"}</span>
            </div>
            <div className="form-group">
              <label htmlFor="title">タイトル</label>
              <input
                id="title"
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="渋谷駅前ライブ"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">説明</label>
              <textarea
                id="description"
                className="textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="出演者や雰囲気などの説明"
                rows={3}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="category">カテゴリ</label>
              <select
                id="category"
                className="input"
                value={category}
                onChange={(event) => setCategory(event.target.value as SpotCategory)}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startTime">開始</label>
                <input
                  id="startTime"
                  type="datetime-local"
                  className="input"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  min={startTimeMin}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="endTime">終了</label>
                <input
                  id="endTime"
                  type="datetime-local"
                  className="input"
                  value={endTime}
                  min={startTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="imageUrl">写真URL (任意)</label>
              <input
                id="imageUrl"
                className="input"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="Firebase Storage のURL"
              />
            </div>
            <div className="form-group">
              <label htmlFor="imageFile">写真をアップロード (任意)</label>
              <input
                id="imageFile"
                type="file"
                accept="image/*"
                onChange={(event) => handleImageFileChange(event.target.files?.[0] ?? null)}
              />
              {imagePreview && <img src={imagePreview} alt="選択中の画像プレビュー" className="image-preview" />}
            </div>
            <div className="form-group">
              <label>選択中の位置</label>
              {selectedLocation ? (
                <div className="location-preview">
                  <span>
                    Lat: {selectedLocation.lat.toFixed(5)}, Lng: {selectedLocation.lng.toFixed(5)}
                  </span>
                  <button type="button" className="button subtle" onClick={onLocationReset}>
                    クリア
                  </button>
                </div>
              ) : (
                <p className="hint">前のステップで位置を選択してください。</p>
              )}
            </div>
            {statusMessage ? <p className="spot-status success">{statusMessage}</p> : null}
            {formErrors.length > 0 ? (
              <ul className="spot-status-list">
                {formErrors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {errorMessage ? <p className="spot-status error">{errorMessage}</p> : null}
            {!authToken && <p className="hint">ログインするとスポットを投稿できます。</p>}
          </div>
        );
    }
  };

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setCategory("live");
    setStartTime(toDatetimeLocal(new Date()));
    setEndTime(toDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
    setImageUrl("");
    setImageFile(null);
    setImagePreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
    setFormErrors([]);
    setSelectedPlan("short_term");
    setStep(0);
    setPlanError(null);
    setLocationError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageFileChange = useCallback(
    (file: File | null) => {
      setFormErrors([]);
      setImagePreview((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });

      if (file) {
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          setImageFile(null);
          setFormErrors([`画像ファイルは${MAX_IMAGE_SIZE_MB}MB以下にしてください。`]);
          return;
        }
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setImageUrl("");
        return;
      }

      setImageFile(null);
    },
    [setFormErrors]
  );

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const startDate = parseLocalDateTime(startTime);
    const endDate = parseLocalDateTime(endTime);

    if (!authToken) {
      errors.push("投稿するにはログインが必要です。");
    }

    if (!selectedLocation) {
      errors.push("地図をクリックして位置を選択してください。");
    }

    if (!trimmedTitle || !trimmedDescription) {
      errors.push("タイトルと説明を入力してください。");
    }

    if (!startDate || !endDate) {
      errors.push("開始時刻と終了時刻を正しく入力してください。");
    } else if (endDate <= startDate) {
      errors.push("終了時刻は開始時刻より後に設定してください。");
    }

    if (imageUrl.trim() && !isValidHttpUrl(imageUrl.trim())) {
      errors.push("写真URLは http(s):// から始まる形式で入力してください。");
    }

    if (imageFile && imageFile.size > MAX_IMAGE_SIZE_BYTES) {
      errors.push(`画像ファイルは${MAX_IMAGE_SIZE_MB}MB以下にしてください。`);
    }

    return errors;
  }, [authToken, description, endTime, imageFile, imageUrl, selectedLocation, startTime, title]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);
    setFormErrors([]);

    if (validationErrors.length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    const { lat, lng } = selectedLocation!;

    setIsSubmitting(true);
    try {
      if (!phoneVerified) {
        onRequirePhoneVerification?.();
        throw new Error("スポット投稿にはSMS本人確認が必要です。先に認証を完了してください。");
      }

      let uploadedImageUrl: string | undefined;
      if (imageFile) {
        try {
          uploadedImageUrl = await uploadImageFile(imageFile, "spots");
        } catch (uploadError) {
          throw new Error("画像のアップロードに失敗しました。再度お試しください。");
        }
      } else if (imageUrl.trim()) {
        uploadedImageUrl = imageUrl.trim();
      }

      const payload = {
        title,
        description,
        category,
        lat,
        lng,
        startTime: toIsoString(startTime),
        endTime: toIsoString(endTime),
        imageUrl: uploadedImageUrl
      };

      const response = await fetch("/api/spots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "投稿に失敗しました");
      }

      const spot = (await response.json()) as Spot;
      setStatusMessage("投稿が完了しました。リストと地図を確認してください。");
      onCreated(spot);
      resetForm();
      onLocationReset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "予期せぬエラーが発生しました";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="spot-wizard" onSubmit={handleSubmit}>
      <div className="spot-wizard-header">
        <div>
          <h2>スポットを投稿</h2>
          <p className="spot-wizard-subtitle">位置・プラン・詳細を順番に入力して投稿できます。</p>
        </div>
        <span className="spot-step-label">{stepLabels[step] ?? ""}</span>
      </div>

      <div
        className="spot-stepper"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
      >
        {Array.from({ length: totalSteps }).map((_, index) => (
          <span
            key={index}
            className={`spot-stepper-dot ${index <= step ? "active" : ""}`.trim()}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="spot-step-container">{renderStepContent()}</div>

      {isLastStep ? (
        <div className="spot-verification-banner">
          {phoneVerified ? (
            <span className="status success">✅ SMS認証済みのアカウントです。</span>
          ) : (
            <>
              <p className="hint">
                投稿を完了する前にSMS本人確認が必要です。下のボタンから認証を済ませてください。
              </p>
              <button
                type="button"
                className="button subtle"
                onClick={() => onRequirePhoneVerification?.()}
              >
                SMS認証を開始
              </button>
            </>
          )}
        </div>
      ) : null}

      <div className="spot-wizard-footer">
        {step > 0 ? (
          <button type="button" className="button subtle" onClick={handlePreviousStep}>
            戻る
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        {isLastStep ? (
          <button type="submit" className="button primary" disabled={isSubmitting}>
            {isSubmitting ? "投稿中..." : "スポットを投稿"}
          </button>
        ) : (
          <button
            type="button"
            className="button primary"
            onClick={handleNextStep}
            disabled={isNextDisabled}
          >
            次へ
          </button>
        )}
      </div>
    </form>
  );
};
