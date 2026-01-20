/**
 * 버튼 반응형 크기 설정 상수
 * CardFront와 CardBack에서 공통으로 사용
 */

// 버튼 사이즈 배율 (Instagram, GitHub, Email, 자격증, Back 버튼의 크기를 한 번에 조절)
// 예: 1.0 = 기본, 1.2 = 20% 증가, 0.8 = 20% 감소
export const BUTTON_MAX_FACTOR = 0.8; // 이 값만 변경하면 모든 버튼 크기가 조절됩니다!

// 카드 너비 범위
export const CARD_WIDTH = {
  MIN: 400,
  MAX: 1200,
} as const;

// 큰 버튼 패딩 (MAX 값에 BUTTON_MAX_FACTOR를 곱한 값이 최종 최대값)
export const BUTTON_PADDING = {
  MIN_PX: 6,  // rem 단위로 변환 시 0.25 곱함
  MAX_PX: 12,
  MIN_PY: 3,
  MAX_PY: 6,
} as const;

// 버튼 폰트 크기 (MAX 값에 BUTTON_MAX_FACTOR를 곱한 값이 최종 최대값)
export const BUTTON_FONT = {
  MIN: 0.875, // rem
  MAX: 1.5,   // rem
} as const;

// 아이콘 크기 (MAX 값에 BUTTON_MAX_FACTOR를 곱한 값이 최종 최대값)
export const ICON_SIZE = {
  MIN: 1.25, // rem
  MAX: 2.5,  // rem
} as const;

