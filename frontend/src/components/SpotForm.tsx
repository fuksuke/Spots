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
  const totalSteps = 6;
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
    // Step 4からStep 5に進む際に投稿者情報を保存（オートフィル用）
    if (step === 4) {
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
      // 基本情報のバリデーション
      return !title.trim() || !startTime || !endTime || !locationDetails.trim();
    }
    if (step === 3) {
      // ビジュアル編集のバリデーション
      return !onelinePR.trim() || !description.trim();
    }
    if (step === 4) {
      // 投稿者情報のバリデーション
      if (!contactValue.trim()) {
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
  }, [isLastStep, step, selectedLocation, planOptions, selectedPlan, title, startTime, endTime, locationDetails, onelinePR, description, contactValue, contactType]);

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
        // Step 2: 基本情報入力（タイトル、カテゴリ、日時、場所詳細）
        return (
          <div className="spot-step spot-step-form">
            <p className="hint">イベントの基本情報を入力してください。</p>
            <div className="form-group">
              <label htmlFor="title">イベント名<span className="required-mark">*</span></label>
              <input
                id="title"
                type="text"
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="イベント名を入力"
                maxLength={60}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="category">カテゴリ<span className="required-mark">*</span></label>
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
                <label htmlFor="startTime">開始日時<span className="required-mark">*</span></label>
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
                <label htmlFor="endTime">終了日時<span className="required-mark">*</span></label>
                <input
                  id="endTime"
                  type="datetime-local"
                  className="input"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  min={startTime}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="locationDetails">場所詳細<span className="required-mark">*</span></label>
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
        );
      case 3:
        // Step 3: ビジュアル編集（画像、キャッチコピー、詳細説明）
        return (
          <div className="spot-step spot-step-fillable">
            {/* リアルタイムプレビューカード */}
            <article className="fillable-card-real">
              {/* Header with Avatar */}
              <div className="modern-card-header">
                <Avatar name="あなた" photoUrl={null} size={36} />
                <span className="owner-name">あなた</span>
              </div>

              {/* Hero Image - Input area */}
              <div className={`modern-hero ${imagePreview ? 'fillable-hero-done' : 'fillable-hero-required'}`}>
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
                    <>
                      <img src={imagePreview} alt="選択中の画像" />
                      <span className="fillable-hero-check">✓</span>
                    </>
                  ) : (
                    <div className="modern-hero-placeholder fillable-required">
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
              </div>

              {/* Content Area */}
              <div className="modern-content">
                {/* Title Row */}
                <div className="modern-title-row">
                  <div className="modern-titles">
                    <span className="modern-title">{title || 'タイトル未入力'}</span>
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
                  <div className="modern-schedule">
                    {startTime ? (() => {
                      const start = new Date(startTime);
                      const end = endTime ? new Date(endTime) : null;
                      const dateStr = `${start.getMonth() + 1}/${start.getDate()}`;
                      const startTimeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
                      const endTimeStr = end ? `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}` : '';
                      return `${dateStr} ${startTimeStr}${endTimeStr ? ` - ${endTimeStr}` : ''}`;
                    })() : '日時未入力'}
                  </div>
                  <span className="modern-category-badge">{category.toUpperCase()}</span>
                </div>

                {/* Catchcopy - Input required in this step */}
                <div className={`modern-catchcopy fillable-editable ${onelinePR.trim() ? 'fillable-done' : 'fillable-required'}`}>
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

                {/* Description - Input required in this step */}
                <div className={`modern-description fillable-editable ${description.trim() ? 'fillable-done' : 'fillable-required'}`}>
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
          </div>
        );
      case 4:
        // Step 4: 投稿者情報（オートフィル対応）
        return (
          <div className="spot-step spot-step-form">
            <p className="hint">投稿者情報は次回以降、自動で入力されます。変更がなければそのまま進んでください。</p>
            <div className="form-group">
              <label>連絡方法<span className="required-mark">*</span></label>
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
                  onChange={(event) => setSnsLinks((prev: typeof snsLinks) => ({ ...prev, x: event.target.value }))}
                  placeholder="X (Twitter) のURL"
                />
                <input
                  type="url"
                  className="input"
                  value={snsLinks.instagram}
                  onChange={(event) => setSnsLinks((prev: typeof snsLinks) => ({ ...prev, instagram: event.target.value }))}
                  placeholder="Instagram のURL"
                />
                <input
                  type="url"
                  className="input"
                  value={snsLinks.youtube}
                  onChange={(event) => setSnsLinks((prev: typeof snsLinks) => ({ ...prev, youtube: event.target.value }))}
                  placeholder="YouTube のURL"
                />
                <input
                  type="url"
                  className="input"
                  value={snsLinks.facebook}
                  onChange={(event) => setSnsLinks((prev: typeof snsLinks) => ({ ...prev, facebook: event.target.value }))}
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
      case 5:
        // Step 5: レビュー画面
        const formatReviewSchedule = () => {
          if (!startTime) return '';
          const start = new Date(startTime);
          const end = endTime ? new Date(endTime) : null;
          const dateStr = `${start.getMonth() + 1}/${start.getDate()}`;
          const startTimeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
          const endTimeStr = end ? `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}` : '';
          return `${dateStr} ${startTimeStr}${endTimeStr ? ` - ${endTimeStr}` : ''}`;
        };

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
                {/* 実際の吹き出しデザイン */}
                <div className="map-callout">
                  <div className="map-callout__bubble">
                    <span className="map-callout__lamp" data-state="live"></span>
                    <span className="map-callout__text">{onelinePR || title || 'タイトルなし'}</span>
                  </div>
                  <div className="map-callout__tail"></div>
                </div>
              </div>
            ) : (
              <div className="review-preview review-preview-list">
                {/* 実際のカードデザイン */}
                <article className="spot-list-card spot-mobile-card new-card">
                  <div className="modern-card-header">
                    <Avatar name="あなた" photoUrl={null} size={36} />
                    <span className="owner-name">あなた</span>
                  </div>
                  <div className="modern-hero">
                    {imagePreview ? (
                      <img src={imagePreview} alt="イベント画像" />
                    ) : (
                      <div className="modern-hero-placeholder">
                        <span>{category.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div className="modern-content">
                    <div className="modern-title-row">
                      <div className="modern-titles">
                        <h3 className="modern-title">{title || 'タイトルなし'}</h3>
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
                    <div className="modern-schedule">{formatReviewSchedule()}</div>
                    {onelinePR && <div className="modern-catchcopy">{onelinePR}</div>}
                    {description && <p className="modern-description">{description.length > 38 ? description.slice(0, 38) + '…' : description}</p>}
                  </div>
                </article>
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

  // フォームのsubmitイベントは常にブロック（実際の送信はボタンクリックで行う）
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  // 送信ボタンクリック時の処理
  const handleSubmitClick = async () => {
    // 最終ステップでない場合は何もしない
    if (step !== 5) {
      return;
    }

    setStatusMessage(null);
    setErrorMessage(null);
    setFormErrors([]);

    if (validationErrors.length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    const { lat, lng } = selectedLocation!;

    // SMS未認証の場合は認証モーダルを開いて終了
    if (!phoneVerified) {
      onRequirePhoneVerification?.();
      return;
    }

    setIsSubmitting(true);
    try {

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

  const stepTitles: string[] = ["位置を選択", "プランを選択", "基本情報", "ビジュアル編集", "投稿者情報", "確認"];
  const stepSubtitles: string[] = [
    "地図をタップしてイベントの開催場所を指定してください",
    "イベントの種類に合ったプランを選択してください",
    "イベント名・日時・場所の詳細を入力してください",
    "実際の表示イメージを確認しながら画像や説明文を編集できます",
    "問い合わせ先やSNSリンクを入力してください",
    "入力内容を確認して投稿を完了しましょう"
  ];

  // Enterキーによるフォーム送信を最終ステップ以外で防ぐ
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && !isLastStep) {
      // テキストエリアでは改行を許可
      if ((event.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }
      event.preventDefault();
    }
  }, [isLastStep]);

  return (
    <form className="spot-wizard" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <div className="spot-wizard-header">
        <div>
          <h2>{stepTitles[step] ?? "位置を選択"}</h2>
          <p className="spot-wizard-subtitle">
            {stepSubtitles[step] ?? ""}
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

      <div className="spot-wizard-footer">
        {step > 0 ? (
          <button type="button" className="button subtle" onClick={handlePreviousStep}>
            戻る
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        {isLastStep ? (
          <button type="button" className="button primary" onClick={handleSubmitClick} disabled={isSubmitting}>
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
