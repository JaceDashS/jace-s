/**
 * MainContent 컴포넌트 관련 타입 정의
 */

// 호버 애니메이션 단계
export type HoverPhase = 'none' | 'spread' | 'close';

// 언어 타입
export type Language = 'en' | 'ko' | 'ja' | 'zh';

// 언어 정보 인터페이스
export interface LanguageInfo {
  name: string;
  flag: string;
}

