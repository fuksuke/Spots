import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { uploadImageFile } from "../lib/storage";
import { Coordinates, Spot, SpotCategory, SPOT_CATEGORY_VALUES } from "../types";
import { SpotCreateMap } from "./SpotCreateMap";
import { searchPlaces } from "../lib/mapboxGeocoding";
import { formatPhoneNumber, validatePhoneNumber, validateEmail } from "../lib/phoneValidation";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

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
  onSaveDraft?: (saveFn: () => void) => void;
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
  onRequirePhoneVerification,
  onSaveDraft
}: SpotFormProps) => {
  const totalSteps = 5;
  const [step, setStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<PostingPlan>("short_term");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ label: string; coords: Coordinates }>>([]);

  // オートフィル用のLocalStorageキー
  const AUTOFILL_KEY = 'spot_form_autofill_data';
  const DRAFT_KEY = 'spot_form_draft_data';

  // LocalStorageから投稿者情報を読み込む
  const loadAutofillData = () => {
    try {
      const saved = localStorage.getItem(AUTOFILL_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load autofill data:', error);
    }
    return null;
  };

  // オートフィルデータを初期化
  const autofillData = useMemo(() => loadAutofillData(), []);

  // State変数を先に定義（関数から参照されるため）
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [onelinePR, setOnelinePR] = useState("");
  const [category, setCategory] = useState<SpotCategory>("live");
  const [startTime, setStartTime] = useState(() => toDatetimeLocal(new Date()));
  const [endTime, setEndTime] = useState(() => toDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [contactType, setContactType] = useState<"phone" | "email">(autofillData?.contactType || "phone");
  const [contactValue, setContactValue] = useState(autofillData?.contactValue || "");
  const [contactError, setContactError] = useState<string | null>(null);
  const [locationDetails, setLocationDetails] = useState(autofillData?.locationDetails || "");
  const [homepageUrl, setHomepageUrl] = useState(autofillData?.homepageUrl || "");
  const [snsLinks, setSnsLinks] = useState(autofillData?.snsLinks || { x: "", instagram: "", youtube: "", facebook: "" });
  const [hashtags, setHashtags] = useState(autofillData?.hashtags || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [reviewMode, setReviewMode] = useState<'balloon' | 'list'>('balloon');
  const startTimeMin = useMemo(() => toDatetimeLocal(new Date()), []);
  const planOptions = useMemo<PostingPlanOption[]>(
    () => [
      {
        id: "short_term",
        title: "単発イベント",
        description: "1日開催のライブやポップアップ向けのプランです。",
        locked: false
      },
      {
        id: "long_term",
        title: "継続イベント",
        description: "数週間以上開催する展示やキャンペーンに最適です。",
        locked: !canPostLongTerm,
        badge: "有料"
      },
      {
        id: "recurring",
        title: "定期イベント",
        description: "毎週・毎月開催のワークショップやコミュニティ向け。",
        locked: !canPostRecurring,
        badge: "有料"
      }
    ],
    [canPostLongTerm, canPostRecurring]
  );


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

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    searchPlaces(searchQuery.trim(), controller.signal)
      .then((features) => {
        setSearchResults(
          features.map((feature) => ({
            label: feature.place_name,
            coords: { lat: feature.center[1], lng: feature.center[0] }
          }))
        );
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Failed to search places", error);
        }
      })
      .finally(() => {
        setIsSearching(false);
      });

    return () => {
      controller.abort();
    };
  }, [searchQuery]);

  // 連絡先の値を変更するハンドラー（電話番号の場合は自動整形）
  const handleContactChange = useCallback((value: string) => {
    if (contactType === 'phone') {
      // 電話番号の場合は自動整形
      const formatted = formatPhoneNumber(value);
      setContactValue(formatted);
      // バリデーション
      const error = validatePhoneNumber(formatted);
      setContactError(error);
    } else {
      // メールの場合
      setContactValue(value);
      const error = validateEmail(value);
      setContactError(error);
    }
  }, [contactType]);

  // LocalStorageに投稿者情報を保存する
  const saveAutofillData = useCallback((data: {
    contactType: 'phone' | 'email';
    contactValue: string;
    locationDetails: string;
    homepageUrl: string;
    snsLinks: { x: string; instagram: string; youtube: string; facebook: string };
    hashtags: string;
  }) => {
    try {
      localStorage.setItem(AUTOFILL_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save autofill data:', error);
    }
  }, []);

  // 下書きを保存する
  const saveDraft = useCallback(() => {
    try {
      const draftData = {
        step,
        selectedPlan,
        selectedLocation,
        title,
        description,
        onelinePR,
        category,
        startTime,
        endTime,
        imagePreview,
        contactType,
        contactValue,
        locationDetails,
        homepageUrl,
        snsLinks,
        hashtags,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
      setStatusMessage('下書きを保存しました');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.warn('Failed to save draft:', error);
      setErrorMessage('下書きの保存に失敗しました');
    }
  }, [step, selectedPlan, selectedLocation, title, description, onelinePR, category, startTime, endTime, imagePreview, contactType, contactValue, locationDetails, homepageUrl, snsLinks, hashtags]);

  // 下書きを読み込む
  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draftData = JSON.parse(saved);
        return draftData;
      }
    } catch (error) {
      console.warn('Failed to load draft:', error);
    }
    return null;
  }, []);

  // 下書きを削除する
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      console.warn('Failed to clear draft:', error);
    }
  }, []);

  // 親コンポーネントにsaveDraft関数を渡す
  useEffect(() => {
    onSaveDraft?.(saveDraft);
  }, [saveDraft, onSaveDraft]);

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
    // Step 3からStep 4に進む際に投稿者情報を保存（オートフィル用）
    if (step === 3) {
      saveAutofillData({
        contactType,
        contactValue,
        locationDetails,
        homepageUrl,
        snsLinks,
        hashtags
      });
    }
    setStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [step, selectedLocation, planOptions, selectedPlan, totalSteps, contactType, contactValue, locationDetails, homepageUrl, snsLinks, hashtags, saveAutofillData]);

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
    if (step === 2) {
      // イベント詳細のバリデーション
      return !title.trim() || !description.trim() || !onelinePR.trim() || !startTime || !endTime;
    }
    if (step === 3) {
      // 投稿者情報のバリデーション
      if (!contactValue.trim() || !locationDetails.trim()) {
        return true;
      }
      // 連絡先のバリデーションエラーがある場合は次へ進めない
      if (contactType === 'phone') {
        const phoneError = validatePhoneNumber(contactValue);
        if (phoneError) return true;
      } else {
        const emailError = validateEmail(contactValue);
        if (emailError) return true;
      }
      return false;
    }
    return false;
  }, [isLastStep, step, selectedLocation, planOptions, selectedPlan, title, description, onelinePR, startTime, endTime, contactValue, contactType, locationDetails]);

  useEffect(() => {
    if (phoneVerified) {
      setErrorMessage(null);
    }
  }, [phoneVerified]);

  // 連絡先タイプが変更されたときに再バリデーション
  useEffect(() => {
    if (contactValue.trim()) {
      if (contactType === 'phone') {
        const error = validatePhoneNumber(contactValue);
        setContactError(error);
      } else {
        const error = validateEmail(contactValue);
        setContactError(error);
      }
    } else {
      setContactError(null);
    }
  }, [contactType, contactValue]);

  // マウント時に下書きを復元
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      const shouldRestore = window.confirm(
        `下書きが見つかりました（保存日時: ${new Date(draft.savedAt).toLocaleString('ja-JP')}）。\n復元しますか？`
      );
      if (shouldRestore) {
        setStep(draft.step || 0);
        setSelectedPlan(draft.selectedPlan || 'short_term');
        if (draft.selectedLocation) {
          onSelectLocation(draft.selectedLocation);
        }
        setTitle(draft.title || '');
        setDescription(draft.description || '');
        setCategory(draft.category || 'live');
        setStartTime(draft.startTime || toDatetimeLocal(new Date()));
        setEndTime(draft.endTime || toDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
        if (draft.imagePreview) {
          setImagePreview(draft.imagePreview);
        }
        setContactType(draft.contactType || 'phone');
        setContactValue(draft.contactValue || '');
        setLocationDetails(draft.locationDetails || '');
        setHomepageUrl(draft.homepageUrl || '');
        setSnsLinks(draft.snsLinks || { x: '', instagram: '', youtube: '', facebook: '' });
        setHashtags(draft.hashtags || '');
        setStatusMessage('下書きを復元しました');
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        clearDraft();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // マウント時のみ実行

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="spot-step spot-step-map">
            <div className="spot-map-summary spot-map-summary-lead">
              <p className="hint">地図をクリックして位置を選択してください。ピンをドラッグすることで微調整することもできます。</p>
              {locationError ? <p className="spot-status error">{locationError}</p> : null}
            </div>
            <div className="spot-map-wrapper">
              <div className="spot-map-shell">
                <SpotCreateMap
                  initialView={{ latitude: initialMapView.latitude, longitude: initialMapView.longitude, zoom: initialMapView.zoom }}
                  value={selectedLocation}
                  onChange={onSelectLocation}
                />
              </div>
              <div className="spot-map-actions">
                <div className="spot-map-search">
                  <input
                    type="search"
                    placeholder="地名・住所で検索"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                  {isSearching ? <span className="spot-map-search-status">検索中...</span> : null}
                  {searchResults.length > 0 ? (
                    <ul className="spot-map-search-results">
                      {searchResults.map((item) => (
                        <li key={`${item.label}-${item.coords.lat}-${item.coords.lng}`}>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectLocation(item.coords);
                              setSearchQuery(item.label);
                              setSearchResults([]);
                              setLocationError(null);
                            }}
                          >
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="spot-map-action-buttons">
                  <button
                    type="button"
                    className="spot-chip"
                    onClick={handleUseCurrentLocation}
                    disabled={isRequestingLocation}
                  >
                    {isRequestingLocation ? "現在地取得中..." : "現在地"}
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
            </div>
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
                    {option.locked ? <span className="spot-plan-note">Coming Soon</span> : null}
                  </button>
                );
              })}
            </div>
            {planError ? <p className="spot-status error">{planError}</p> : null}
            <p className="spot-step-hint">長期・定期イベントの投稿には有料プランが必要です。</p>
          </div>
        );
      case 2:
        // Step 2: イベント詳細（穴埋め式カード編集）
        const formatScheduleDisplay = () => {
          if (!startTime) return "タップして日時を入力";
          const start = new Date(startTime);
          const end = endTime ? new Date(endTime) : null;
          const dateStr = `${start.getMonth() + 1}/${start.getDate()}`;
          const startTimeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
          const endTimeStr = end ? `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}` : '';
          return `${dateStr} ${startTimeStr}${endTimeStr ? ` - ${endTimeStr}` : ''}`;
        };

        return (
          <div className="spot-step spot-step-fillable">
            <div className="fillable-instructions">
              <p className="hint">
                各項目をタップして情報を入力してください。
              </p>
            </div>

            {/* リアルタイムプレビューカード - 実際のSpotListViewと同じ構造 */}
            <article className="fillable-card-real">
              {/* Header with Avatar */}
              <div className="modern-card-header">
                <Avatar name="あなた" photoUrl={null} size={36} />
                <span className="owner-name">あなた</span>
              </div>

              {/* Hero Image */}
              <div className="modern-hero">
                <div
                  className="modern-hero-image fillable-hero-trigger"
                  onClick={() => document.getElementById('imageFile')?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      document.getElementById('imageFile')?.click();
                    }
                  }}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="選択中の画像" />
                  ) : (
                    <div className="modern-hero-placeholder fillable-empty">
                      <div className="placeholder-icon">📷</div>
                      <div className="placeholder-text">タップして画像を追加</div>
                    </div>
                  )}
                </div>
                <input
                  id="imageFile"
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleImageFileChange(event.target.files?.[0] ?? null)}
                  style={{ display: 'none' }}
                />
                {/* SNS Button (Instagram style) */}
                <button type="button" className="modern-hero-social" aria-label="Instagram">
                  <Icon name="camera" size={22} />
                </button>
              </div>

              {/* Content Area */}
              <div className="modern-content">
                {/* Title Row */}
                <div className="modern-title-row">
                  <div className="modern-titles fillable-editable">
                    <input
                      type="text"
                      className={`modern-title fillable-input ${!title.trim() ? 'fillable-empty' : ''}`}
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="タップしてタイトルを入力..."
                      maxLength={60}
                    />
                  </div>
                  <div className="modern-stats">
                    <div className="metric view">
                      <Icon name="eyesFill" size={18} />
                      0
                    </div>
                    <div className="metric like">
                      <Icon name="heart" size={18} />
                      0
                    </div>
                  </div>
                </div>

                {/* Schedule + Category */}
                <div className="fillable-schedule-row">
                  <div
                    className={`modern-schedule fillable-editable ${!startTime ? 'fillable-empty' : ''}`}
                    onClick={() => {
                      const input = document.getElementById('startTimeInput');
                      input?.focus();
                      (input as HTMLInputElement)?.showPicker?.();
                    }}
                  >
                    {formatScheduleDisplay()}
                  </div>
                  <select
                    className="fillable-category-select"
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

                {/* Hidden datetime inputs */}
                <div className="hidden-inputs" style={{ display: 'none' }}>
                  <input
                    id="startTimeInput"
                    type="datetime-local"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    min={startTimeMin}
                    required
                  />
                  <input
                    id="endTimeInput"
                    type="datetime-local"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    min={startTime}
                    required
                  />
                </div>

                {/* Catchcopy */}
                <div className={`modern-catchcopy fillable-editable ${!onelinePR.trim() ? 'fillable-empty' : ''}`}>
                  <input
                    type="text"
                    className="fillable-input catchcopy-input"
                    value={onelinePR}
                    onChange={(event) => setOnelinePR(event.target.value)}
                    placeholder="💬 地図の吹き出しに表示されるPR文（20文字）"
                    maxLength={20}
                    required
                  />
                  {onelinePR.length > 0 && (
                    <div className="char-counter">
                      {onelinePR.length}/20
                      {onelinePR.length >= 18 && <span className="warning">あと{20 - onelinePR.length}文字</span>}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className={`modern-description fillable-editable ${!description.trim() ? 'fillable-empty' : ''}`}>
                  <textarea
                    className="fillable-input description-input"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="イベントの詳細を入力...&#10;&#10;・出演者情報&#10;・会場の雰囲気&#10;・参加方法&#10;・注意事項など"
                    rows={4}
                    required
                  />
                </div>
              </div>
            </article>

            {/* ヘルプメッセージ */}
            <div className="fillable-help-compact">
              <div className="help-item">📸 鮮明な画像</div>
              <div className="help-item">✍️ 具体的なタイトル</div>
              <div className="help-item">💬 魅力的なPR文</div>
              <div className="help-item">📝 詳しい説明</div>
            </div>
          </div>
        );
      case 3:
        // Step 3: 投稿者情報（オートフィル対応）
        return (
          <div className="spot-step spot-step-form">
            <p className="hint">投稿者情報は次回以降、自動で入力されます。変更がなければそのまま進んでください。</p>
            <div className="form-row">
              <div className="form-group">
                <label>連絡方法 *</label>
                <div className="contact-radio-group">
                  <label>
                    <input type="radio" value="phone" checked={contactType === "phone"} onChange={() => setContactType("phone")} /> 電話番号
                  </label>
                  <label>
                    <input type="radio" value="email" checked={contactType === "email"} onChange={() => setContactType("email")} /> メール
                  </label>
                </div>
                <input
                  type={contactType === "phone" ? "tel" : "email"}
                  className={`input ${contactError ? 'input-error' : ''}`}
                  value={contactValue}
                  onChange={(event) => handleContactChange(event.target.value)}
                  placeholder={contactType === "phone" ? "090-1234-5678" : "contact@example.com"}
                  required
                />
                {contactError && <p className="error-message">{contactError}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="locationDetails">場所詳細 *</label>
                <input
                  id="locationDetails"
                  className="input"
                  value={locationDetails}
                  onChange={(event) => setLocationDetails(event.target.value)}
                  placeholder="◯◯ビル 7F ガーデンルーム"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="homepageUrl">公式ホームページ (任意)</label>
              <input
                id="homepageUrl"
                className="input"
                value={homepageUrl}
                onChange={(event) => setHomepageUrl(event.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="form-group">
              <label>公式SNSリンク (任意)</label>
              <div className="sns-input-grid">
                <input
                  type="url"
                  className="input"
                  value={snsLinks.x}
                  onChange={(event) => setSnsLinks((prev) => ({ ...prev, x: event.target.value }))}
                  placeholder="X (Twitter) のURL"
                />
                <input
                  type="url"
                  className="input"
                  value={snsLinks.instagram}
                  onChange={(event) => setSnsLinks((prev) => ({ ...prev, instagram: event.target.value }))}
                  placeholder="Instagram のURL"
                />
                <input
                  type="url"
                  className="input"
                  value={snsLinks.youtube}
                  onChange={(event) => setSnsLinks((prev) => ({ ...prev, youtube: event.target.value }))}
                  placeholder="YouTube のURL"
                />
                <input
                  type="url"
                  className="input"
                  value={snsLinks.facebook}
                  onChange={(event) => setSnsLinks((prev) => ({ ...prev, facebook: event.target.value }))}
                  placeholder="Facebook のURL"
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="hashtags">ハッシュタグ (任意)</label>
              <input
                id="hashtags"
                className="input"
                value={hashtags}
                onChange={(event) => setHashtags(event.target.value)}
                placeholder="#shibuya #live #popup"
              />
            </div>
          </div>
        );
      case 4:
        // Step 4: レビュー画面
        return (
          <div className="spot-step spot-step-review">
            <div className="review-mode-toggle">
              <button
                type="button"
                className={`review-mode-button ${reviewMode === 'balloon' ? 'active' : ''}`}
                onClick={() => setReviewMode('balloon')}
              >
                吹き出しビュー
              </button>
              <button
                type="button"
                className={`review-mode-button ${reviewMode === 'list' ? 'active' : ''}`}
                onClick={() => setReviewMode('list')}
              >
                リストビュー
              </button>
            </div>

            {reviewMode === 'balloon' ? (
              <div className="review-preview review-preview-balloon">
                <div className="spot-callout-preview">
                  <div className="spot-callout-title">{title || 'タイトルなし'}</div>
                  {onelinePR && <div className="spot-callout-pr">{onelinePR}</div>}
                  <div className="spot-callout-category">{category.toUpperCase()}</div>
                  {imagePreview && <img src={imagePreview} alt="イベント画像" className="spot-callout-image" />}
                </div>
              </div>
            ) : (
              <div className="review-preview review-preview-list">
                <div className="spot-card-preview">
                  {imagePreview && <img src={imagePreview} alt="イベント画像" className="spot-card-image" />}
                  <div className="spot-card-content">
                    <h3 className="spot-card-title">{title || 'タイトルなし'}</h3>
                    <p className="spot-card-description">{description || '説明なし'}</p>
                    <div className="spot-card-meta">
                      <span className="spot-card-category">{category.toUpperCase()}</span>
                      <span className="spot-card-time">{startTime ? new Date(startTime).toLocaleString('ja-JP') : ''}</span>
                    </div>
                    <div className="spot-card-location">{locationDetails || '場所詳細なし'}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="review-summary">
              <h3>投稿内容の確認</h3>
              <dl className="review-summary-list">
                <dt>タイトル</dt>
                <dd>{title || '未入力'}</dd>
                <dt>説明</dt>
                <dd>{description || '未入力'}</dd>
                {onelinePR && (
                  <>
                    <dt>ひとことPR</dt>
                    <dd>{onelinePR}</dd>
                  </>
                )}
                <dt>カテゴリ</dt>
                <dd>{category.toUpperCase()}</dd>
                <dt>開始時刻</dt>
                <dd>{startTime ? new Date(startTime).toLocaleString('ja-JP') : '未入力'}</dd>
                <dt>終了時刻</dt>
                <dd>{endTime ? new Date(endTime).toLocaleString('ja-JP') : '未入力'}</dd>
                <dt>連絡先</dt>
                <dd>{contactValue || '未入力'} ({contactType === 'phone' ? '電話' : 'メール'})</dd>
                <dt>場所詳細</dt>
                <dd>{locationDetails || '未入力'}</dd>
                {homepageUrl && (
                  <>
                    <dt>公式サイト</dt>
                    <dd>{homepageUrl}</dd>
                  </>
                )}
                {(snsLinks.x || snsLinks.instagram || snsLinks.youtube || snsLinks.facebook) && (
                  <>
                    <dt>SNSリンク</dt>
                    <dd>
                      {snsLinks.x && <span>X </span>}
                      {snsLinks.instagram && <span>Instagram </span>}
                      {snsLinks.youtube && <span>YouTube </span>}
                      {snsLinks.facebook && <span>Facebook</span>}
                    </dd>
                  </>
                )}
                {hashtags && (
                  <>
                    <dt>ハッシュタグ</dt>
                    <dd>{hashtags}</dd>
                  </>
                )}
              </dl>
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
      default:
        return null;
    }
  };

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setCategory("live");
    setStartTime(toDatetimeLocal(new Date()));
    setEndTime(toDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
    setImageFile(null);
    setImagePreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
    setContactType("phone");
    setContactValue("");
    setLocationDetails("");
    setHomepageUrl("");
    setSnsLinks({ x: "", instagram: "", youtube: "", facebook: "" });
    setHashtags("");
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

    if (imageFile && imageFile.size > MAX_IMAGE_SIZE_BYTES) {
      errors.push(`画像ファイルは${MAX_IMAGE_SIZE_MB}MB以下にしてください。`);
    }

    if (!contactValue.trim()) {
      errors.push("連絡先を入力してください。");
    }

    if (!locationDetails.trim()) {
      errors.push("場所の詳細を入力してください。");
    }

    return errors;
  }, [authToken, description, endTime, imageFile, selectedLocation, startTime, title, contactValue, locationDetails]);

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
      }

      if (!contactValue.trim()) {
        throw new Error("連絡先を入力してください");
      }
      if (!locationDetails.trim()) {
        throw new Error("場所の詳細を入力してください");
      }

      const contact =
        contactType === "phone"
          ? { phone: contactValue.trim() }
          : {
              email: contactValue.trim()
            };

      const extraLinks = [
        homepageUrl ? { label: "公式サイト", url: homepageUrl.trim() } : null,
        snsLinks.x ? { label: "X", url: snsLinks.x.trim() } : null,
        snsLinks.instagram ? { label: "Instagram", url: snsLinks.instagram.trim() } : null,
        snsLinks.youtube ? { label: "YouTube", url: snsLinks.youtube.trim() } : null,
        snsLinks.facebook ? { label: "Facebook", url: snsLinks.facebook.trim() } : null
      ].filter((link): link is { label: string; url: string } => Boolean(link && link.url));

      const payload = {
        title,
        description,
        speechBubble: onelinePR.trim(),
        category,
        lat,
        lng,
        startTime: toIsoString(startTime),
        endTime: toIsoString(endTime),
        imageUrl: uploadedImageUrl,
        contact,
        locationDetails: locationDetails.trim(),
        externalLinks: extraLinks,
        hashtags: hashtags.trim()
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
      clearDraft(); // 下書きをクリア
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

  const stepTitles: string[] = ["位置を選択", "プランを選択", "カードを作成", "投稿者情報", "確認"];

  return (
    <form className="spot-wizard" onSubmit={handleSubmit}>
      <div className="spot-wizard-header">
        <div>
          <h2>{stepTitles[step] ?? "位置を選択"}</h2>
          <p className="spot-wizard-subtitle">
            {step === 2
              ? "カードを編集して、魅力的なイベント情報を作りましょう"
              : "位置・プラン・カード作成と順番に進めて投稿を完成させます"}
          </p>
        </div>
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
