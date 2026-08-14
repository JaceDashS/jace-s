import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, RefObject, TransitionEvent } from 'react';

export const MOBILE_CARD_INDEXES = [0, 1, 2] as const;

export type HomeFace = 'home' | 'certificate' | 'certificateDetail';
type FlipPhase = 'idle' | 'dragging' | 'settlingThrough' | 'returning';

const SWIPE_THRESHOLD = 0.3;
const SWIPE_START_THRESHOLD_PX = 12;
const VERTICAL_SCROLL_THRESHOLD_PX = 24;
const FULL_FLIP_DURATION_MS = 280;
const CARD_UNMOUNT_DELAY_MS = 400;
const SWIPE_COACH_DURATION_MS = 3200;

interface UseMobileCardGestureOptions {
  visible: boolean;
  isMobileViewport: boolean;
}

export interface MobileCardGestureState {
  flipStageRef: RefObject<HTMLDivElement | null>;
  activeCard: number;
  nextCard: number | null;
  flipPhase: FlipPhase;
  rotation: number;
  flipDuration: number;
  activeHomeFace: HomeFace;
  nextHomeFace: HomeFace | null;
  isCertificateMounted: boolean;
  showSwipeCoachMark: boolean;
  isCardMounted: (index: number) => boolean;
  goToCard: (index: number) => void;
  flipHomeFace: (target: HomeFace) => void;
  handleFlipEnd: (event: TransitionEvent<HTMLElement>) => void;
  handlePointerDown: (event: PointerEvent<HTMLElement>) => void;
  handlePointerMove: (event: PointerEvent<HTMLElement>) => void;
  handlePointerUp: (event: PointerEvent<HTMLElement>) => void;
  handlePointerCancel: (event: PointerEvent<HTMLElement>) => void;
  handlePointerOut: (event: PointerEvent<HTMLElement>) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

export function useMobileCardGesture({
  visible,
  isMobileViewport,
}: UseMobileCardGestureOptions): MobileCardGestureState {
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
  const [flipPhase, setFlipPhase] = useState<FlipPhase>('idle');
  const [rotation, setRotation] = useState(0);
  const [flipDuration, setFlipDuration] = useState(FULL_FLIP_DURATION_MS);
  const [mountedCards, setMountedCards] = useState<Set<number>>(() => new Set([0, 1]));
  const [activeHomeFace, setActiveHomeFace] = useState<HomeFace>('home');
  const [isCertificateMounted, setIsCertificateMounted] = useState(false);
  const [nextHomeFace, setNextHomeFace] = useState<HomeFace | null>(null);
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
        targetCard < MOBILE_CARD_INDEXES.length &&
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
        targetCard < MOBILE_CARD_INDEXES.length &&
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

    if (event.key === 'ArrowRight' && activeCard < MOBILE_CARD_INDEXES.length - 1) {
      event.preventDefault();
      goToCard(activeCard + 1);
    }

    if (event.key === 'ArrowLeft' && activeCard > 0) {
      event.preventDefault();
      goToCard(activeCard - 1);
    }
  };

  return {
    flipStageRef,
    activeCard,
    nextCard,
    flipPhase,
    rotation,
    flipDuration,
    activeHomeFace,
    nextHomeFace,
    isCertificateMounted,
    showSwipeCoachMark,
    isCardMounted,
    goToCard,
    flipHomeFace,
    handleFlipEnd,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handlePointerOut,
    handleKeyDown,
  };
}
