import type { MouseEvent } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import type { SpotDetailListItem } from "../lib/spotPresentation";

type ModernDetailListProps = {
  items: SpotDetailListItem[];
  onLinkClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

const iconNameMap: Record<SpotDetailListItem["type"], IconName> = {
  contact: "userFill",
  location: "mapLight",
  price: "currencyJpyFill"
};

export const ModernDetailList = ({ items, onLinkClick }: ModernDetailListProps) => {
  if (!items.length) return null;
  return (
    <div className="modern-detail-list">
      {items.map((item) => (
        <div className="modern-detail-item" key={item.key}>
          <div className="detail-icon">
            <Icon name={iconNameMap[item.type]} size={20} />
          </div>
          {item.href ? (
            <a
              href={item.href}
              className="detail-content"
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
              onClick={onLinkClick}
            >
              {item.value}
            </a>
          ) : (
            <div className="detail-content">{item.value}</div>
          )}
        </div>
      ))}
    </div>
  );
};
