'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, TransitionEvent } from 'react';
import type { App } from '../types/app';
import type { Language } from '../types/mainContent';
import useMediaQuery from '../hooks/useMediaQuery';
import CardBack from './Card/CardBack';
import CardFront from './Card/CardFront';
import CommentSection from './Card/CommentSection';
import RightCardContent from './Card/RightCardContent';
import styles from './MobileContent.module.css';

interface MobileContentProps {
  visible: boolean;
  apps: App[];
  currentProjectPage: number;
  setCurrentProjectPage: (page: number | ((prev: number) => number)) => void;
  language: Language;
  setLanguage: (language: Language) => void;
  certificationText: Record<Language, string>;
  profileName: string;
  profileDescription: string;
  profileLinks?: Record<string, string>;
  greetingText: string;
  nameSuffix: string;
}

const cardIndexes = [0, 1, 2] as const;
const cardAccentChannels = ['168 85 247', '34 211 238', '244 114 182'] as const;
type HomeFace = 'home' | 'certificate' | 'certificateDetail';
const SWIPE_THRESHOLD = 0.3;
const SWIPE_START_THRESHOLD_PX = 12;
const VERTICAL_SCROLL_THRESHOLD_PX = 24;
const FULL_FLIP_DURATION_MS = 280;
const CARD_UNMOUNT_DELAY_MS = 400;
const SWIPE_COACH_DURATION_MS = 3200;
const MOBILE_MEDIA_QUERY = '(max-width: 600px)';
const swipeCoachCopy: Record<Language, { title: string; description: string }> = {
  en: {
    title: 'Swipe to explore',
    description: 'Move between Home, Apps, and Comments',
  },
  ko: {
    title: '밀어서 둘러보기',
    description: '홈, 앱, 댓글 카드를 이동해 보세요',
  },
  ja: {
    title: 'スワイプして見る',
    description: 'ホーム・アプリ・コメントを移動できます',
  },
  zh: {
    title: '滑动浏览',
    description: '在主页、应用和评论卡片之间切换',
  },
};

const mobileUiCopy: Record<Language, {
  portfolioLabel: string;
  languageSelector: string;
  cardRegion: string;
  cardSelection: string;
  cards: readonly [string, string, string];
  cardLabel: (cardName: string) => string;
  goToCard: (cardName: string) => string;
  back: string;
}> = {
  en: {
    portfolioLabel: 'Mobile portfolio',
    languageSelector: 'Select language',
    cardRegion: 'Card area. Use the left and right arrow keys or swipe to change cards.',
    cardSelection: 'Select card',
    cards: ['Home', 'Apps', 'Comments'],
    cardLabel: (cardName) => `${cardName} card`,
    goToCard: (cardName) => `Go to ${cardName} card`,
    back: 'Back',
  },
  ko: {
    portfolioLabel: '모바일 포트폴리오',
    languageSelector: '언어 선택',
    cardRegion: '카드 영역. 좌우 화살표 키 또는 스와이프로 카드를 전환할 수 있습니다.',
    cardSelection: '카드 선택',
    cards: ['홈', '앱', '댓글'],
    cardLabel: (cardName) => `${cardName} 카드`,
    goToCard: (cardName) => `${cardName} 카드로 이동`,
    back: '뒤로',
  },
  ja: {
    portfolioLabel: 'モバイルポートフォリオ',
    languageSelector: '言語を選択',
    cardRegion: 'カード領域。左右の矢印キーまたはスワイプでカードを切り替えられます。',
    cardSelection: 'カードを選択',
    cards: ['ホーム', 'アプリ', 'コメント'],
    cardLabel: (cardName) => `${cardName}カード`,
    goToCard: (cardName) => `${cardName}カードへ移動`,
    back: '戻る',
  },
  zh: {
    portfolioLabel: '移动端作品集',
    languageSelector: '选择语言',
    cardRegion: '卡片区域。使用左右方向键或滑动切换卡片。',
    cardSelection: '选择卡片',
    cards: ['首页', '应用', '评论'],
    cardLabel: (cardName) => `${cardName}卡片`,
    goToCard: (cardName) => `前往${cardName}卡片`,
    back: '返回',
  },
};

