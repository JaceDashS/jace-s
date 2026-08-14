import { useEffect } from 'react';

interface UseMainContentRouteSyncOptions {
  pathname: string;
  showContent: boolean;
  isAnimating: boolean;
}

const ROUTE_SCROLL_PROGRESS: Record<string, number> = {
  '/home': 0,
  '/apps': 1.5,
  '/comments': 3,
};

export function useMainContentRouteSync({
  pathname,
  showContent,
  isAnimating,
}: UseMainContentRouteSyncOptions): void {
  useEffect(() => {
    if (!showContent || !isAnimating) return;

    const progress = ROUTE_SCROLL_PROGRESS[pathname];
    if (progress === undefined) return;

    const scrollToProgress = () => {
      window.scrollTo({
        top: window.innerHeight * progress,
        behavior: 'smooth',
      });
    };

    window.setTimeout(scrollToProgress, 100);
  }, [pathname, showContent, isAnimating]);
}
