import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

const PHOTO_COVER_TRACKING_MS = 400;

interface UseDesktopPhotoCardFadeOptions {
  leftCardRef: RefObject<HTMLDivElement | null>;
  rightCardRef: RefObject<HTMLDivElement | null>;
  isAnimating: boolean;
  scrollProgress: number;
  showContent: boolean;
}

export function useDesktopPhotoCardFade({
  leftCardRef,
  rightCardRef,
  isAnimating,
  scrollProgress,
  showContent,
}: UseDesktopPhotoCardFadeOptions): number {
  const [desktopPhotoCardFade, setDesktopPhotoCardFade] = useState(1);

  useEffect(() => {
    if (!showContent || !isAnimating || !window.matchMedia('(min-width: 601px)').matches) {
      return;
    }

    let frameId: number | null = null;
    const trackingStartedAt = performance.now();

    const updatePhotoAtActualCover = () => {
      const leftCard = leftCardRef.current;
      const rightCard = rightCardRef.current;
      if (!leftCard || !rightCard) {
        return;
      }

      const leftRect = leftCard.getBoundingClientRect();
      const rightRect = rightCard.getBoundingClientRect();
      const leftCenter = leftRect.left + leftRect.width / 2;
      const rightCenter = rightRect.left + rightRect.width / 2;
      const nextFade = leftCenter < rightCenter ? 1 : 0;

      setDesktopPhotoCardFade((currentFade) => (
        currentFade === nextFade ? currentFade : nextFade
      ));

      if (performance.now() - trackingStartedAt < PHOTO_COVER_TRACKING_MS) {
        frameId = requestAnimationFrame(updatePhotoAtActualCover);
      }
    };

    frameId = requestAnimationFrame(updatePhotoAtActualCover);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isAnimating, leftCardRef, rightCardRef, scrollProgress, showContent]);

  return desktopPhotoCardFade;
}
