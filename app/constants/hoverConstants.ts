/**
 * 호버 애니메이션 관련 상수 정의
 */

// 호버 애니메이션 속도 관리 상수 (단일 소스)
// 이 값 하나로 모든 호버 애니메이션의 속도를 제어합니다 (밀리초 단위)
export const HOVER_ANIMATION_SPEED_MS = 300; // 호버 애니메이션 전체 속도 (밀리초)

// CSS transition easing 함수
export const HOVER_TRANSITION_EASING = 'ease-out';

// CSS transition에서 사용할 문자열 형식으로 변환
export const getHoverTransitionDuration = (): string => {
  return `${HOVER_ANIMATION_SPEED_MS / 1000}s`;
};

// z-index 변경 타이밍 (호버 애니메이션 속도와 동일하게 설정)
export const HOVER_Z_INDEX_CHANGE_DELAY_MS = HOVER_ANIMATION_SPEED_MS; // z-index 변경 지연 시간 (밀리초)

// HOVER_TRANSITION_DURATION을 상수로 export (기존 코드 호환성)
export const HOVER_TRANSITION_DURATION = getHoverTransitionDuration();

