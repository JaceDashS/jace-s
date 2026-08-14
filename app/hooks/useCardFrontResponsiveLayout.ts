import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { Language } from '../types/mainContent';
import {
  BUTTON_MAX_FACTOR,
  CARD_WIDTH as BUTTON_CARD_WIDTH,
  BUTTON_PADDING,
  BUTTON_FONT,
  ICON_SIZE,
} from '../constants/buttonConstants';

const RESPONSIVE_CONFIG = {
  CARD_WIDTH: {
    MIN: 400,
    MAX: 1200,
  },
  GREETING_FONT: {
    FIT_MIN: 0.75,
    COMPACT_MIN: 1,
    COMPACT_MAX: 2,
    SHORT_MIN: 0.75,
    MIN: 1.5,
    MAX: 4.5,
  },
  DESCRIPTION_FONT: {
    FIT_MIN: 0.5,
    COMPACT_MIN: 0.625,
    COMPACT_MAX: 1.125,
    SHORT_MIN: 0.6,
    MIN: 1,
    MAX: 2,
  },
  CONTENT_FIT: {
    ACTION_GAP_PX: 16,
    CONTENT_GAP_PX: 10,
    SEARCH_STEPS: 10,
    TITLE_OFFSET_MAX_PX: 48,
    PHOTO_GAP_PX: 16,
    PHOTO_MIN_HEIGHT_PX: 96,
    PHOTO_MAX_HEIGHT_PX: 208,
    PHOTO_REMAINING_SPACE_PX: 24,
    PHOTO_TWO_COUNT_HEIGHT_PX: 132,
    PHOTO_THREE_COUNT_HEIGHT_PX: 184,
  },
  COMPACT_BUTTON_SCALE: {
    MIN: 0.62,
    WIDTH_REFERENCE_PX: 400,
    HEIGHT_REFERENCE_PX: 520,
  },
  DESKTOP_HEIGHT_SCALE: {
    MIN: 0.72,
    SHORT_MIN: 0.42,
    SHORT_HEIGHT_PX: 480,
    REFERENCE_PX: 720,
  },
  SMALL_BUTTON_PADDING: {
    MIN_PX: 4,
    MAX_PX: 8,
    MIN_PY: 2,
    MAX_PY: 4,
  },
} as const;

interface UseCardFrontResponsiveLayoutOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  fadeContainerRef: RefObject<HTMLDivElement | null>;
  descriptionRef: RefObject<HTMLParagraphElement | null>;
  buttonGroupRef: RefObject<HTMLDivElement | null>;
  greetingClassName: string;
  compactTypography: boolean;
  greetingText: string;
  isCompactHome: boolean;
  language: Language;
  layoutActive: boolean;
  nameSuffix: string;
  profileDescription: string;
  profileName: string;
}

export interface CardFrontResponsiveLayout {
  fontSize: string;
  descriptionFontSize: string;
  buttonPadding: { px: number; py: number };
  smallButtonPadding: { px: number; py: number };
  buttonFontSize: string;
  iconSize: string;
  homePhotoLayout: { height: number; count: number };
}

