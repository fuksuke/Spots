import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { uploadImageFile } from "../lib/storage";
import { Coordinates, Spot, SpotCategory, SPOT_CATEGORY_VALUES } from "../types";

const categories: SpotCategory[] = [...SPOT_CATEGORY_VALUES];

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
  onCreated: (spot: Spot) => void;
  authToken?: string;
};

export const SpotForm = ({ selectedLocation, onLocationReset, onCreated, authToken }: SpotFormProps) => {
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
    <form className="form-card" onSubmit={handleSubmit}>
      <h2>スポットを投稿</h2>
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
        {imagePreview && (
          <img src={imagePreview} alt="選択中の画像プレビュー" className="image-preview" />
        )}
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
      {statusMessage && <p className="status success">{statusMessage}</p>}
      {formErrors.length > 0 ? (
        <ul className="status-list">
          {formErrors.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {errorMessage && <p className="status error">{errorMessage}</p>}
      <button type="submit" className="button primary" disabled={isSubmitting}>
        {isSubmitting ? "投稿中..." : "スポットを投稿"}
      </button>
      {!authToken && <p className="hint">ログインするとスポットを投稿できます。</p>}
    </form>
  );
};
