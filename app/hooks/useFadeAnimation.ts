/**
 * 페이드 애니메이션 계산 훅
 */
import { useMemo } from 'react';
import { GREETING_FADE_START, GREETING_FADE_END, PHOTO_CARD_FADE_START, PHOTO_CARD_FADE_END } from '../constants/fadeConstants';

export const useFadeAnimation = (scrollProgress: number) => {
  const greetingFadeProgress = useMemo(() => {
    return GREETING_FADE_END > GREETING_FADE_START
      ? Math.min(
          Math.max((scrollProgress - GREETING_FADE_START) / (GREETING_FADE_END - GREETING_FADE_START), 0),
          1
        )
      : 1;
  }, [scrollProgress]);

  const photoCardFadeProgress = useMemo(() => {
    return PHOTO_CARD_FADE_END > PHOTO_CARD_FADE_START
      ? Math.min(
          Math.max((scrollProgress - PHOTO_CARD_FADE_START) / (PHOTO_CARD_FADE_END - PHOTO_CARD_FADE_START), 0),
          1
        )
      : 1;
  }, [scrollProgress]);

  const greetingFade = 1 - greetingFadeProgress;
  const photoCardFade = 1 - photoCardFadeProgress;
  const appsFade = Math.min(1, Math.max(0, 1 - greetingFade));

  return {
    greetingFade,
    photoCardFade,
    appsFade,
  };
};

