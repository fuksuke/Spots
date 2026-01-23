
import { ReactNode, RefObject } from "react";
// We might need to move layout styles here or ensure they are global

export type ScrollMode = "fixed" | "fluid";

type MainLayoutProps = {
    sidebar: ReactNode;
    header: ReactNode;
    actionBar: ReactNode;
    children: ReactNode;
    layoutRef?: RefObject<HTMLDivElement>;
    className?: string;
    scrollMode?: ScrollMode;
};

export const MainLayout = ({
    sidebar,
    header,
    actionBar,
    children,
    layoutRef,
    className = "",
    scrollMode = "fixed"
}: MainLayoutProps) => {
    return (
        <div className={`app-shell layout-${scrollMode}`}>
            {sidebar}
            <div ref={layoutRef} className={`layout-column ${className}`}>
                {header}
                {children}
                {actionBar}
            </div>
        </div>
    );
};
