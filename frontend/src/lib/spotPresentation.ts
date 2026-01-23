import { Spot } from "../types";

export type SpotDetailListItem = {
  key: string;
  type: "contact" | "location" | "price";
  label: string;
  value: string;
  href?: string;
};

// M/D format (e.g., "1/5")
export const formatDate = (date: Date) =>
  `${date.getMonth() + 1}/${date.getDate()}`;

// H:mm format (e.g., "8:09")
export const formatTime = (date: Date) =>
  `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;

export const formatSpotSchedule = (startTime?: string | null, endTime?: string | null) => {
  if (!startTime) return "日程未設定";
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) {
    return "日程未設定";
  }

  const end = endTime ? new Date(endTime) : null;
  const hasValidEnd = end && !Number.isNaN(end.getTime());

  let label = `${formatDate(start)} ${formatTime(start)}`;
  if (hasValidEnd && end) {
    const sameDay = formatDate(start) === formatDate(end);
    label += sameDay ? `~${formatTime(end)}` : `~${formatDate(end)} ${formatTime(end)}`;
  }
  return label;
};

export const splitSpotTitle = (title?: string | null) => {
  if (!title) {
    return { mainTitle: "", subTitle: "" };
  }
  const match = title.match(/(.+?)\s*\((.+)\)/);
  if (match) {
    return { mainTitle: match[1].trim(), subTitle: match[2].trim() };
  }
  return { mainTitle: title, subTitle: "" };
};

export const buildSpotCatchCopy = (spot?: Spot | null) => {
  if (!spot) return "";
  if (spot.speechBubble && spot.speechBubble.trim()) {
    return spot.speechBubble.trim();
  }
  if (spot.description) {
    const firstSentence = spot.description.split(/[。.!！？?]/)[0];
    return firstSentence.trim();
  }
  return spot.title;
};

export const buildSpotDetailItems = (spot?: Spot | null): SpotDetailListItem[] => {
  if (!spot) return [];
  const items: SpotDetailListItem[] = [];

  const contact = spot.contact;
  if (contact) {
    if (contact.phone) {
      items.push({
        key: "contact-phone",
        type: "contact",
        label: "電話",
        value: contact.phone,
        href: `tel:${contact.phone.replace(/\s+/g, "")}`
      });
    } else if (contact.email) {
      items.push({
        key: "contact-email",
        type: "contact",
        label: "メール",
        value: contact.email,
        href: `mailto:${contact.email}`
      });
    } else if (contact.sns) {
      const first = Object.entries(contact.sns).find(([, url]) => Boolean(url));
      if (first) {
        const [key, url] = first;
        if (url) {
          items.push({
            key: "contact-sns",
            type: "contact",
            label: key.toUpperCase(),
            value: url,
            href: url
          });
        }
      }
    }
  }

  const locationValue = (() => {
    if (spot.locationDetails && spot.locationDetails.trim().length > 0) return spot.locationDetails;
    if (spot.locationName && spot.locationName.trim().length > 0) return spot.locationName;
    return `緯度 ${spot.lat.toFixed(3)}, 経度 ${spot.lng.toFixed(3)}`;
  })();

  if (locationValue) {
    items.push({
      key: "location",
      type: "location",
      label: "場所",
      value: locationValue
    });
  }

  if (spot.pricing?.label) {
    items.push({
      key: "price",
      type: "price",
      label: "料金",
      value: spot.pricing.label
    });
  }

  return items;
};

export const buildExternalLinks = (spot?: Spot | null) => {
  if (!spot || !spot.externalLinks) return [];
  return spot.externalLinks.filter((link) => Boolean(link?.url));
};

export const buildMapSearchUrls = (spot: Spot) => {
  const query = encodeURIComponent(`${spot.title} ${spot.locationName ?? ""}`.trim());
  return {
    query,
    google: `https://www.google.com/maps/search/?api=1&query=${query}`,
    apple: `https://maps.apple.com/?q=${query}`
  };
};

export const collectSpotImages = (spot: Spot) => {
  const result: string[] = [];
  if (Array.isArray(spot.mediaUrls)) {
    spot.mediaUrls.forEach((url) => {
      if (typeof url === "string" && url.trim().length > 0) {
        result.push(url);
      }
    });
  }
  if (Array.isArray(spot.media)) {
    spot.media.forEach((entry) => {
      if (typeof entry === "string" && entry.trim().length > 0) {
        result.push(entry);
      } else if (entry && typeof entry === "object" && typeof entry.url === "string" && entry.url.trim().length > 0) {
        result.push(entry.url);
      }
    });
  }
  if (result.length === 0 && typeof spot.imageUrl === "string" && spot.imageUrl.trim().length > 0) {
    result.push(spot.imageUrl);
  }
  return result;
};
