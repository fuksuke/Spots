import { CSSProperties, ReactNode, useMemo, useRef, useState } from "react";
import { SpotCategory } from "../types";

import { Icon } from "./Icon";

type CategoryOption = {
  key: SpotCategory | "all" | string;
  label: ReactNode;
  color?: string;
};

type CategoryTabsProps = {
  options: CategoryOption[];
  activeKey: CategoryOption["key"];
  onSelect: (key: CategoryOption["key"]) => void;
  onSearchToggle?: () => void;
  onManageCategories?: () => void;
};

export const CategoryTabs = ({
  options,
  activeKey,
  onSelect,
  onSearchToggle,
  onManageCategories
}: CategoryTabsProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const [isDragging, setDragging] = useState(false);

  const templateOptions = useMemo(() => options, [options]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    startXRef.current = event.clientX;
    pointerIdRef.current = event.pointerId;
    setDragging(false);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollRef.current;
    if (!container) return;
    if (event.buttons === 0) {
      return;
    }

    const delta = event.clientX - startXRef.current;
    if (!draggingRef.current) {
      if (Math.abs(delta) > 6) {
        draggingRef.current = true;
        setDragging(true);
        if (!container.hasPointerCapture(event.pointerId)) {
          container.setPointerCapture(event.pointerId);
        }
      } else {
        return;
      }
    }

    event.preventDefault();
    container.scrollBy({ left: -delta });
    startXRef.current = event.clientX;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    setDragging(false);
    const container = scrollRef.current;
    if (container?.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    pointerIdRef.current = null;
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    handlePointerUp(event);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const container = scrollRef.current;
    if (!container) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      event.preventDefault();
      container.scrollBy({ left: event.deltaX });
    }
  };

  return (
    <div className={`category-tabs ${isDragging ? "dragging" : ""}`.trim()} role="tablist" aria-label="カテゴリ">
      <div
        className="category-scroll"
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
      >
        {onSearchToggle ? (
          <button
            type="button"
            className="category-pill search"
            onClick={onSearchToggle}
            aria-label="検索バーを開く"
          >
            <Icon name="search" wrapperClassName="category-search-icon" label="検索" />
            <span>検索</span>
          </button>
        ) : null}
        {templateOptions.map((option) => {
          const style: CSSProperties = option.color
            ? ({
                "--tab-color": option.color
              } as CSSProperties)
            : {};
          return (
            <button
              key={String(option.key)}
              type="button"
              role="tab"
              className={`category-pill inline ${activeKey === option.key ? "active" : ""}`.trim()}
              onClick={() => onSelect(option.key)}
              style={style}
            >
              {option.label}
            </button>
          );
        })}
        {onManageCategories ? (
          <button
            type="button"
            className="category-pill inline more"
            onClick={onManageCategories}
            aria-label="カテゴリをカスタマイズ"
          >
            <span className="category-inline-content">
              <Icon name="menu" wrapperClassName="category-inline-icon" />
              <span>もっと</span>
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
};
