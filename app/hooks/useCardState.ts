/**
 * 카드 상태 관리 훅
 */
import { useState, useEffect, useRef } from 'react';
import type { HoverPhase } from '../types/mainContent';

export const useCardState = () => {
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isRightCardHovered, setIsRightCardHovered] = useState(false);
  const [hoverPhase, setHoverPhase] = useState<HoverPhase>('none');
  const [isZIndexChanged, setIsZIndexChanged] = useState(false);
  const [isHoverAnimationRunning, setIsHoverAnimationRunning] = useState(false);
  const [pendingHoverLeave, setPendingHoverLeave] = useState(false);
  const [pendingHoverEnter, setPendingHoverEnter] = useState(false);

  // ref 동기화
  const isRightCardHoveredRef = useRef(false);
  const hoverPhaseRef = useRef<HoverPhase>('none');
  const isZIndexChangedRef = useRef(false);
  const isHoverAnimationRunningRef = useRef(false);
  const pendingHoverLeaveRef = useRef(false);
  const pendingHoverEnterRef = useRef(false);
  const isHoverLeaveFlowActiveRef = useRef(false);
  const lastActionRef = useRef<'enter' | 'leave' | null>(null);

  // ref 동기화 useEffect
  useEffect(() => {
    isRightCardHoveredRef.current = isRightCardHovered;
  }, [isRightCardHovered]);

  useEffect(() => {
    hoverPhaseRef.current = hoverPhase;
  }, [hoverPhase]);

  useEffect(() => {
    isZIndexChangedRef.current = isZIndexChanged;
  }, [isZIndexChanged]);

  useEffect(() => {
    isHoverAnimationRunningRef.current = isHoverAnimationRunning;
  }, [isHoverAnimationRunning]);

  useEffect(() => {
    pendingHoverLeaveRef.current = pendingHoverLeave;
  }, [pendingHoverLeave]);

  useEffect(() => {
    pendingHoverEnterRef.current = pendingHoverEnter;
  }, [pendingHoverEnter]);

  return {
    // State
    isCardFlipped,
    setIsCardFlipped,
    isRightCardHovered,
    setIsRightCardHovered,
    hoverPhase,
    setHoverPhase,
    isZIndexChanged,
    setIsZIndexChanged,
    isHoverAnimationRunning,
    setIsHoverAnimationRunning,
    pendingHoverLeave,
    setPendingHoverLeave,
    pendingHoverEnter,
    setPendingHoverEnter,
    // Refs
    isRightCardHoveredRef,
    hoverPhaseRef,
    isZIndexChangedRef,
    isHoverAnimationRunningRef,
    pendingHoverLeaveRef,
    pendingHoverEnterRef,
    isHoverLeaveFlowActiveRef,
    lastActionRef,
  };
};

