import type { HTMLAttributes, ReactNode } from "react";

export type ModernHeroProps = {
  media: ReactNode;
  indicators?: ReactNode;
  socialButton?: ReactNode;
  className?: string;
  imageProps?: HTMLAttributes<HTMLDivElement>;
};

export const ModernHero = ({ media, indicators, socialButton, className = "", imageProps }: ModernHeroProps) => (
  <div className={`modern-hero ${className}`.trim()}>
    <div className="modern-hero-image" {...imageProps}>
      {media}
      {indicators}
      {socialButton}
    </div>
  </div>
);

export const ModernHeroPlaceholder = ({ label }: { label: string }) => (
  <div className="modern-hero-placeholder">{label}</div>
);