export default function MobileContent({
  visible,
  apps,
  currentProjectPage,
  setCurrentProjectPage,
  language,
  setLanguage,
  certificationText,
  profileName,
  profileDescription,
  profileLinks,
  greetingText,
  nameSuffix,
}: MobileContentProps) {
  const uiCopy = mobileUiCopy[language];
  const touchStateRef = useRef({
    active: false,
    pointerId: -1,
    captured: false,
    startX: 0,
    startY: 0,
    width: 1,
    originCard: 0,
    originHomeFace: 'home' as HomeFace,
    scrollContainer: null as HTMLElement | null,
    scrollStartTop: 0,
    scrolling: false,
  });
  const flipStageRef = useRef<HTMLDivElement>(null);
  const cardUnmountTimeoutRef = useRef<number | null>(null);
  const [activeCard, setActiveCard] = useState(0);
  const [nextCard, setNextCard] = useState<number | null>(null);
  const [flipPhase, setFlipPhase] = useState<'idle' | 'dragging' | 'settlingThrough' | 'returning'>('idle');
  const [rotation, setRotation] = useState(0);
  const [flipDuration, setFlipDuration] = useState(FULL_FLIP_DURATION_MS);
  const [mountedCards, setMountedCards] = useState<Set<number>>(() => new Set([0, 1]));
  const [activeHomeFace, setActiveHomeFace] = useState<HomeFace>('home');
  const [isCertificateMounted, setIsCertificateMounted] = useState(false);
  const [nextHomeFace, setNextHomeFace] = useState<HomeFace | null>(null);
  const [selectedCertification, setSelectedCertification] = useState<string | null>(null);
  const [showSwipeCoachMark, setShowSwipeCoachMark] = useState(false);
  const flipStateSnapshotRef = useRef({
    activeCard,
    nextCard,
    activeHomeFace,
    nextHomeFace,
    flipPhase,
    rotation,
    flipDuration,
  });
  useEffect(() => {
    flipStateSnapshotRef.current = {
      activeCard,
      nextCard,
      activeHomeFace,
      nextHomeFace,
      flipPhase,
      rotation,
      flipDuration,
    };
  }, [activeCard, activeHomeFace, flipDuration, flipPhase, nextCard, nextHomeFace, rotation]);
  const isMobileViewport = useMediaQuery(MOBILE_MEDIA_QUERY);
  const isCardMounted = (index: number) =>
    mountedCards.has(index) || (visible && isMobileViewport && index === 2);

  const resetInterruptedGesture = useCallback((includeAnimation = false) => {
    const state = touchStateRef.current;
    const currentSnapshot = flipStateSnapshotRef.current;
    if (!state.active && (!includeAnimation || currentSnapshot.flipPhase === 'idle')) return;

    const pointerId = state.pointerId;
    state.active = false;
    state.scrolling = false;

    const flipStage = flipStageRef.current;
    if (state.captured && flipStage?.hasPointerCapture(pointerId)) {
      flipStage.releasePointerCapture(pointerId);
    }
    state.captured = false;

    const displayedRotation = Math.abs(currentSnapshot.rotation);
    if (
      displayedRotation > 0 &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setFlipDuration(Math.max(80, Math.round((displayedRotation / 180) * FULL_FLIP_DURATION_MS)));
      setRotation(0);
      setFlipPhase('returning');
      return;
    }

    setNextCard(null);
    setNextHomeFace(null);
    setRotation(0);
    setFlipPhase('idle');
  }, []);

  useEffect(() => {
    const handleWindowBlur = () => resetInterruptedGesture(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        resetInterruptedGesture(true);
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [resetInterruptedGesture]);

  useEffect(() => () => {
    if (cardUnmountTimeoutRef.current !== null) {
      window.clearTimeout(cardUnmountTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      setShowSwipeCoachMark(visible && isMobileViewport);
    });

    const timeoutId = visible && isMobileViewport
      ? window.setTimeout(() => {
          setShowSwipeCoachMark(false);
        }, SWIPE_COACH_DURATION_MS)
      : null;

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isMobileViewport, visible]);

  const updateMountedWindow = (index: number) => {
    setMountedCards((current) => {
      if (index === 0) return new Set([0, 1]);
      if (index === 2) return new Set([1, 2]);
      return new Set(current.has(2) ? [0, 1, 2] : [0, 1]);
    });
  };

  const cancelMountedWindowUpdate = () => {
    if (cardUnmountTimeoutRef.current === null) return;

    window.clearTimeout(cardUnmountTimeoutRef.current);
    cardUnmountTimeoutRef.current = null;
  };

  const scheduleMountedWindowUpdate = (index: number) => {
    cancelMountedWindowUpdate();

    if (index === 1) {
      updateMountedWindow(index);
      return;
    }

    cardUnmountTimeoutRef.current = window.setTimeout(() => {
      updateMountedWindow(index);
      cardUnmountTimeoutRef.current = null;
    }, CARD_UNMOUNT_DELAY_MS);
  };

  const completeImmediately = (index: number) => {
    setActiveCard(index);
    updateMountedWindow(index);
    setNextCard(null);
    setRotation(0);
    setFlipPhase('idle');
  };

  const flipHomeFace = (target: HomeFace) => {
    setShowSwipeCoachMark(false);

    const isCompletingTap = flipPhase === 'dragging' && !touchStateRef.current.active;
    if (
      activeCard !== 0 ||
      (flipPhase !== 'idle' && !isCompletingTap) ||
      target === activeHomeFace
    ) return;

    if (target !== 'home') {
      setIsCertificateMounted(true);
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActiveHomeFace(target);
      setNextHomeFace(null);
      setRotation(0);
      setFlipPhase('idle');
      return;
    }

    setNextCard(null);
    setNextHomeFace(target);
    setFlipDuration(FULL_FLIP_DURATION_MS);
    const flipsRight =
      (activeHomeFace === 'certificate' && target === 'home') ||
      (activeHomeFace === 'certificateDetail' && target === 'certificate');
    setRotation(flipsRight ? 180 : -180);
    setFlipPhase('settlingThrough');
  };

  const goToCard = (index: number) => {
    setShowSwipeCoachMark(false);

    if (activeHomeFace !== 'home') {
      if (index === 0) {
        flipHomeFace(activeHomeFace === 'certificateDetail' ? 'certificate' : 'home');
      }
      return;
    }

    if (
      index === activeCard ||
      !isCardMounted(index) ||
      Math.abs(index - activeCard) !== 1 ||
      flipPhase !== 'idle'
    ) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      completeImmediately(index);
      return;
    }

    setNextCard(index);
    setFlipDuration(FULL_FLIP_DURATION_MS);
    setRotation(index > activeCard ? -180 : 180);
    setFlipPhase('settlingThrough');
  };

  const handleFlipEnd = (event: TransitionEvent<HTMLElement>) => {
    const isCardTransform = event.target === event.currentTarget && event.propertyName === 'transform';
    if (!isCardTransform) return;

    if (flipPhase === 'returning') {
      setNextCard(null);
      setNextHomeFace(null);
      setRotation(0);
      setFlipPhase('idle');
      return;
    }

    if (flipPhase === 'settlingThrough' && nextHomeFace !== null) {
      setActiveHomeFace(nextHomeFace);
      setNextHomeFace(null);
      setRotation(0);
      setFlipPhase('idle');
      return;
    }

    if (flipPhase === 'settlingThrough' && nextCard !== null) {
      setActiveCard(nextCard);
      scheduleMountedWindowUpdate(nextCard);
      setNextCard(null);
      setRotation(0);
      setFlipPhase('idle');
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    setShowSwipeCoachMark(false);

    if (flipPhase !== 'idle' || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    const scrollContainer = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-card-scroll-region]')
      : null;

    cancelMountedWindowUpdate();
    touchStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      captured: false,
      startX: event.clientX,
      startY: event.clientY,
      width: event.currentTarget.clientWidth || 1,
      originCard: activeCard,
      originHomeFace: activeHomeFace,
      scrollContainer,
      scrollStartTop: scrollContainer?.scrollTop ?? 0,
      scrolling: false,
    };
    setFlipPhase('dragging');
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const state = touchStateRef.current;
    if (!state.active || event.pointerId !== state.pointerId) return;

    const distance = event.clientX - state.startX;
    const verticalDistance = event.clientY - state.startY;
    const horizontalDistance = Math.abs(distance);
    const verticalTravel = Math.abs(verticalDistance);

    if (state.scrolling) {
      event.preventDefault();
      if (state.scrollContainer) {
        state.scrollContainer.scrollTop = state.scrollStartTop - verticalDistance;
      }
      return;
    }

    if (!state.captured) {
      if (verticalTravel >= VERTICAL_SCROLL_THRESHOLD_PX && verticalTravel > horizontalDistance) {
        if (state.scrollContainer) {
          event.currentTarget.setPointerCapture(event.pointerId);
          state.captured = true;
          state.scrolling = true;
          state.scrollContainer.scrollTop = state.scrollStartTop - verticalDistance;
          event.preventDefault();
        } else {
          state.active = false;
        }

        setNextCard(null);
        setRotation(0);
        setFlipPhase('idle');
        return;
      }

      if (horizontalDistance < SWIPE_START_THRESHOLD_PX || horizontalDistance <= verticalTravel) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      state.captured = true;
    }

    event.preventDefault();

    const direction = Math.sign(distance);
    const nextRotation = Math.max(-180, Math.min(180, (distance / state.width) * 180));
    const hasSpecialOrigin = state.originHomeFace !== 'home';
    const targetHomeFace = state.originHomeFace === 'certificate' && direction > 0
      ? 'home'
      : state.originHomeFace === 'certificateDetail' && direction > 0
        ? 'certificate'
        : null;
    const targetCard = hasSpecialOrigin
      ? 0
      : state.originCard + (direction < 0 ? 1 : -1);
    const hasTarget = hasSpecialOrigin
      ? targetHomeFace !== null
      : direction !== 0 &&
        targetCard >= 0 &&
        targetCard < cardIndexes.length &&
        isCardMounted(targetCard);

    setNextHomeFace(hasTarget ? targetHomeFace : null);
    setNextCard(!hasSpecialOrigin && hasTarget ? targetCard : null);
    setRotation(hasTarget ? nextRotation : nextRotation * 0.15);
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const state = touchStateRef.current;
    if (!state.active || event.pointerId !== state.pointerId) {
      return;
    }

    state.active = false;
    const wasScrolling = state.scrolling;
    const wasCaptured = state.captured;
    state.scrolling = false;

    if (wasCaptured && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    state.captured = false;

    if (wasScrolling) {
      event.preventDefault();
      return;
    }

    if (!wasCaptured) {
      setNextCard(null);
      setRotation(0);
      setFlipPhase('idle');
      return;
    }

    const distance = event.clientX - state.startX;
    const direction = Math.sign(distance);
    const releaseRotation = Math.max(-180, Math.min(180, (distance / state.width) * 180));
    const hasSpecialOrigin = state.originHomeFace !== 'home';
    const targetHomeFace = state.originHomeFace === 'certificate' && direction > 0
      ? 'home'
      : state.originHomeFace === 'certificateDetail' && direction > 0
        ? 'certificate'
        : null;
    const targetCard = hasSpecialOrigin
      ? 0
      : state.originCard + (direction < 0 ? 1 : -1);
    const hasTarget = hasSpecialOrigin
      ? targetHomeFace !== null
      : direction !== 0 &&
        targetCard >= 0 &&
        targetCard < cardIndexes.length &&
        isCardMounted(targetCard);
    const displayedRotation = hasTarget ? releaseRotation : releaseRotation * 0.15;
    const shouldReturn = Math.abs(distance) < state.width * SWIPE_THRESHOLD;

    if (shouldReturn || !hasTarget) {
      setNextHomeFace(hasTarget ? targetHomeFace : null);
      setNextCard(!hasSpecialOrigin && hasTarget ? targetCard : null);
      setFlipDuration(Math.max(80, Math.round((Math.abs(displayedRotation) / 180) * FULL_FLIP_DURATION_MS)));
      setRotation(0);
      setFlipPhase('returning');
      return;
    }

    const targetRotation = direction < 0 ? -180 : 180;
    const currentRotation = flipStateSnapshotRef.current.rotation;
    if (Math.abs(currentRotation - targetRotation) <= 0.5) {
      if (hasSpecialOrigin && targetHomeFace !== null) {
        setActiveHomeFace(targetHomeFace);
        setNextHomeFace(null);
        setNextCard(null);
        setRotation(0);
        setFlipPhase('idle');
      } else {
        completeImmediately(targetCard);
      }
      return;
    }

    setNextHomeFace(targetHomeFace);
    setNextCard(hasSpecialOrigin ? null : targetCard);
    setFlipDuration(Math.max(80, Math.round(((180 - Math.abs(releaseRotation)) / 180) * FULL_FLIP_DURATION_MS)));
    setRotation(targetRotation);
    setFlipPhase('settlingThrough');
  };

  const handlePointerCancel = (event: PointerEvent<HTMLElement>) => {
    const state = touchStateRef.current;
    if (!state.active || event.pointerId !== state.pointerId) {
      return;
    }

    resetInterruptedGesture();
  };

  const handlePointerOut = (event: PointerEvent<HTMLElement>) => {
    if (event.relatedTarget !== null) return;
    const isOutsideViewport =
      event.clientX <= 0 ||
      event.clientX >= window.innerWidth - 1 ||
      event.clientY <= 0 ||
      event.clientY >= window.innerHeight - 1;
    if (!isOutsideViewport) return;
    resetInterruptedGesture();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    setShowSwipeCoachMark(false);

    if (activeHomeFace !== 'home') {
      const targetFace = activeHomeFace === 'certificateDetail' ? 'certificate' : 'home';
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        flipHomeFace(targetFace);
      }
      return;
    }

    if (event.key === 'ArrowRight' && activeCard < cardIndexes.length - 1) {
      event.preventDefault();
      goToCard(activeCard + 1);
    }

    if (event.key === 'ArrowLeft' && activeCard > 0) {
      event.preventDefault();
      goToCard(activeCard - 1);
    }
  };

  const setMobileCertificateFlipped = (
    flipped: boolean | ((previous: boolean) => boolean)
  ) => {
    const shouldShowCertificate = typeof flipped === 'function'
      ? flipped(activeHomeFace !== 'home')
      : flipped;
    flipHomeFace(shouldShowCertificate ? 'certificate' : 'home');
  };

  const showCertificateDetail = (certification: string | null) => {
    if (!certification) return;

    setSelectedCertification(certification);
    flipHomeFace('certificateDetail');
  };

  const sharedCardProps = {
    apps,
    currentProjectPage,
    setCurrentProjectPage,
    language,
    certificationText,
    profileName,
    profileDescription,
    profileLinks,
    greetingText,
    nameSuffix,
  };

  const renderCard = (index: number) => {
    if (index === 2) {
      return (
        <div className={`${styles.cardShell} ${styles.commentCard}`}>
          <CommentSection title={uiCopy.cards[2]} />
        </div>
      );
    }

    return (
      <div className={`${styles.cardShell} ${index === 0 ? styles.homeCard : styles.appsCard}`}>
        <CardFront
          {...sharedCardProps}
          setIsCardFlipped={setMobileCertificateFlipped}
          greetingFade={index === 0 ? 1 : 0}
          appsFade={index === 1 ? 1 : 0}
          photoCardFade={index === 0 ? 1 : 0}
          scrollProgress={index}
          compactTypography
          layoutActive={visible}
        />
      </div>
    );
  };

  const isHomeFaceActive = activeCard === 0 && activeHomeFace === 'home';
  const isHomeFaceVisible = isHomeFaceActive || nextCard === 0 || nextHomeFace === 'home';
  const isCertificateFaceActive = activeCard === 0 && activeHomeFace === 'certificate';
  const isCertificateFaceVisible = isCertificateFaceActive || nextHomeFace === 'certificate';
  const isCertificateDetailFaceActive = activeCard === 0 && activeHomeFace === 'certificateDetail';
  const isCertificateDetailFaceVisible =
    isCertificateDetailFaceActive || nextHomeFace === 'certificateDetail';

  return (
    <section className={styles.mobileExperience} data-visible={visible} aria-label={uiCopy.portfolioLabel}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>JACE-S</span>
        <select
          className={styles.languageSelect}
          value={language}
          onChange={(event) => {
            setShowSwipeCoachMark(false);
            setLanguage(event.target.value as Language);
          }}
          aria-label={uiCopy.languageSelector}
        >
          <option value="en">🇺🇸 English</option>
          <option value="ko">🇰🇷 한국어</option>
          <option value="ja">🇯🇵 日本語</option>
          <option value="zh">🇨🇳 中文</option>
        </select>
      </header>

      <div
        ref={flipStageRef}
        className={styles.flipStage}
        data-coach-visible={showSwipeCoachMark}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerOut={handlePointerOut}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-label={uiCopy.cardRegion}
      >
        <article
          className={`${styles.cardLayer} ${showSwipeCoachMark && flipPhase === 'idle' ? styles.coachHint : ''} ${flipPhase === 'dragging' ? styles.isDragging : ''} ${flipPhase === 'settlingThrough' ? styles.isFlipping : ''} ${flipPhase === 'returning' ? styles.isReturning : ''}`}
          aria-label={uiCopy.cardLabel(activeHomeFace === 'certificateDetail' && selectedCertification
            ? selectedCertification
            : activeHomeFace === 'certificate'
              ? certificationText[language]
              : uiCopy.cards[activeCard])}
          onTransitionEnd={handleFlipEnd}
          style={{ '--card-rotation': `${rotation}deg`, '--flip-duration': `${flipDuration}ms` } as CSSProperties}
        >
          {isCardMounted(0) && (
            <div
              className={`${styles.cardFace} ${isHomeFaceActive ? styles.frontCardFace : styles.backCardFace} ${isHomeFaceVisible ? styles.visibleCardFace : styles.inactiveCardFace}`}
              aria-hidden={!isHomeFaceVisible}
            >
              {renderCard(0)}
            </div>
          )}
          {isCardMounted(0) && isCertificateMounted && (
            <div
              className={`${styles.cardFace} ${isCertificateFaceActive ? styles.frontCardFace : styles.backCardFace} ${isCertificateFaceVisible ? styles.visibleCardFace : styles.inactiveCardFace}`}
              aria-hidden={!isCertificateFaceVisible}
            >
              <div className={`${styles.cardShell} ${styles.certificateCard}`}>
                <CardBack
                  compact
                  scrollProgress={0}
                  language={language}
                  certificationText={certificationText}
                  setSelectedCertification={showCertificateDetail}
                  setIsCardFlipped={setMobileCertificateFlipped}
                />
              </div>
            </div>
          )}
          {isCardMounted(0) && selectedCertification && (
            <div
              className={`${styles.cardFace} ${isCertificateDetailFaceActive ? styles.frontCardFace : styles.backCardFace} ${isCertificateDetailFaceVisible ? styles.visibleCardFace : styles.inactiveCardFace}`}
              aria-hidden={!isCertificateDetailFaceVisible}
            >
              <div className={`${styles.cardShell} ${styles.certificateDetailCard}`}>
                <div className={styles.certificateDetailContent}>
                  <h2 className={styles.certificateDetailTitle}>{selectedCertification}</h2>
                  <div className={styles.certificateDetailDocument}>
                    <RightCardContent
                      certificateOnly
                      selectedCertification={selectedCertification}
                      photoCardFade={1}
                    />
                  </div>
                  <div className={styles.certificateDetailActions}>
                    <button
                      type="button"
                      className={styles.certificateDetailBackButton}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        flipHomeFace('certificate');
                      }}
                    >
                      {uiCopy.back}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {cardIndexes.filter((index) => index !== 0 && isCardMounted(index)).map((index) => (
            <div
              key={index}
              className={`${styles.cardFace} ${index === activeCard ? styles.frontCardFace : styles.backCardFace} ${index === activeCard || index === nextCard ? styles.visibleCardFace : styles.inactiveCardFace}`}
              aria-hidden={index !== activeCard && index !== nextCard}
            >
              {renderCard(index)}
            </div>
          ))}
        </article>
        {showSwipeCoachMark && (
          <div
            className={styles.swipeCoachMark}
            role="status"
            aria-label={`${swipeCoachCopy[language].title}. ${swipeCoachCopy[language].description}`}
          >
            <div className={styles.swipeCoachGesture} aria-hidden="true">
              <svg className={styles.swipeCoachTrack} viewBox="0 0 160 24">
                <path d="M146 12H18M18 12l10-8M18 12l10 8" />
              </svg>
              <span className={styles.swipeCoachPointer}>
                <span className={styles.swipeCoachContact} />
                <svg className={styles.swipeCoachFinger} viewBox="0 0 24 24">
                  <path d="M22 14a8 8 0 0 1-8 8" />
                  <path d="M18 11v-1a2 2 0 0 0-4 0" />
                  <path d="M14 10V9a2 2 0 0 0-4 0v1" />
                  <path d="M10 9.5V4a2 2 0 0 0-4 0v10" />
                  <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4c-2.8 0-4.5-.86-5.99-2.34l-1.65-1.65a2 2 0 0 1 2.83-2.82L7 16" />
                </svg>
              </span>
            </div>
            <strong className={styles.swipeCoachTitle}>{swipeCoachCopy[language].title}</strong>
            <span className={styles.swipeCoachDescription}>{swipeCoachCopy[language].description}</span>
          </div>
        )}
      </div>

      <nav
        className={styles.pagination}
        aria-label={uiCopy.cardSelection}
        style={{ '--mobile-active-accent': cardAccentChannels[activeCard] } as CSSProperties}
      >
        {uiCopy.cards.map((label, index) => (
          <button
            key={label}
            type="button"
            className={index === activeCard ? styles.activeDot : styles.dot}
            onClick={() => goToCard(index)}
            aria-label={uiCopy.goToCard(label)}
            aria-current={index === activeCard ? 'page' : undefined}
            disabled={
              flipPhase !== 'idle' ||
              !isCardMounted(index) ||
              Math.abs(index - activeCard) > 1 ||
              (activeHomeFace !== 'home' && index !== 0)
            }
          />
        ))}
      </nav>
    </section>
  );
}
