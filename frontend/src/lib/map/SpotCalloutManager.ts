import type { Map as MapboxMap } from "mapbox-gl";

import type { MapTileFeature } from "../../types";
import { parseLocalTimestamp } from "./time";

type LampState = "idle" | "live" | "warning" | "off";

type CalloutEntry = {
  element: HTMLDivElement;
  update: (feature: MapTileFeature) => void;
  destroy: () => void;
  lngLat: [number, number];
  width: number;
  height: number;
};

const extractTimeLabel = (value?: string) => {
  const timestamp = parseLocalTimestamp(value);
  if (timestamp === null) return null;
  const date = new Date(timestamp);
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
};

const buildStatusLabel = (feature: MapTileFeature): string => {
  const status = feature.status;
  const spot = feature.spot;
  if (!status || !spot) {
    return "";
  }

  const startTimestamp = parseLocalTimestamp(spot.startTime);
  const endTimestamp = parseLocalTimestamp(spot.endTime);
  const startLabel = startTimestamp !== null ? extractTimeLabel(spot.startTime) : null;
  const endLabel = endTimestamp !== null ? extractTimeLabel(spot.endTime) : null;

  const rangeLabel = (() => {
    if (startLabel && endLabel) {
      return `${startLabel}~${endLabel}`;
    }
    if (startLabel) {
      return `${startLabel}~`;
    }
    if (endLabel) {
      return `~${endLabel}`;
    }
    return null;
  })();

  if (rangeLabel) {
    return rangeLabel;
  }

  if (status === "live") {
    return "開催中";
  }

  if (status === "upcoming") {
    return "まもなく";
  }

  if (status === "ended") {
    return "終了";
  }

  return "";
};

const deriveLampState = (feature: MapTileFeature): LampState => {
  const spot = feature.spot;
  if (!spot) {
    return "idle";
  }

  const start = parseLocalTimestamp(spot.startTime);
  const end = parseLocalTimestamp(spot.endTime);
  const now = Date.now();

  if (start !== null && end !== null && now >= start && now <= end) {
    const remainingMs = end - now;
    if (remainingMs <= 30 * 60 * 1000) {
      return "warning";
    }
    return "live";
  }

  if (start !== null && now < start) {
    return "idle";
  }

  if (end !== null && now > end) {
    return "off";
  }

  if (feature.status === "live") {
    return "live";
  }
  if (feature.status === "ended") {
    return "off";
  }
  return "idle";
};

const createCalloutDom = (
  feature: MapTileFeature,
  handleSelect: (spotId: string) => void
): { element: HTMLDivElement; update: (next: MapTileFeature) => void; destroy: () => void } => {
  const wrapper = document.createElement("div");
  wrapper.className = "map-callout";
  wrapper.dataset.spotId = feature.id;
  wrapper.setAttribute("role", "button");
  wrapper.tabIndex = 0;
  wrapper.style.position = "absolute";
  wrapper.style.left = "0";
  wrapper.style.top = "0";
  wrapper.style.transformOrigin = "top left";

  const bubble = document.createElement("div");
  bubble.className = "map-callout__bubble";
  bubble.tabIndex = -1;

  const lamp = document.createElement("span");
  lamp.className = "map-callout__lamp";

  const text = document.createElement("span");
  text.className = "map-callout__text";

  const status = document.createElement("span");
  status.className = "map-callout__status";

  const tail = document.createElement("span");
  tail.className = "map-callout__tail";

  const hostLabel = document.createElement("span");
  hostLabel.className = "map-callout__host";
  hostLabel.tabIndex = -1;

  bubble.append(lamp, text, status);
  wrapper.append(hostLabel, bubble, tail);

  const update = (next: MapTileFeature) => {
    wrapper.dataset.spotId = next.id;
    wrapper.classList.toggle("map-callout--premium", Boolean(next.premium));

    const lampState = deriveLampState(next);
    lamp.dataset.state = lampState;

    const bubbleText =
      next.spot?.speechBubble ||
      next.spot?.summary ||
      next.spot?.title ||
      next.spot?.ownerDisplayName ||
      next.spot?.ownerId ||
      "スポット";
    text.textContent = bubbleText;

    const label = buildStatusLabel(next);
    if (label) {
      status.textContent = label;
      status.style.display = "inline-flex";
    } else {
      status.textContent = "";
      status.style.display = "none";
    }

    const hostName = next.spot?.ownerDisplayName || next.spot?.ownerId || "";
    if (hostName.trim()) {
      hostLabel.textContent = hostName.trim();
      hostLabel.style.display = "inline-flex";
    } else {
      hostLabel.textContent = "";
      hostLabel.style.display = "none";
    }
  };

  const handleActivate = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    const spotId = wrapper.dataset.spotId;
    if (spotId) {
      handleSelect(spotId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      handleActivate(event);
    }
  };

  wrapper.addEventListener("click", handleActivate);
  wrapper.addEventListener("keydown", handleKeyDown);

  update(feature);

  const destroy = () => {
    wrapper.removeEventListener("click", handleActivate);
    wrapper.removeEventListener("keydown", handleKeyDown);
  };

  return { element: wrapper, update, destroy };
};

export class SpotCalloutManager {
  private map: MapboxMap;
  private container: HTMLDivElement;
  private entries = new Map<string, CalloutEntry>();
  private onSelect: (spotId: string) => void;

  constructor(map: MapboxMap, container: HTMLDivElement, onSelect: (spotId: string) => void) {
    this.map = map;
    this.container = container;
    this.onSelect = onSelect;
  }

  updateSelectHandler(onSelect: (spotId: string) => void) {
    this.onSelect = onSelect;
  }

  private measure(entry: CalloutEntry) {
    const rect = entry.element.getBoundingClientRect();
    entry.width = rect.width;
    entry.height = rect.height;
  }

  private position(entry: CalloutEntry) {
    const point = this.map.project(entry.lngLat);
    const x = point.x - entry.width / 2;
    const y = point.y - entry.height - 8;
    entry.element.style.transform = `translate(${x}px, ${y}px)`;
  }

  repositionAll() {
    this.entries.forEach((entry) => {
      this.position(entry);
    });
  }

  sync(features: MapTileFeature[]) {
    const activeIds = new Set(features.map((feature) => feature.id));

    this.entries.forEach((entry, spotId) => {
      if (!activeIds.has(spotId)) {
        entry.element.remove();
        entry.destroy();
        this.entries.delete(spotId);
      }
    });

    features.forEach((feature) => {
      const existing = this.entries.get(feature.id);
      if (existing) {
        existing.update(feature);
        existing.lngLat = [feature.geometry.lng, feature.geometry.lat];
        this.measure(existing);
        this.position(existing);
        return;
      }

      const { element, update, destroy } = createCalloutDom(feature, (spotId) => this.onSelect(spotId));
      this.container.appendChild(element);

      const entry: CalloutEntry = {
        element,
        update,
        destroy,
        lngLat: [feature.geometry.lng, feature.geometry.lat],
        width: 0,
        height: 0
      };

      this.measure(entry);
      this.position(entry);

      this.entries.set(feature.id, entry);
    });
  }

  clear() {
    this.entries.forEach((entry) => {
      entry.element.remove();
      entry.destroy();
    });
    this.entries.clear();
  }

  destroy() {
    this.clear();
  }
}
