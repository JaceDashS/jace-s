import { useEffect } from 'react';
import type { RefObject } from 'react';

const PADDING_CONFIG = {
  TOP_PADDING_MAX: 100,
  BOTTOM_PADDING_THRESHOLD: 48,
  BOTTOM_PADDING_MIN: 32,
} as const;

interface UseCardFrontPaddingOptions {
  fadeContainerRef: RefObject<HTMLDivElement | null>;
  descriptionRef: RefObject<HTMLParagraphElement | null>;
  greetingClassName: string;
  compactTypography: boolean;
  profileDescription: string;
}

export function useCardFrontPadding({
  fadeContainerRef,
  descriptionRef,
  greetingClassName,
  compactTypography,
  profileDescription,
}: UseCardFrontPaddingOptions): void {
  useEffect(() => {
    if (compactTypography) return;

    const updatePadding = () => {
      const fadeContainer = fadeContainerRef.current;
      const descriptionText = descriptionRef.current;
      const greetingElement = fadeContainer?.querySelector(`.${greetingClassName}`);

      if (!fadeContainer || !greetingElement) return;

      const containerHeight = fadeContainer.clientHeight;
      const greetingHeight = greetingElement.clientHeight;
      const descriptionHeight = descriptionText?.clientHeight ?? 0;
      const availableSpace = Math.max(0, containerHeight - greetingHeight - descriptionHeight);

      let bottomPadding = Math.max(availableSpace / 2, PADDING_CONFIG.BOTTOM_PADDING_MIN);
      let topPadding = Math.max(0, availableSpace - bottomPadding);

      if (bottomPadding <= PADDING_CONFIG.BOTTOM_PADDING_THRESHOLD) {
        const ratio = bottomPadding / PADDING_CONFIG.BOTTOM_PADDING_THRESHOLD;
        topPadding = Math.max(0, topPadding * ratio);
        bottomPadding = Math.max(availableSpace - topPadding, PADDING_CONFIG.BOTTOM_PADDING_MIN);
        topPadding = Math.max(0, availableSpace - bottomPadding);
      }

      if (topPadding > PADDING_CONFIG.TOP_PADDING_MAX) {
        topPadding = PADDING_CONFIG.TOP_PADDING_MAX;
        bottomPadding = Math.max(availableSpace - topPadding, PADDING_CONFIG.BOTTOM_PADDING_MIN);
        topPadding = Math.max(0, availableSpace - bottomPadding);
      }

      fadeContainer.style.setProperty('--top-padding', `${topPadding}px`);
      fadeContainer.style.setProperty('--bottom-padding', `${bottomPadding}px`);
    };

    const timeoutId = setTimeout(updatePadding, 100);
    const resizeObserver = new ResizeObserver(updatePadding);

    if (fadeContainerRef.current) {
      resizeObserver.observe(fadeContainerRef.current);
    }
    if (descriptionRef.current) {
      resizeObserver.observe(descriptionRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [compactTypography, descriptionRef, fadeContainerRef, greetingClassName, profileDescription]);
}