export function useCardFrontResponsiveLayout({
  containerRef,
  fadeContainerRef,
  descriptionRef,
  buttonGroupRef,
  greetingClassName,
  compactTypography,
  greetingText,
  isCompactHome,
  language,
  layoutActive,
  nameSuffix,
  profileDescription,
  profileName,
}: UseCardFrontResponsiveLayoutOptions): CardFrontResponsiveLayout {
  const [fontSize, setFontSize] = useState(
    `${compactTypography ? RESPONSIVE_CONFIG.GREETING_FONT.COMPACT_MAX : RESPONSIVE_CONFIG.GREETING_FONT.MAX}rem`
  );
  const [descriptionFontSize, setDescriptionFontSize] = useState(
    `${compactTypography ? RESPONSIVE_CONFIG.DESCRIPTION_FONT.COMPACT_MAX : RESPONSIVE_CONFIG.DESCRIPTION_FONT.MAX}rem`
  );
  const initialButtonMaxPx = BUTTON_PADDING.MAX_PX * BUTTON_MAX_FACTOR;
  const initialButtonMaxPy = BUTTON_PADDING.MAX_PY * BUTTON_MAX_FACTOR;
  const initialSmallMaxPx = RESPONSIVE_CONFIG.SMALL_BUTTON_PADDING.MAX_PX * BUTTON_MAX_FACTOR;
  const initialSmallMaxPy = RESPONSIVE_CONFIG.SMALL_BUTTON_PADDING.MAX_PY * BUTTON_MAX_FACTOR;
  const initialButtonFontMax = BUTTON_FONT.MAX * BUTTON_MAX_FACTOR;
  const initialIconSizeMax = ICON_SIZE.MAX * BUTTON_MAX_FACTOR;

  const [buttonPadding, setButtonPadding] = useState<{ px: number; py: number }>({
    px: initialButtonMaxPx,
    py: initialButtonMaxPy,
  });
  const [smallButtonPadding, setSmallButtonPadding] = useState<{ px: number; py: number }>({
    px: initialSmallMaxPx,
    py: initialSmallMaxPy,
  });
  const [buttonFontSize, setButtonFontSize] = useState(`${initialButtonFontMax}rem`);
  const [iconSize, setIconSize] = useState(`${initialIconSizeMax}rem`);
  const [homePhotoLayout, setHomePhotoLayout] = useState({ height: 0, count: 0 });

  useLayoutEffect(() => {
    const updateSizes = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const containerHeight = containerRef.current.offsetHeight;
      const { MIN: minWidth, MAX: maxWidth } = RESPONSIVE_CONFIG.CARD_WIDTH;
      const { MIN: buttonMinWidth, MAX: buttonMaxWidth } = BUTTON_CARD_WIDTH;

      const interpolate = (min: number, max: number, width: number): number => {
        if (width <= minWidth) return min;
        if (width >= maxWidth) return max;
        const ratio = (width - minWidth) / (maxWidth - minWidth);
        return min + (max - min) * ratio;
      };

      let greetingSizeRem = interpolate(
        RESPONSIVE_CONFIG.GREETING_FONT.MIN,
        RESPONSIVE_CONFIG.GREETING_FONT.MAX,
        containerWidth
      );
      let descSizeRem = interpolate(
        RESPONSIVE_CONFIG.DESCRIPTION_FONT.MIN,
        RESPONSIVE_CONFIG.DESCRIPTION_FONT.MAX,
        containerWidth
      );
      const isShortDesktop = !compactTypography &&
        containerHeight < RESPONSIVE_CONFIG.DESKTOP_HEIGHT_SCALE.SHORT_HEIGHT_PX;
      const desktopHeightScale = compactTypography
        ? 1
        : Math.max(
            isShortDesktop
              ? RESPONSIVE_CONFIG.DESKTOP_HEIGHT_SCALE.SHORT_MIN
              : RESPONSIVE_CONFIG.DESKTOP_HEIGHT_SCALE.MIN,
            Math.min(
              1,
              containerHeight / RESPONSIVE_CONFIG.DESKTOP_HEIGHT_SCALE.REFERENCE_PX
            )
          );

      if (!compactTypography) {
        greetingSizeRem = Math.max(
          isShortDesktop
            ? RESPONSIVE_CONFIG.GREETING_FONT.SHORT_MIN
            : RESPONSIVE_CONFIG.GREETING_FONT.MIN,
          greetingSizeRem * desktopHeightScale
        );
        descSizeRem = Math.max(
          isShortDesktop
            ? RESPONSIVE_CONFIG.DESCRIPTION_FONT.SHORT_MIN
            : RESPONSIVE_CONFIG.DESCRIPTION_FONT.MIN,
          descSizeRem * desktopHeightScale
        );
      }

      if (compactTypography) {
        const fadeContainer = fadeContainerRef.current;
        const greetingElement = fadeContainer?.querySelector<HTMLElement>(`.${greetingClassName}`);
        const descriptionElement = descriptionRef.current;
        const descriptionContainer = descriptionElement?.parentElement;
        const buttonGroup = buttonGroupRef.current;

        greetingSizeRem = RESPONSIVE_CONFIG.GREETING_FONT.COMPACT_MIN;
        descSizeRem = RESPONSIVE_CONFIG.DESCRIPTION_FONT.COMPACT_MIN;

        if (fadeContainer && greetingElement) {
          const fadeRect = fadeContainer.getBoundingClientRect();
          const buttonRect = buttonGroup?.getBoundingClientRect();
          const actionReserve = buttonRect
            ? Math.max(
                0,
                fadeRect.bottom - buttonRect.top + RESPONSIVE_CONFIG.CONTENT_FIT.ACTION_GAP_PX
              )
            : 0;

          fadeContainer.style.setProperty('--home-actions-reserve', `${actionReserve}px`);
          fadeContainer.style.setProperty('--home-title-offset', '0px');

          const previousGreetingSize = greetingElement.style.fontSize;
          const previousDescriptionSize = descriptionElement?.style.fontSize ?? '';
          const getPreferredCandidateSizes = (ratio: number) => ({
            greeting:
              RESPONSIVE_CONFIG.GREETING_FONT.COMPACT_MIN +
              (RESPONSIVE_CONFIG.GREETING_FONT.COMPACT_MAX -
                RESPONSIVE_CONFIG.GREETING_FONT.COMPACT_MIN) * ratio,
            description:
              RESPONSIVE_CONFIG.DESCRIPTION_FONT.COMPACT_MIN +
              (RESPONSIVE_CONFIG.DESCRIPTION_FONT.COMPACT_MAX -
                RESPONSIVE_CONFIG.DESCRIPTION_FONT.COMPACT_MIN) * ratio,
          });
          const getEmergencyCandidateSizes = (ratio: number) => ({
            greeting:
              RESPONSIVE_CONFIG.GREETING_FONT.FIT_MIN +
              (RESPONSIVE_CONFIG.GREETING_FONT.COMPACT_MIN -
                RESPONSIVE_CONFIG.GREETING_FONT.FIT_MIN) * ratio,
            description:
              RESPONSIVE_CONFIG.DESCRIPTION_FONT.FIT_MIN +
              (RESPONSIVE_CONFIG.DESCRIPTION_FONT.COMPACT_MIN -
                RESPONSIVE_CONFIG.DESCRIPTION_FONT.FIT_MIN) * ratio,
          });
          const candidateFits = (candidate: { greeting: number; description: number }) => {
            greetingElement.style.fontSize = `${candidate.greeting}rem`;
            if (descriptionElement) {
              descriptionElement.style.fontSize = `${candidate.description}rem`;
            }

            const greetingFits =
              greetingElement.getBoundingClientRect().bottom <=
              fadeContainer.getBoundingClientRect().bottom - actionReserve + 1;
            const descriptionFits =
              !descriptionElement ||
              !descriptionContainer ||
              descriptionElement.scrollHeight <= descriptionContainer.clientHeight + 1;

            return greetingFits && descriptionFits;
          };

          const findLargestFittingCandidate = (
            getCandidateSizes: (ratio: number) => { greeting: number; description: number }
          ) => {
            const smallestCandidate = getCandidateSizes(0);
            if (!candidateFits(smallestCandidate)) {
              return smallestCandidate;
            }

            const largestCandidate = getCandidateSizes(1);
            if (candidateFits(largestCandidate)) {
              return largestCandidate;
            }

            let lowerRatio = 0;
            let upperRatio = 1;

            for (let step = 0; step < RESPONSIVE_CONFIG.CONTENT_FIT.SEARCH_STEPS; step += 1) {
              const candidateRatio = (lowerRatio + upperRatio) / 2;
              if (candidateFits(getCandidateSizes(candidateRatio))) {
                lowerRatio = candidateRatio;
              } else {
                upperRatio = candidateRatio;
              }
            }

            return getCandidateSizes(lowerRatio);
          };

          const preferredMinimum = getPreferredCandidateSizes(0);
          const fittedSizes = candidateFits(preferredMinimum)
            ? findLargestFittingCandidate(getPreferredCandidateSizes)
            : findLargestFittingCandidate(getEmergencyCandidateSizes);
          greetingSizeRem = fittedSizes.greeting;
          descSizeRem = fittedSizes.description;
          candidateFits(fittedSizes);

          const contentGap = descriptionElement
            ? RESPONSIVE_CONFIG.CONTENT_FIT.CONTENT_GAP_PX
            : 0;
          const safeContentHeight = fadeContainer.clientHeight - actionReserve;
          const naturalContentHeight =
            greetingElement.getBoundingClientRect().height +
            (descriptionElement?.scrollHeight ?? 0) +
            contentGap;
          const emptyContentHeight = Math.max(0, safeContentHeight - naturalContentHeight);
          const availablePhotoHeight = Math.floor(
            emptyContentHeight -
            RESPONSIVE_CONFIG.CONTENT_FIT.PHOTO_GAP_PX -
            RESPONSIVE_CONFIG.CONTENT_FIT.PHOTO_REMAINING_SPACE_PX
          );
          const nextPhotoHeight = isCompactHome &&
            availablePhotoHeight >= RESPONSIVE_CONFIG.CONTENT_FIT.PHOTO_MIN_HEIGHT_PX
            ? Math.min(
                availablePhotoHeight,
                RESPONSIVE_CONFIG.CONTENT_FIT.PHOTO_MAX_HEIGHT_PX
              )
            : 0;
          const nextPhotoCount = nextPhotoHeight >=
            RESPONSIVE_CONFIG.CONTENT_FIT.PHOTO_THREE_COUNT_HEIGHT_PX
            ? 3
            : nextPhotoHeight >= RESPONSIVE_CONFIG.CONTENT_FIT.PHOTO_TWO_COUNT_HEIGHT_PX
              ? 2
              : nextPhotoHeight > 0
                ? 1
                : 0;

          setHomePhotoLayout((currentLayout) => {
            if (
              currentLayout.height === nextPhotoHeight &&
              currentLayout.count === nextPhotoCount
            ) {
              return currentLayout;
            }

            return { height: nextPhotoHeight, count: nextPhotoCount };
          });

          const photoReserve = nextPhotoHeight > 0
            ? nextPhotoHeight + RESPONSIVE_CONFIG.CONTENT_FIT.PHOTO_GAP_PX
            : 0;
          const availableTitleOffset = Math.max(
            0,
            (safeContentHeight - naturalContentHeight - photoReserve) / 2
          );
          const titleOffset = Math.min(
            availableTitleOffset,
            RESPONSIVE_CONFIG.CONTENT_FIT.TITLE_OFFSET_MAX_PX
          );
          fadeContainer.style.setProperty('--home-title-offset', `${titleOffset}px`);

          greetingElement.style.fontSize = previousGreetingSize;
          if (descriptionElement) {
            descriptionElement.style.fontSize = previousDescriptionSize;
          }
        }
      }

      const greetingSize = `${greetingSizeRem}rem`;
      const descSize = `${descSizeRem}rem`;
      const buttonMaxPx = BUTTON_PADDING.MAX_PX * BUTTON_MAX_FACTOR;
      const buttonMaxPy = BUTTON_PADDING.MAX_PY * BUTTON_MAX_FACTOR;
      const smallMaxPx = RESPONSIVE_CONFIG.SMALL_BUTTON_PADDING.MAX_PX * BUTTON_MAX_FACTOR;
      const smallMaxPy = RESPONSIVE_CONFIG.SMALL_BUTTON_PADDING.MAX_PY * BUTTON_MAX_FACTOR;
      const buttonFontMax = BUTTON_FONT.MAX * BUTTON_MAX_FACTOR;
      const iconSizeMax = ICON_SIZE.MAX * BUTTON_MAX_FACTOR;

      const buttonInterpolate = (min: number, max: number, width: number): number => {
        if (width <= buttonMinWidth) return min;
        if (width >= buttonMaxWidth) return max;
        const ratio = (width - buttonMinWidth) / (buttonMaxWidth - buttonMinWidth);
        return min + (max - min) * ratio;
      };
      const controlScale = compactTypography
        ? Math.max(
            RESPONSIVE_CONFIG.COMPACT_BUTTON_SCALE.MIN,
            Math.min(
              1,
              containerWidth / RESPONSIVE_CONFIG.COMPACT_BUTTON_SCALE.WIDTH_REFERENCE_PX,
              containerHeight / RESPONSIVE_CONFIG.COMPACT_BUTTON_SCALE.HEIGHT_REFERENCE_PX
            )
          )
        : desktopHeightScale;
      const desktopControlMinimumScale = isShortDesktop
        ? 0.6
        : 1;
      const desktopPaddingMinimumScale = isShortDesktop ? 0.35 : 1;
      const scaleControl = (value: number, minimum: number) => compactTypography
        ? value * controlScale
        : Math.max(minimum * desktopControlMinimumScale, value * controlScale);
      const scalePadding = (value: number, minimum: number) => compactTypography
        ? value * controlScale
        : Math.max(minimum * desktopPaddingMinimumScale, value * controlScale);

      const buttonPx = scalePadding(
        buttonInterpolate(BUTTON_PADDING.MIN_PX, buttonMaxPx, containerWidth),
        BUTTON_PADDING.MIN_PX
      );
      const buttonPy = scalePadding(
        buttonInterpolate(BUTTON_PADDING.MIN_PY, buttonMaxPy, containerWidth),
        BUTTON_PADDING.MIN_PY
      );
      const smallPx = scalePadding(
        buttonInterpolate(
          RESPONSIVE_CONFIG.SMALL_BUTTON_PADDING.MIN_PX,
          smallMaxPx,
          containerWidth
        ),
        RESPONSIVE_CONFIG.SMALL_BUTTON_PADDING.MIN_PX
      );
      const smallPy = scalePadding(
        buttonInterpolate(
          RESPONSIVE_CONFIG.SMALL_BUTTON_PADDING.MIN_PY,
          smallMaxPy,
          containerWidth
        ),
        RESPONSIVE_CONFIG.SMALL_BUTTON_PADDING.MIN_PY
      );
      const buttonFontSizeRem = scaleControl(
        buttonInterpolate(BUTTON_FONT.MIN, buttonFontMax, containerWidth),
        BUTTON_FONT.MIN
      );
      const newButtonFontSize = `${buttonFontSizeRem}rem`;
      const iconSizeRem = scaleControl(
        buttonInterpolate(ICON_SIZE.MIN, iconSizeMax, containerWidth),
        ICON_SIZE.MIN
      );
      const newIconSize = `${iconSizeRem}rem`;

      setFontSize(greetingSize);
      setDescriptionFontSize(descSize);
      setButtonPadding({ px: buttonPx, py: buttonPy });
      setSmallButtonPadding({ px: smallPx, py: smallPy });
      setButtonFontSize(newButtonFontSize);
      setIconSize(newIconSize);
    };

    updateSizes();

    const resizeObserver = new ResizeObserver(() => {
      updateSizes();
    });
    let refreshFrameId: number | null = null;
    const refreshRestoredLayout = () => {
      if (refreshFrameId !== null) {
        window.cancelAnimationFrame(refreshFrameId);
      }
      refreshFrameId = window.requestAnimationFrame(() => {
        refreshFrameId = null;
        updateSizes();
      });
    };

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    if (fadeContainerRef.current) {
      resizeObserver.observe(fadeContainerRef.current);
    }
    if (buttonGroupRef.current) {
      resizeObserver.observe(buttonGroupRef.current);
    }
    window.addEventListener('pageshow', refreshRestoredLayout);
    window.addEventListener('orientationchange', refreshRestoredLayout);
    window.visualViewport?.addEventListener('resize', refreshRestoredLayout);

    return () => {
      if (refreshFrameId !== null) {
        window.cancelAnimationFrame(refreshFrameId);
      }
      resizeObserver.disconnect();
      window.removeEventListener('pageshow', refreshRestoredLayout);
      window.removeEventListener('orientationchange', refreshRestoredLayout);
      window.visualViewport?.removeEventListener('resize', refreshRestoredLayout);
    };
  }, [
    buttonGroupRef,
    compactTypography,
    containerRef,
    descriptionRef,
    fadeContainerRef,
    greetingClassName,
    greetingText,
    isCompactHome,
    language,
    layoutActive,
    nameSuffix,
    profileDescription,
    profileName,
  ]);

  return {
    fontSize,
    descriptionFontSize,
    buttonPadding,
    smallButtonPadding,
    buttonFontSize,
    iconSize,
    homePhotoLayout,
  };
}
