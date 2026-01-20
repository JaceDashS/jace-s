/**
 * MainContent 컴포넌트 관련 타입 정의
 */

// 호버 애니메이션 단계
export type HoverPhase = 'none' | 'spread' | 'close';

// 언어 타입
export type Language = 'en' | 'ko' | 'ja' | 'zh';

// 마지막 액션 타입
export type LastAction = 'enter' | 'leave' | null;

// 카드 상태 인터페이스
export interface CardState {
  isFlipped: boolean;
  isRightCardHovered: boolean;
  hoverPhase: HoverPhase;
  isZIndexChanged: boolean;
  isHoverAnimationRunning: boolean;
}

// 페이드 상태 인터페이스
export interface FadeState {
  greetingFade: number;
  photoCardFade: number;
  appsFade: number;
}

// 스크롤 상태 인터페이스
export interface ScrollState {
  progress: number;
  isScrollingUp: boolean;
}

// 언어 정보 인터페이스
export interface LanguageInfo {
  name: string;
  flag: string;
}

// 언어 맵 타입
export type LanguageMap = Record<Language, LanguageInfo>;

// 자격증 텍스트 맵 타입
export type CertificationTextMap = Record<Language, string>;

