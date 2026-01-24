import { FormEvent, useEffect, useMemo, useState } from "react";
import { Coordinates, SpotCategory, UserProfile, SPOT_CATEGORY_VALUES } from "../types";
import { ScheduledSpot } from "../hooks/useScheduledSpots";
import { toDatetimeLocal, toIsoString } from "../../lib/date";

const categories: SpotCategory[] = [...SPOT_CATEGORY_VALUES];

type ScheduledSpotFormProps = {
  authToken: string;
  profile: UserProfile | null;
  selectedLocation: Coordinates | null;
  onLocationReset: () => void;
  onCreated: (spot: ScheduledSpot) => void;
};

export const ScheduledSpotForm = ({ authToken, profile, selectedLocation, onLocationReset, onCreated }: ScheduledSpotFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SpotCategory>("event");
  const [lat, setLat] = useState(() => "35.65950");
  const [lng, setLng] = useState(() => "139.70160");
  const [startTime, setStartTime] = useState(() => toDatetimeLocal(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [endTime, setEndTime] = useState(() => toDatetimeLocal(new Date(Date.now() + 3 * 60 * 60 * 1000)));
  const [publishAt, setPublishAt] = useState(() => toDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
  const [announcementType, setAnnouncementType] = useState<"short_term_notice" | "long_term_campaign">("short_term_notice");
  const [imageUrl, setImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (selectedLocation) {
      setLat(selectedLocation.lat.toFixed(5));
      setLng(selectedLocation.lng.toFixed(5));
    }
  }, [selectedLocation]);

  const tier = profile?.posterTier ?? "tier_c";
  const availableTypes = useMemo(() => {
    const base: Array<{ value: "short_term_notice" | "long_term_campaign"; label: string }> = [
      { value: "short_term_notice", label: "短期告知" }
    ];
    if (tier === "tier_a") {
      base.push({ value: "long_term_campaign", label: "長期キャンペーン" });
    }
    return base;
  }, [tier]);

  const quotaText = useMemo(() => {
    const shortQuota = profile?.promotionQuota.shortTerm;
    const longQuota = profile?.promotionQuota.longTerm;
    return {
      short: shortQuota != null ? `残り枠（7日間）: ${shortQuota}` : undefined,
      long: longQuota != null ? `残り枠（30日間）: ${longQuota}` : undefined
    };
  }, [profile?.promotionQuota.longTerm, profile?.promotionQuota.shortTerm]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    const resolvedLat = selectedLocation ? selectedLocation.lat : Number(lat);
    const resolvedLng = selectedLocation ? selectedLocation.lng : Number(lng);
    if (!Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng)) {
      setErrorMessage("地図をクリックして位置を選択するか、緯度・経度を入力してください。");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title,
        description,
        category,
        lat: resolvedLat,
        lng: resolvedLng,
        startTime: toIsoString(startTime),
        endTime: toIsoString(endTime),
        publishAt: toIsoString(publishAt),
        announcementType,
        imageUrl: imageUrl.trim() ? imageUrl.trim() : null
      };
      const response = await fetch("/api/scheduled_spots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "予約投稿に失敗しました");
      }
      const spot = (await response.json()) as ScheduledSpot;
      setStatusMessage("予約投稿を受け付けました。審査状況を確認してください。");
      setTitle("");
      setDescription("");
      setImageUrl("");
      setLat("35.65950");
      setLng("139.70160");
      onLocationReset();
      onCreated(spot);
    } catch (error) {
      const message = error instanceof Error ? error.message : "予期せぬエラーが発生しました";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h2>予約告知を作成</h2>
      <div className="form-group">
        <label>投稿タイプ</label>
        <select
          className="input"
          value={announcementType}
          onChange={(event) => setAnnouncementType(event.target.value as typeof announcementType)}
        >
          {availableTypes.map((typeOption) => (
            <option key={typeOption.value} value={typeOption.value}>
              {typeOption.label}
            </option>
          ))}
        </select>
        {announcementType === "short_term_notice" && quotaText.short && <p className="hint">{quotaText.short}</p>}
        {announcementType === "long_term_campaign" && quotaText.long && <p className="hint">{quotaText.long}</p>}
      </div>
      <div className="form-group">
        <label htmlFor="scheduled-title">タイトル</label>
        <input
          id="scheduled-title"
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="scheduled-description">説明</label>
        <textarea
          id="scheduled-description"
          className="textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="scheduled-category">カテゴリ</label>
        <select
          id="scheduled-category"
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
          <label htmlFor="scheduled-lat">緯度</label>
          <input
            id="scheduled-lat"
            className="input"
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            required
            type="number"
            step="0.00001"
            disabled={Boolean(selectedLocation)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="scheduled-lng">経度</label>
          <input
            id="scheduled-lng"
            className="input"
            value={lng}
            onChange={(event) => setLng(event.target.value)}
            required
            type="number"
            step="0.00001"
            disabled={Boolean(selectedLocation)}
          />
        </div>
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
          <p className="hint">地図をクリックして位置を選択してください。</p>
        )}
      </div>
      <div className="form-group">
        <label htmlFor="scheduled-publish">公開予定</label>
        <input
          id="scheduled-publish"
          type="datetime-local"
          className="input"
          value={publishAt}
          onChange={(event) => setPublishAt(event.target.value)}
          required
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="scheduled-start">開始</label>
          <input
            id="scheduled-start"
            type="datetime-local"
            className="input"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="scheduled-end">終了</label>
          <input
            id="scheduled-end"
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
        <label htmlFor="scheduled-image">告知用画像URL（任意）</label>
        <input
          id="scheduled-image"
          className="input"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="プロモーション用の公開URL"
        />
      </div>
      {statusMessage && <p className="status success">{statusMessage}</p>}
      {errorMessage && <p className="status error">{errorMessage}</p>}
      <button type="submit" className="button primary" disabled={isSubmitting}>
        {isSubmitting ? "送信中..." : "予約投稿する"}
      </button>
    </form>
  );
};
