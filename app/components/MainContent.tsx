'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import WelcomeScreen from './WelcomeScreen';

// 상수 import
import { CARD_SCALE, CARD_Z_INDEX } from '../constants/cardConstants';
import { HOVER_ANIMATION_SPEED_MS, HOVER_Z_INDEX_CHANGE_DELAY_MS } from '../constants/hoverConstants';
import { isInMarker1 } from '../constants/markerConstants';
import type { Language } from '../types/mainContent';
import { useFadeAnimation } from '../hooks/useFadeAnimation';
import { useCardState } from '../hooks/useCardState';
import CardFront from './Card/CardFront';
import CardBack from './Card/CardBack';
import RightCardContent from './Card/RightCardContent';
import {
  getLeftCardTransform,
  getRightCardTransform,
  getLeftCardTransition,
  getRightCardTransition,
} from '../utils/styleUtils';
import { fetchAssetsManifest, fetchProfileOverview } from '../utils/assetUtils';
import { debugEnvironmentVariables } from '../utils/envDebug';
import type { App } from '../types/app';

type AppApiItem = Omit<App, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

interface AppsApiResponse {
  apps?: AppApiItem[];
}

const shouldLog = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';

export default function MainContent() {
  // 상수들을 별도 파일에서 import하여 사용

  const [showContent, setShowContent] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  // 카드 상태는 useCardState 훅으로 관리
  const {
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
    setPendingHoverLeave,
    setPendingHoverEnter,
    isRightCardHoveredRef,
    hoverPhaseRef,
    isZIndexChangedRef,
    isHoverAnimationRunningRef,
    pendingHoverLeaveRef,
    pendingHoverEnterRef,
    isHoverLeaveFlowActiveRef,
    lastActionRef,
  } = useCardState();

  const [isScrollingUp, setIsScrollingUp] = useState(false); // 스크롤 방향 추적
  const [language, setLanguage] = useState<Language>('en'); // 언어 상태 (기본값: 영어)
  const [selectedCertification, setSelectedCertification] = useState<string | null>(null); // 선택된 자격증 키 (null이면 홈 포토 표시)
  const [currentProjectPage, setCurrentProjectPage] = useState(1); // 프로젝트 페이지네이션 현재 페이지
  const [profileName, setProfileName] = useState<string>(''); // 프로필 이름
  const [profileDescription, setProfileDescription] = useState<string>(''); // 프로필 설명
  const [apps, setApps] = useState<App[]>([]);
  const [isHomeCardShaking, setIsHomeCardShaking] = useState(false);
  const homeCardShakeTimeoutRef = useRef<number | null>(null);
  // Welcome 화면 종료를 위한 로딩 상태 추적
  const [appsLoaded, setAppsLoaded] = useState(false);
  const [certificationsLoaded, setCertificationsLoaded] = useState(false);
  const [homePhotosLoaded, setHomePhotosLoaded] = useState(false);
  
  // 환경변수 디버깅 (컴포넌트 마운트 시 한 번만 실행)
  useEffect(() => {
    if (shouldLog) {
      debugEnvironmentVariables();
    }
  }, []);
  
  // 언어 정보 매핑
  const languageMap = {
    en: { name: 'English', flag: '🇺🇸' },
    ko: { name: '한국어', flag: '🇰🇷' },
    ja: { name: '日本語', flag: '🇯🇵' },
    zh: { name: '中文', flag: '🇨🇳' },
  };

  // 자격증 텍스트 매핑
  const certificationText = {
    en: 'Certifications',
    ko: '자격증',
    ja: '資格',
    zh: '证书',
  };

  // Greeting 텍스트 매핑
  const greetingText = {
    en: "Hello, I'm",
    ko: '안녕하세요, 저는',
    ja: 'こんにちは、私は',
    zh: '你好，我是',
  };

  // 이름 뒤에 붙는 조사 매핑
  const nameSuffix = {
    en: '',
    ko: '입니다',
    ja: 'です',
    zh: '',
  };

  // 앱 목록 로드 (Next.js API Routes를 통해 DB에서 직접 가져오기)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    async function loadApps() {
      try {
        // Next.js API Routes 사용 (같은 origin의 /api/apps)
        const res = await fetch('/api/apps?page=1&limit=100', {
          signal: controller.signal,
          cache: 'no-store',
        });
        
        if (!res.ok) {
          if (res.status === 404) {
            setApps([]);
            return;
          }
          throw new Error(`Failed to fetch apps: ${res.status} ${res.statusText}`);
        }
        
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          setApps([]);
          return;
        }
        
        const data: AppsApiResponse = await res.json();
        // App 객체 전체를 저장
        const appsData = (data.apps || []).map((app) => ({
          ...app,
          createdAt: new Date(app.createdAt),
          updatedAt: new Date(app.updatedAt),
        }));
        if (!cancelled) {
          setApps(appsData);
        }
      } catch {
        // 에러 발생 시 빈 배열 사용
        if (!cancelled) {
          setApps([]);
        }
      } finally {
        if (!cancelled) {
          setAppsLoaded(true);
        }
        clearTimeout(timeoutId);
      }
    }

    loadApps();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);
  
  // 프로젝트 관련 상수들은 constants/gridConstants.ts에서 import
  
  // 각 마커 구간에 대한 ref
  const homeRef = useRef<HTMLDivElement>(null);
  const appsRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLDivElement>(null);
  const marker4Ref = useRef<HTMLDivElement>(null);
  
  const pathname = usePathname();

  // 모든 로딩 완료 상태
  const allResourcesLoaded = appsLoaded && certificationsLoaded && homePhotosLoaded;
  const handleCertificationsLoaded = useCallback(() => {
    setCertificationsLoaded(true);
  }, []);
  const handleHomePhotosLoaded = useCallback(() => {
    setHomePhotosLoaded(true);
  }, []);

  const handleWelcomeComplete = () => {
    setShowContent(true);
    setTimeout(() => {
      setIsAnimating(true);
    }, 50);
  };

  useEffect(() => {
    if (!showContent || !isAnimating) return;

    let rafId: number | null = null;
    let lastScrollY = window.scrollY; // 이전 스크롤 위치 추적

    const handleScroll = () => {
      // 호버 해제 플로우가 시작되었고 완료 조건(4조건)을 만족하지 못하면 스크롤 자체도 되돌린다 (입력 차단과 함께 사용)
      const isHomeCardDefault =
        hoverPhaseRef.current === 'none' &&
        isRightCardHoveredRef.current === false &&
        isHoverAnimationRunningRef.current === false &&
        isZIndexChangedRef.current === false &&
        pendingHoverEnterRef.current === false &&
        pendingHoverLeaveRef.current === false &&
        isHoverLeaveFlowActiveRef.current === false;
      const isAtTop = window.scrollY <= 1;
      const shouldBlockHomeScroll = isAtTop && !isHomeCardDefault;
      if (shouldBlockHomeScroll) {
        // Restore previous scroll position while blocked.
        window.scrollTo({
          top: lastScrollY,
          behavior: 'auto'
        });
        return;
      }


      if (!isAtTop) {
        const hasActiveHoverState =
          hoverPhaseRef.current !== 'none' ||
          isRightCardHoveredRef.current ||
          isHoverAnimationRunningRef.current ||
          isZIndexChangedRef.current ||
          pendingHoverEnterRef.current ||
          pendingHoverLeaveRef.current ||
          isHoverLeaveFlowActiveRef.current;
        if (hasActiveHoverState) {
          setIsRightCardHovered(false);
          setHoverPhase('none');
          setIsZIndexChanged(false);
          setIsHoverAnimationRunning(false);
          setPendingHoverEnter(false);
          setPendingHoverLeave(false);
          pendingHoverEnterRef.current = false;
          pendingHoverLeaveRef.current = false;
          isHoverLeaveFlowActiveRef.current = false;
        }
      }

      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      // 스크롤 진행도 계산 (3개 화면 높이 기준: 0~3, 플립 완료 시점까지)
      const calculatedProgress = Math.min(Math.max(scrollY / windowHeight, 0), 3); // 0~3
      
      // 스크롤 방향 확인 (아래로: true, 위로: false)
      const scrollingDown = scrollY > lastScrollY;
      const scrollingUp = scrollY < lastScrollY;
      
      // 스크롤 방향 state 업데이트 (위로 스크롤할 때만 true)
      if (scrollingUp) {
        setIsScrollingUp(true);
      } else if (scrollingDown) {
        setIsScrollingUp(false);
      }
      
      lastScrollY = scrollY;
      
      // 진행도 바는 항상 실시간으로 업데이트 (스크롤 방향과 무관)
      setScrollProgress((prev) => {
        if (prev < 3 && calculatedProgress > 3) {
          // 실제 스크롤 위치도 제한하여 3번 구간 애니메이션이 완료될 때까지 대기
          if (scrollY > windowHeight * 3) {
            window.scrollTo({
              top: windowHeight * 3,
              behavior: 'auto'
            });
          }
          return 3; // 최대 3까지만
        }
        const newValue = calculatedProgress;
        return newValue;
      });
      
      
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
        });
      }
    };

    // smoothUpdate는 제거: 진행도 바는 handleScroll에서 실시간으로 업데이트
    // 카드 애니메이션은 CSS transition으로 부드럽게 처리됨

    window.addEventListener('scroll', handleScroll, { passive: false });

    // 스크롤 이벤트는 이미 스크롤이 발생한 "후"에 오기 때문에, 입력 자체를 막아야(휠/터치/키) 실제로 스크롤이 안 됨
    // "호버 해제 플로우"가 시작된 후, 아래 4조건(완료 조건)을 모두 만족하기 전까지 입력을 차단한다.
    const isHomeCardDefault = () =>
      hoverPhaseRef.current === 'none' &&
      isRightCardHoveredRef.current === false &&
      isHoverAnimationRunningRef.current === false &&
      isZIndexChangedRef.current === false &&
      pendingHoverEnterRef.current === false &&
      pendingHoverLeaveRef.current === false &&
      isHoverLeaveFlowActiveRef.current === false;

    const shouldBlockScrollInput = () => {
      const isAtTop = window.scrollY <= 1;
      return isAtTop && !isHomeCardDefault();
    };

    const triggerHomeCardShake = () => {
      if (!isRightCardHoveredRef.current) return;
      if (homeCardShakeTimeoutRef.current !== null) {
        window.clearTimeout(homeCardShakeTimeoutRef.current);
      }
      setIsHomeCardShaking(false);
      requestAnimationFrame(() => {
        setIsHomeCardShaking(true);
      });
      homeCardShakeTimeoutRef.current = window.setTimeout(() => {
        setIsHomeCardShaking(false);
        homeCardShakeTimeoutRef.current = null;
      }, 220);
    };

    const onWheel = (e: WheelEvent) => {
      if (!shouldBlockScrollInput()) return;
      e.preventDefault();
    };

    const onWheelCapture = (e: WheelEvent) => {
      const blocked = shouldBlockScrollInput();
      if (!blocked) return;
      e.preventDefault();
      e.stopPropagation();
      triggerHomeCardShake();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!shouldBlockScrollInput()) return;
      e.preventDefault();
    };

    const onTouchMoveCapture = (e: TouchEvent) => {
      const blocked = shouldBlockScrollInput();
      if (!blocked) return;
      e.preventDefault();
      e.stopPropagation();
      triggerHomeCardShake();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!shouldBlockScrollInput()) return;
      const keysToBlock = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
      if (!keysToBlock.includes(e.key)) return;
      e.preventDefault();
    };

    const onKeyDownCapture = (e: KeyboardEvent) => {
      const blocked = shouldBlockScrollInput();
      if (!blocked) return;
      const keysToBlock = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
      if (!keysToBlock.includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      triggerHomeCardShake();
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKeyDown, { passive: false });
    document.addEventListener('wheel', onWheelCapture, { passive: false, capture: true });
    document.addEventListener('touchmove', onTouchMoveCapture, { passive: false, capture: true });
    document.addEventListener('keydown', onKeyDownCapture, { passive: false, capture: true });

    handleScroll(); // 초기 값 설정
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('wheel', onWheelCapture, true);
      document.removeEventListener('touchmove', onTouchMoveCapture, true);
      document.removeEventListener('keydown', onKeyDownCapture, true);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [
    showContent,
    isAnimating,
    selectedCertification,
    hoverPhaseRef,
    isRightCardHoveredRef,
    isHoverAnimationRunningRef,
    isZIndexChangedRef,
    pendingHoverEnterRef,
    pendingHoverLeaveRef,
    isHoverLeaveFlowActiveRef,
    setHoverPhase,
    setIsRightCardHovered,
    setIsHoverAnimationRunning,
    setIsZIndexChanged,
    setPendingHoverEnter,
    setPendingHoverLeave,
  ]);

  useEffect(() => {
    return () => {
      if (homeCardShakeTimeoutRef.current !== null) {
        window.clearTimeout(homeCardShakeTimeoutRef.current);
      }
    };
  }, []);

  // ref 동기화는 useCardState 훅 내부에서 처리됨

  // 호버 해제 완료 조건(4조건) 기반으로 "해제 플로우" 종료 판단
  useEffect(() => {
    const isHoverLeaveComplete =
      hoverPhaseRef.current === 'none' &&
      isRightCardHoveredRef.current === false &&
      isHoverAnimationRunningRef.current === false &&
      isZIndexChangedRef.current === false;

    if (isHoverLeaveFlowActiveRef.current && isHoverLeaveComplete) {
      isHoverLeaveFlowActiveRef.current = false;
    }
  }, [
    hoverPhase,
    isRightCardHovered,
    isHoverAnimationRunning,
    isZIndexChanged,
    hoverPhaseRef,
    isRightCardHoveredRef,
    isHoverAnimationRunningRef,
    isZIndexChangedRef,
    isHoverLeaveFlowActiveRef,
  ]);

  // 라우트 변경 시 해당 위치로 스크롤
  useEffect(() => {
    if (!showContent || !isAnimating) return;

    const scrollToProgress = (progress: number) => {
      const windowHeight = window.innerHeight;
      const targetScrollY = windowHeight * progress;
      window.scrollTo({
        top: targetScrollY,
        behavior: 'smooth',
      });
    };

    // pathname 변경 시 해당 스크롤 진행도로 이동
    if (pathname === '/home') {
      setTimeout(() => scrollToProgress(0), 100);
    } else if (pathname === '/apps') {
      setTimeout(() => scrollToProgress(1.5), 100);
    } else if (pathname === '/comments') {
      setTimeout(() => scrollToProgress(3), 100);
    }
  }, [pathname, showContent, isAnimating]);

  // 디바이스 언어 감지 및 자동 선택
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const browserLang =
        navigator.language ||
        (navigator as Navigator & { userLanguage?: string }).userLanguage ||
        'en';
      const langCode = browserLang.toLowerCase().split('-')[0]; // 'ko-KR' -> 'ko'
      
      // 지원하는 언어인지 확인하고 설정
      if (langCode === 'ko' || langCode === 'ja' || langCode === 'zh') {
        setLanguage(langCode as 'ko' | 'ja' | 'zh');
      } else {
        // 기본값은 영어
        setLanguage('en');
      }
    }
  }, []);

  // Profile Overview 로드
  useEffect(() => {
    async function loadProfileOverview() {
      try {
        const manifest = await fetchAssetsManifest();
        if (!manifest) {
          return;
        }
        
        const profileData = await fetchProfileOverview(manifest);
        if (!profileData) {
          return;
        }
        
        const currentLangData = profileData[language] || profileData['en'];
        if (currentLangData) {
          setProfileName(currentLangData.name);
          setProfileDescription(currentLangData.description || '');
        }
      } catch {
        // Profile overview 로드 실패 시 조용히 처리
      }
    }
    loadProfileOverview();
  }, [language]);


  // 페이드 애니메이션 계산은 useFadeAnimation 훅 사용
  const { greetingFade, photoCardFade, appsFade } = useFadeAnimation(scrollProgress);

  const rightCardTransform = isAnimating
    ? `${getRightCardTransform(scrollProgress, hoverPhase)} ${selectedCertification ? 'rotateY(180deg)' : ''}`
    : `scale(${CARD_SCALE}) translateX(32px) rotate(2deg) ${selectedCertification ? 'rotateY(180deg)' : ''}`;

  return (
    <>
      {!showContent && <WelcomeScreen onComplete={handleWelcomeComplete} ready={allResourcesLoaded} />}
      <div
        className="min-h-[300vh]"
        style={{
          opacity: showContent ? 1 : 0,
          pointerEvents: showContent ? 'auto' : 'none',
        }}
      >
          {/* 언어 선택 UI - 오른쪽 위 고정 */}
          <div className={`fixed right-8 top-8 z-50 transition-all duration-1000 ease-out ${
            isAnimating
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`}>
            <div className="relative group">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700/50 hover:bg-slate-700/90 transition-colors text-white"
                aria-label="Language Selector"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                  />
                </svg>
                <span className="text-sm font-medium">{languageMap[language].name}</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              
              {/* 드롭다운 메뉴 (호버 시 표시) */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700/50 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="py-2">
                  <button
                    onClick={() => setLanguage('en')}
                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700/50 transition-colors flex items-center gap-3"
                  >
                    <span className="text-lg">{languageMap.en.flag}</span>
                    <span>{languageMap.en.name}</span>
                    {language === 'en' && (
                      <svg
                        className="w-4 h-4 ml-auto text-purple-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setLanguage('ko')}
                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700/50 transition-colors flex items-center gap-3"
                  >
                    <span className="text-lg">{languageMap.ko.flag}</span>
                    <span>{languageMap.ko.name}</span>
                    {language === 'ko' && (
                      <svg
                        className="w-4 h-4 ml-auto text-purple-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setLanguage('ja')}
                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700/50 transition-colors flex items-center gap-3"
                  >
                    <span className="text-lg">{languageMap.ja.flag}</span>
                    <span>{languageMap.ja.name}</span>
                    {language === 'ja' && (
                      <svg
                        className="w-4 h-4 ml-auto text-purple-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setLanguage('zh')}
                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700/50 transition-colors flex items-center gap-3"
                  >
                    <span className="text-lg">{languageMap.zh.flag}</span>
                    <span>{languageMap.zh.name}</span>
                    {language === 'zh' && (
                      <svg
                        className="w-4 h-4 ml-auto text-purple-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <main
            className={`min-h-screen flex items-center justify-center p-4 bg-slate-900 transition-all duration-1000 ease-out sticky top-0 ${
              isAnimating
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4'
            }`}
          >
            {/* 세로 상태선 - 왼쪽 고정 (1번~4번 마커) */}
            <div className="fixed left-8 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-3">
              {/* 1번 마커 */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => {
                    const windowHeight = window.innerHeight;
                    window.scrollTo({
                      top: windowHeight * 0,
                      behavior: 'smooth',
                    });
                  }}
                  className={`h-3 rounded-full transition-all duration-300 cursor-pointer ${
                    scrollProgress === 0
                      ? 'bg-purple-600 w-9'
                      : scrollProgress > 0
                      ? 'bg-purple-400 w-3'
                      : 'bg-slate-600 w-3'
                  }`}
                  aria-label="Home"
                />
                <span className="text-xs text-white/80 whitespace-nowrap">home</span>
              </div>

              {/* 진행 바 (1번~2번 사이) */}
              <div className="w-1 h-32 bg-slate-700/50 relative overflow-hidden rounded-full">
                <div
                  className="absolute top-0 left-0 w-full bg-purple-600 transition-all duration-300 ease-out rounded-full"
                  style={{
                    height: scrollProgress >= 1 ? '100%' : `${(scrollProgress / 1) * 100}%`,
                  }}
                />
              </div>

              {/* 2번 마커 */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => {
                    const windowHeight = window.innerHeight;
                    window.scrollTo({
                      top: windowHeight * 1.5,
                      behavior: 'smooth',
                    });
                  }}
                  className={`h-3 rounded-full transition-all duration-300 cursor-pointer ${
                    scrollProgress >= 1 && scrollProgress < 2
                      ? 'bg-purple-600 w-9'
                      : scrollProgress >= 2
                      ? 'bg-purple-400 w-3'
                      : 'bg-slate-600 w-3'
                  }`}
                  aria-label="Apps"
                />
                <span className="text-xs text-white/80 whitespace-nowrap">apps</span>
              </div>

              {/* 진행 바 (2번~4번 사이) */}
              <div className="w-1 h-32 bg-slate-700/50 relative overflow-hidden rounded-full">
                <div
                  className="absolute top-0 left-0 w-full bg-purple-600 transition-all duration-300 ease-out rounded-full"
                  style={{
                    height: scrollProgress >= 3
                      ? '100%'
                      : scrollProgress >= 2
                      ? `${((scrollProgress - 2) / (3 - 2)) * 100}%`
                      : '0%',
                  }}
                />
              </div>

              {/* 4번 마커 */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => {
                    const windowHeight = window.innerHeight;
                    window.scrollTo({
                      top: windowHeight * 3,
                      behavior: 'smooth',
                    });
                  }}
                  className={`h-3 rounded-full transition-all duration-300 cursor-pointer ${
                    scrollProgress >= 3
                      ? 'bg-purple-600 w-9'
                      : 'bg-slate-600 w-3'
                  }`}
                  aria-label="Comment"
                />
                <span className="text-xs text-white/80 whitespace-nowrap">comments</span>
              </div>
            </div>

            {/* 1번 마커 구간 - Home */}
            <div ref={homeRef} className="relative w-full h-[90vh] flex items-center justify-center gap-0" style={{ perspective: '1000px' }}>
              {/* 왼쪽 카드 - 오른쪽으로 이동 (옆으로만 움직임), 세 번째 구간에서 플립 */}
              <div
                data-role="left-card"
                className="w-1/2 h-full relative"
                style={{
                  opacity: isAnimating ? 1 : 0,
                  transform: isAnimating
                    ? getLeftCardTransform(scrollProgress, hoverPhase, isCardFlipped)
                    : `scale(${CARD_SCALE}) translateX(-32px)`,
                  transformOrigin: 'center center',
                  transformStyle: 'preserve-3d',
                  zIndex: (isInMarker1(scrollProgress) && isZIndexChanged) ? CARD_Z_INDEX.HOVER_LEFT : CARD_Z_INDEX.DEFAULT_LEFT, // z-index 변경 타이밍 제어
                  marginRight: '0px',
                  transition: getLeftCardTransition(scrollProgress, isScrollingUp, isAnimating),
                }}
              >
                <CardFront
                  greetingFade={greetingFade}
                  appsFade={appsFade}
                  photoCardFade={photoCardFade}
                  scrollProgress={scrollProgress}
                  apps={apps}
                  currentProjectPage={currentProjectPage}
                  setCurrentProjectPage={setCurrentProjectPage}
                  language={language}
                  certificationText={certificationText}
                  setIsCardFlipped={setIsCardFlipped}
                  profileName={profileName}
                  profileDescription={profileDescription}
                  greetingText={greetingText[language]}
                  nameSuffix={nameSuffix[language]}
                  disablePointerEvents={scrollProgress >= 2}
                />
                <CardBack
                  scrollProgress={scrollProgress}
                  language={language}
                  certificationText={certificationText}
                  setSelectedCertification={setSelectedCertification}
                  setIsCardFlipped={setIsCardFlipped}
                />
              </div>

              {/* 오른쪽 카드 - 왼쪽으로 이동 (옆으로만 움직임) */}
              <div
                data-role="right-card"
                className={`w-1/2 h-full bg-white rounded-2xl shadow-2xl relative transform cursor-pointer ${isHomeCardShaking ? 'home-card-shake' : ''}`}
                onMouseEnter={() => {
                  if (window.scrollY > 1) {
                    return;
                  }
                  if (isInMarker1(scrollProgress)) {
                    if (!isHoverAnimationRunning) {
                      // 애니메이션이 진행 중이 아니면 즉시 호버 시작 애니메이션 실행
                      setPendingHoverLeave(false); // 호버 해제 대기 취소
                      setIsHoverAnimationRunning(true);
                      setIsRightCardHovered(true);
                      setHoverPhase('spread');
                      setIsZIndexChanged(false);
                      // z-index 변경 타이밍 (호버 애니메이션 속도의 절반)
                      setTimeout(() => {
                        setIsZIndexChanged(true);
                      }, HOVER_Z_INDEX_CHANGE_DELAY_MS);
                      // 벌려진 후 원래 위치로 돌아가면서 z축 변경
                      setTimeout(() => {
                        setHoverPhase('close');
                      }, HOVER_ANIMATION_SPEED_MS); // 호버 애니메이션 지속 시간 후 원래 위치로
                      // 전체 애니메이션 완료: spread(0~3000ms) + close transition(3000ms) = 6000ms
                      setTimeout(() => {
                        setIsHoverAnimationRunning(false);
                        // 마지막 액션에 따라 스케줄된 액션 실행
                        if (lastActionRef.current === 'leave' && pendingHoverLeaveRef.current) {
                          // 마지막 액션이 'leave'이고 호버 해제가 스케줄되어 있으면 호버 해제 애니메이션 실행
                          setPendingHoverLeave(false);
                          pendingHoverLeaveRef.current = false;
                          lastActionRef.current = null; // 액션 실행 후 초기화
                          // 호버 해제 애니메이션 실행
                          setIsHoverAnimationRunning(true);
                          setHoverPhase('spread');
                          setTimeout(() => {
                            setIsZIndexChanged(false);
                          }, HOVER_Z_INDEX_CHANGE_DELAY_MS);
                          setTimeout(() => {
                            setHoverPhase('none');
                            setIsRightCardHovered(false);
                          }, HOVER_ANIMATION_SPEED_MS);
                          // 전체 애니메이션 완료: spread(0~3000ms) + none transition(3000ms) = 6000ms
                          setTimeout(() => {
                            setIsHoverAnimationRunning(false);
                          }, HOVER_ANIMATION_SPEED_MS + HOVER_ANIMATION_SPEED_MS); // spread + none transition 완료
                        } else if (lastActionRef.current === 'enter') {
                          // 마지막 액션이 'enter'이면 호버 상태 유지 (호버 해제 스케줄 취소)
                          setPendingHoverLeave(false);
                          pendingHoverLeaveRef.current = false;
                          lastActionRef.current = null; // 액션 실행 후 초기화
                        }
                      }, HOVER_ANIMATION_SPEED_MS + HOVER_ANIMATION_SPEED_MS); // spread + close transition 완료
                    } else if (isHoverAnimationRunning && isRightCardHovered && hoverPhase !== 'spread') {
                      // 호버 시작 애니메이션이 진행 중이면, 마지막 액션을 'enter'로 설정
                      // 호버 애니메이션 중에 호버해제하고 호버하면 호버 애니메이션이 또 나오는게 아니라
                      // 호버해제 애니메이션의 스케줄링이 해제되기만하고 호버상태가 유지되게하는거야
                      // hoverPhase가 'spread'가 아니면 호버 시작 애니메이션 진행 중
                      lastActionRef.current = 'enter'; // 마지막 액션을 'enter'로 설정
                      // 마지막 액션이 'enter'이면 호버 해제 스케줄 취소
                      if (lastActionRef.current === 'enter') {
                        setPendingHoverLeave(false);
                        pendingHoverLeaveRef.current = false;
                      }
                    } else if (isHoverAnimationRunning && hoverPhase === 'spread' && isRightCardHovered) {
                      // 호버 해제 애니메이션이 진행 중이면, 마지막 액션을 'enter'로 설정
                      // hoverPhase가 'spread'이고 isRightCardHovered가 true이면 호버 해제 애니메이션 진행 중
                      lastActionRef.current = 'enter'; // 마지막 액션을 'enter'로 설정
                      // 마지막 액션이 'enter'이면 호버 시작 스케줄
                      if (lastActionRef.current === 'enter') {
                        setPendingHoverEnter(true);
                        pendingHoverEnterRef.current = true;
                      }
                    }
                  }
                }}
                onMouseLeave={() => {
                  if (isInMarker1(scrollProgress)) {
                    // 호버 해제 플로우 시작: 완료 조건 만족 전까지 스크롤 입력 차단
                    isHoverLeaveFlowActiveRef.current = true;
                    if (!isHoverAnimationRunning && isRightCardHovered) {
                      // 애니메이션이 진행 중이 아니고 호버 상태이면 즉시 호버 해제 애니메이션 실행
                      setIsHoverAnimationRunning(true);
                      // 호버 해제 시: 먼저 벌려지고, 그 다음 원래 위치로
                      setHoverPhase('spread');
                      // z-index 변경 타이밍: 호버 시 z-index가 바뀌는 시간만큼 기다렸다가 원래대로
                      setTimeout(() => {
                        setIsZIndexChanged(false);
                      }, HOVER_Z_INDEX_CHANGE_DELAY_MS);
                      setTimeout(() => {
                        setHoverPhase('none');
                        setIsRightCardHovered(false);
                      }, HOVER_ANIMATION_SPEED_MS); // 호버 애니메이션 지속 시간 후 원래 위치로
                      // 전체 애니메이션 완료: spread(0~3000ms) + none transition(3000ms) = 6000ms
                      setTimeout(() => {
                        setIsHoverAnimationRunning(false);
                        // 마지막 액션에 따라 스케줄된 액션 실행
                        if (lastActionRef.current === 'enter' && pendingHoverEnterRef.current) {
                          // 마지막 액션이 'enter'이고 호버 시작이 스케줄되어 있으면 호버 시작 애니메이션 실행
                          setPendingHoverEnter(false);
                          pendingHoverEnterRef.current = false;
                          lastActionRef.current = null; // 액션 실행 후 초기화
                          // 호버 시작 애니메이션 실행
                          setIsHoverAnimationRunning(true);
                          setIsRightCardHovered(true);
                          setHoverPhase('spread');
                          setIsZIndexChanged(false);
                          setTimeout(() => {
                            setIsZIndexChanged(true);
                          }, HOVER_Z_INDEX_CHANGE_DELAY_MS);
                          setTimeout(() => {
                            setHoverPhase('close');
                          }, HOVER_ANIMATION_SPEED_MS);
                          setTimeout(() => {
                            setIsHoverAnimationRunning(false);
                          }, HOVER_ANIMATION_SPEED_MS + HOVER_ANIMATION_SPEED_MS);
                        } else if (lastActionRef.current === 'enter' && !pendingHoverEnterRef.current) {
                          // 마지막 액션이 'enter'이지만 호버 시작이 스케줄되지 않았으면 호버 상태 유지 (호버 해제 스케줄 취소)
                          // 이 경우는 호버 해제 애니메이션 완료 후 호버 상태를 유지해야 함
                          lastActionRef.current = null; // 액션 실행 후 초기화
                        } else if (lastActionRef.current === 'leave') {
                          // 마지막 액션이 'leave'이면 호버 해제 상태 유지 (호버 시작 스케줄 취소)
                          setPendingHoverEnter(false);
                          pendingHoverEnterRef.current = false;
                          lastActionRef.current = null; // 액션 실행 후 초기화
                        }
                      }, HOVER_ANIMATION_SPEED_MS + HOVER_ANIMATION_SPEED_MS); // spread + none transition 완료
                    } else if (isHoverAnimationRunning && isRightCardHovered) {
                      // 호버 시작 애니메이션이 진행 중이면, 마지막 액션을 'leave'로 설정
                      lastActionRef.current = 'leave'; // 마지막 액션을 'leave'로 설정
                      // 마지막 액션이 'leave'이면 호버 해제 스케줄
                      if (lastActionRef.current === 'leave') {
                        setPendingHoverLeave(true);
                        pendingHoverLeaveRef.current = true;
                      }
                    } else if (isHoverAnimationRunning && hoverPhase === 'spread' && isRightCardHovered) {
                      // 호버 해제 애니메이션이 진행 중이면, 마지막 액션을 'leave'로 설정
                      // hoverPhase가 'spread'이고 isRightCardHovered가 true이면 호버 해제 애니메이션 진행 중
                      lastActionRef.current = 'leave'; // 마지막 액션을 'leave'로 설정
                      // 마지막 액션이 'leave'이면 호버 시작 스케줄 취소
                      if (lastActionRef.current === 'leave') {
                        setPendingHoverEnter(false);
                        pendingHoverEnterRef.current = false;
                      }
                    }
                  } else {
                    setIsRightCardHovered(false);
                    setHoverPhase('none');
                    setIsZIndexChanged(false);
                    setIsHoverAnimationRunning(false);
                    setPendingHoverLeave(false);
                    setPendingHoverEnter(false);
                    pendingHoverLeaveRef.current = false;
                    pendingHoverEnterRef.current = false;
                    lastActionRef.current = null;
                  }
                }}
                style={{
                  opacity: isAnimating ? 1 : 0,
                  transform: 'var(--home-card-transform)',
                  '--home-card-transform': rightCardTransform,
                  transformOrigin: 'center center',
                  transformStyle: 'preserve-3d',
                  zIndex: (isInMarker1(scrollProgress) && isZIndexChanged) ? CARD_Z_INDEX.HOVER_RIGHT : CARD_Z_INDEX.DEFAULT_RIGHT, // z-index 변경 타이밍 제어
                  marginLeft: '0px', // 퍼센트 기반 transform으로 겹침 조절
                  transition: getRightCardTransition(scrollProgress, isScrollingUp, isAnimating),
                } as CSSProperties}
              >
              <div className="h-full w-full p-12 flex flex-col relative" style={{ transformStyle: 'preserve-3d' }}>
                <div className="flex-1 relative" style={{ transformStyle: 'preserve-3d' }}>
                    <RightCardContent
                      selectedCertification={selectedCertification}
                      photoCardFade={photoCardFade}
                      onCertificationsLoaded={handleCertificationsLoaded}
                      onHomePhotosLoaded={handleHomePhotosLoaded}
                    />
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* 2번 마커 구간 - Apps */}
          <div ref={appsRef} className="h-screen flex items-center justify-center bg-slate-900 text-white">
          </div>

          {/* 4번 마커 구간 - Comments */}
          <div ref={commentRef} className="h-screen flex items-center justify-center bg-slate-900 text-white">
          </div>

          {/* 4번 마커 구간 */}
          <div ref={marker4Ref} className="h-screen flex items-center justify-center bg-slate-900 text-white">
          </div>
        </div>
    </>
  );
}
