/**
 * 스타일 계산 유틸리티 함수
 */
import {
  CARD_OVERLAP_OFFSET,
  CARD_SCALE,
  CARD_HOVER_SEPARATION,
  CARD_TRANSLATE_X_MULTIPLIER,
  CARD_ROTATE_START_ANGLE,
  CARD_ROTATE_END_ANGLE,
  CARD_ROTATE_MULTIPLIER,
} from '../constants/cardConstants';
import { HOVER_TRANSITION_DURATION, HOVER_TRANSITION_EASING } from '../constants/hoverConstants';
import type { HoverPhase } from '../types/mainContent';

/**
 * 왼쪽 카드의 transform 계산
 */
export const getLeftCardTransform = (
  scrollProgress: number,
  hoverPhase: HoverPhase,
  isCardFlipped: boolean
): string => {
  if (scrollProgress < 1) {
    // 첫 번째 구간 (0~1): 기존 이동 애니메이션 + 버튼 클릭 시 플립 + 호버 효과
    let baseTranslateX = CARD_OVERLAP_OFFSET + scrollProgress * CARD_TRANSLATE_X_MULTIPLIER;
    
    // 호버 애니메이션: 벌려진 후 원래 위치로
    if (hoverPhase === 'spread') {
      // 1단계: 벌려지기
      baseTranslateX += CARD_HOVER_SEPARATION / 2;
    } else if (hoverPhase === 'close') {
      // 2단계: 원래 위치로 돌아가기 (z축은 변경됨)
      baseTranslateX = CARD_OVERLAP_OFFSET + scrollProgress * CARD_TRANSLATE_X_MULTIPLIER;
    }
    
    const baseTransform = `scale(${CARD_SCALE}) translateX(${baseTranslateX}%)`;
    if (isCardFlipped) {
      return `${baseTransform} rotateY(180deg)`;
    }
    return baseTransform;
  } else if (scrollProgress < 2) {
    // 두 번째 구간 (1~2): 애니메이션 없음, 플립 완료 상태 유지
    return `scale(${CARD_SCALE}) translateX(${CARD_OVERLAP_OFFSET + CARD_TRANSLATE_X_MULTIPLIER}%) rotateY(0deg)`;
  } else if (scrollProgress <= 3) {
    // 세 번째 구간 (2~3): 연속된 플립 애니메이션
    // 2번에서 3번으로 이동하면서 플립 시작
    const flipProgress = Math.min(scrollProgress - 2, 1); // 0~1
    
    // translateX는 2번 구간 끝에서 시작하여 3번 구간 동안 유지
    const translateX = CARD_OVERLAP_OFFSET + CARD_TRANSLATE_X_MULTIPLIER;
    
    // 들었다가 효과: translateY로 위로 올라감 (0~0.3까지 올라가고, 0.3~1까지 내려옴)
    const liftHeight = 100;
    const translateY = flipProgress < 0.3
      ? -liftHeight * (flipProgress / 0.3)
      : -liftHeight * (1 - (flipProgress - 0.3) / 0.7);
    
    // 플립: rotateY로 뒤집힘
    const rotateY = flipProgress * 180; // 0~180도
    
    return `scale(${CARD_SCALE}) translateX(${translateX}%) translateY(${translateY}px) rotateY(${rotateY}deg)`;
  } else {
    // 4번 구간 이상 (3~4): 플립 완료 상태 유지
    return `scale(${CARD_SCALE}) translateX(${CARD_OVERLAP_OFFSET + CARD_TRANSLATE_X_MULTIPLIER}%) rotateY(180deg)`;
  }
};

/**
 * 오른쪽 카드의 transform 계산
 */
export const getRightCardTransform = (
  scrollProgress: number,
  hoverPhase: HoverPhase
): string => {
  if (scrollProgress < 1) {
    // 첫 번째 구간 (0~1): 기존 이동 애니메이션 + 호버 효과
    let translateX = -CARD_OVERLAP_OFFSET - scrollProgress * CARD_TRANSLATE_X_MULTIPLIER;
    const rotateAngle = CARD_ROTATE_START_ANGLE - scrollProgress * CARD_ROTATE_MULTIPLIER; // 2deg → -2deg
    
    // 호버 애니메이션: 벌려진 후 원래 위치로
    if (hoverPhase === 'spread') {
      // 1단계: 벌려지기
      translateX -= CARD_HOVER_SEPARATION / 2;
    } else if (hoverPhase === 'close') {
      // 2단계: 원래 위치로 돌아가기 (z축은 변경됨)
      translateX = -CARD_OVERLAP_OFFSET - scrollProgress * CARD_TRANSLATE_X_MULTIPLIER;
    }
    
    return `scale(${CARD_SCALE}) translateX(${translateX}%) rotate(${rotateAngle}deg)`;
  } else if (scrollProgress < 3) {
    // 두 번째, 세 번째 구간 (1~2, 2~3): 애니메이션 없음, 정지 상태 유지
    const translateX = -CARD_OVERLAP_OFFSET - CARD_TRANSLATE_X_MULTIPLIER;
    const rotateAngle = CARD_ROTATE_END_ANGLE; // 끝 상태 유지
    return `scale(${CARD_SCALE}) translateX(${translateX}%) rotate(${rotateAngle}deg)`;
  } else {
    // 3번 구간 이상: 정지 상태 유지
    const translateX = -CARD_OVERLAP_OFFSET - CARD_TRANSLATE_X_MULTIPLIER;
    const rotateAngle = CARD_ROTATE_END_ANGLE; // 끝 상태 유지
    return `scale(${CARD_SCALE}) translateX(${translateX}%) rotate(${rotateAngle}deg)`;
  }
};

/**
 * 왼쪽 카드의 transition 계산
 */
export const getLeftCardTransition = (
  scrollProgress: number,
  isScrollingUp: boolean,
  isAnimating: boolean
): string => {
  if (!isAnimating) {
    return 'all 1s ease-out';
  }
  
  if (scrollProgress < 1) {
    return `transform ${HOVER_TRANSITION_DURATION} ${HOVER_TRANSITION_EASING}`;
  }
  
  // 플립 구간 (2~3)에서만 transition 적용
  // 위로 스크롤할 때는 항상 부드럽게, 아래로 스크롤할 때는 플립 구간에서만
  if (scrollProgress >= 2 && scrollProgress <= 3) {
    return isScrollingUp ? 'transform 0.6s ease-out' : 'transform 0.1s ease-out';
  }
  
  // 위로 스크롤할 때 1~2 구간에서도 부드럽게
  if (isScrollingUp && scrollProgress > 1 && scrollProgress < 2) {
    return `transform ${HOVER_TRANSITION_DURATION} ${HOVER_TRANSITION_EASING}`;
  }
  
  return 'none';
};

/**
 * 오른쪽 카드의 transition 계산
 */
export const getRightCardTransition = (
  scrollProgress: number,
  isScrollingUp: boolean,
  isAnimating: boolean
): string => {
  if (!isAnimating) {
    return 'all 1s ease-out';
  }
  
  if (scrollProgress < 1) {
    return `transform ${HOVER_TRANSITION_DURATION} ${HOVER_TRANSITION_EASING}`;
  }
  
  if (isScrollingUp && scrollProgress > 1) {
    return `transform ${HOVER_TRANSITION_DURATION} ${HOVER_TRANSITION_EASING}`;
  }
  
  return 'none';
};

