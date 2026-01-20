/**
 * 카드 관련 상수 정의
 */

// 카드 겹침 조절 상수 - 겹치는 부분을 화면 중앙에 배치하기 위한 오프셋 (퍼센트 단위)
// 양수 값: 왼쪽 카드를 오른쪽으로, 오른쪽 카드를 왼쪽으로 이동시켜 중앙에서 겹치게 함
export const CARD_OVERLAP_OFFSET = 12; // 각 카드 너비의 12%만큼 이동하여 중앙에서 겹치게

// 카드 전체 크기 조절 상수 (scale 값, 1.0 = 100%, 0.8 = 80% 등)
export const CARD_SCALE = 0.9; // 카드의 전체적인 크기 비율 (비율은 유지, 전체 크기만 조절)

// 호버 시 카드 벌림 정도 조절 상수 (퍼센트 단위)
// 이 값이 클수록 더 많이 벌려집니다. 현재는 두 카드가 안 겹쳐질 정도로 설정
export const CARD_HOVER_SEPARATION = CARD_OVERLAP_OFFSET * -1.3; // 기본값: 약 15.6%

// 카드 이동 애니메이션 상수
export const CARD_TRANSLATE_X_MULTIPLIER = 80; // scrollProgress에 곱해지는 translateX 배율 (퍼센트 단위)
export const CARD_ROTATE_START_ANGLE = 2; // 카드 회전 시작 각도 (도)
export const CARD_ROTATE_END_ANGLE = -2; // 카드 회전 끝 각도 (도)
export const CARD_ROTATE_MULTIPLIER = 4; // scrollProgress에 곱해지는 회전 각도 배율

// 호버 시 z-index 상수
export const CARD_Z_INDEX = {
  DEFAULT_LEFT: 10,
  DEFAULT_RIGHT: 0,
  HOVER_LEFT: 5,
  HOVER_RIGHT: 20,
} as const;

