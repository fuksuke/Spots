import { useRef, useEffect, useState } from "react";

/**
 * Hook to find the correct scrollable ancestor.
 * In "fluid" layout (native scroll), this is the window/document.
 * In "fixed" layout (app scroll), this is the nearest scrollable entry (often .app-main or .content-area).
 */
export function useScrollParent(elementRef: React.RefObject<HTMLElement>) {
    const [scrollParent, setScrollParent] = useState<HTMLElement | Window | null>(null);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        // Check if we are in a fluid layout (native scroll)
        // We can interpret this by checking if document body has overflow-y: auto 
        // or simply by checking if the nearest .app-shell has .layout-fluid
        const shell = element.closest('.app-shell');
        const isFluid = shell?.classList.contains('layout-fluid');

        if (isFluid) {
            setScrollParent(window);
            return;
        }

        // Otherwise, find the nearest scrollable container
        let parent = element.parentElement;
        while (parent) {
            const style = window.getComputedStyle(parent);
            const overflowY = style.overflowY;
            if (overflowY === 'auto' || overflowY === 'scroll') {
                setScrollParent(parent);
                return;
            }
            parent = parent.parentElement;
        }

        // Fallback to window/root if no scroll container found
        setScrollParent(window);
    }, [elementRef]);

    return scrollParent;
}
