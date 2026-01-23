import { useCallback, useEffect, useMemo, useState } from "react";

export type SpotMediaGalleryProps = {
  title: string;
  mediaUrls: string[];
  className?: string;
};

export const SpotMediaGallery = ({ title, mediaUrls, className }: SpotMediaGalleryProps) => {
  const normalizedUrls = useMemo(() => {
    return mediaUrls
      .map((url) => url.trim())
      .filter((url, index, self) => url.length > 0 && self.indexOf(url) === index);
  }, [mediaUrls]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [normalizedUrls.length]);

  const goRelative = useCallback(
    (delta: number) => {
      setCurrentIndex((prev) => {
        const size = normalizedUrls.length || 1;
        const next = (prev + delta + size) % size;
        return next;
      });
    },
    [normalizedUrls.length]
  );

  const total = normalizedUrls.length;
  if (total === 0) {
    return null;
  }

  const activeSrc = normalizedUrls[currentIndex] ?? normalizedUrls[0];
  const galleryClassName = ["sheet-media", className].filter(Boolean).join(" ");

  return (
    <div className={galleryClassName} aria-label={`${title}の画像ギャラリー`}>
      <img src={activeSrc} alt={`${title}の画像 ${currentIndex + 1}/${total}`} loading="lazy" />
      {total > 1 ? (
        <>
          <button type="button" className="media-nav prev" onClick={() => goRelative(-1)} aria-label="前の画像">
            ‹
          </button>
          <button type="button" className="media-nav next" onClick={() => goRelative(1)} aria-label="次の画像">
            ›
          </button>
          <div className="media-indicators" role="tablist" aria-label="画像切り替え">
            {normalizedUrls.map((url, index) => (
              <button
                key={url}
                type="button"
                className={`indicator ${index === currentIndex ? "active" : ""}`.trim()}
                aria-label={`${index + 1}枚目の画像を表示`}
                aria-current={index === currentIndex}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};
