import type { HTMLAttributes, ReactNode } from "react";

export type ModernHeroProps = {
  media: ReactNode;
  header?: ReactNode;
  indicators?: ReactNode;
  socialButton?: ReactNode;
  className?: string;
  imageProps?: HTMLAttributes<HTMLDivElement>;
};

export const ModernHero = ({ media, header, indicators, socialButton, className = "", imageProps }: ModernHeroProps) => (
  <div className={`modern-hero ${className}`.trim()}>
    <div className="modern-hero-image" {...imageProps}>
      {media}
      {header}
      {indicators}
      {socialButton}
    </div>
  </div>
);

export const ModernHeroPlaceholder = ({ label }: { label: string }) => (
  <div className="modern-hero-placeholder">{label}</div>
);
