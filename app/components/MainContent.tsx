'use client';

import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import WelcomeScreen from './WelcomeScreen';
import MobileContent from './MobileContent';
import ShortViewportScreen from './ShortViewportScreen';

// 상수 import
import { CARD_SCALE, CARD_Z_INDEX } from '../constants/cardConstants';
import { HOVER_ANIMATION_SPEED_MS, HOVER_Z_INDEX_CHANGE_DELAY_MS } from '../constants/hoverConstants';
import { isInMarker1 } from '../constants/markerConstants';
import { useFadeAnimation } from '../hooks/useFadeAnimation';
import { useCardState } from '../hooks/useCardState';
import { useWelcomeFlow } from '../hooks/useWelcomeFlow';
import { useMainContentData } from '../hooks/useMainContentData';
import { useMainContentRouteSync } from '../hooks/useMainContentRouteSync';
import { useMainContentLanguage } from '../hooks/useMainContentLanguage';
import { useDesktopPhotoCardFade } from '../hooks/useDesktopPhotoCardFade';
import useMediaQuery from '../hooks/useMediaQuery';
import CardFront from './Card/CardFront';
import CardBack from './Card/CardBack';
import RightCardContent from './Card/RightCardContent';
import {
  getLeftCardTransform,
  getRightCardTransform,
  getLeftCardTransition,
  getRightCardTransition,
} from '../utils/styleUtils';
import { debugEnvironmentVariables } from '../utils/envDebug';

const shouldLog = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';
const MAX_DESKTOP_WHEEL_SCROLL_SPEED_PX_PER_SECOND = 2000;
const MIN_WHEEL_FRAME_MS = 16;
const MAX_WHEEL_FRAME_MS = 50;
const SHORT_VIEWPORT_MEDIA_QUERY = '(max-height: 499.5px)';

export default function MainContent() {
  // 상수들을 별도 파일에서 import하여 사용

  const {
    showContent,
    isAnimating,
    welcomeMode,
    handleWelcomeComplete,
  } = useWelcomeFlow();
  const isShortViewport = useMediaQuery(SHORT_VIEWPORT_MEDIA_QUERY);
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
  const leftCardRef = useRef<HTMLDivElement>(null);
  const rightCardRef = useRef<HTMLDivElement>(null);
  const desktopPhotoCardFade = useDesktopPhotoCardFade({
    leftCardRef,
    rightCardRef,
    isAnimating,
    scrollProgress,
    showContent,
  });
  const { language, setLanguage } = useMainContentLanguage();
  const [selectedCertification, setSelectedCertification] = useState<string | null>(null); // 선택된 자격증 키 (null이면 홈 포토 표시)
  const [currentProjectPage, setCurrentProjectPage] = useState(1); // 프로젝트 페이지네이션 현재 페이지
  const [isHomeCardShaking, setIsHomeCardShaking] = useState(false);
  const homeCardShakeTimeoutRef = useRef<number | null>(null);
  const {
    apps,
    profileName,
    profileDescription,
    profileLinks,
    allResourcesLoaded,
    progressPercent,
    handleCertificationsLoaded,
    handleHomePhotosLoaded,
    handleHomePhotosProgress,
  } = useMainContentData(language);

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

  // 프로젝트 관련 상수들은 constants/gridConstants.ts에서 import
  
  // 각 마커 구간에 대한 ref
  const homeRef = useRef<HTMLDivElement>(null);
  const appsRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLDivElement>(null);
  const marker4Ref = useRef<HTMLDivElement>(null);
  
  const pathname = usePathname();

  useEffect(() => {
    if (!showContent || !isAnimating) return;

    let rafId: number | null = null;
    let lastScrollY = window.scrollY; // 이전 스크롤 위치 추적
    let lastWheelTimestamp: number | null = null;

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
      const shouldBlockHomeScroll =
        isAtTop && isHoverLeaveFlowActiveRef.current && !isHomeCardDefault;
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
      return isAtTop && isHoverLeaveFlowActiveRef.current && !isHomeCardDefault();
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

    const canNestedRegionConsumeWheel = (event: WheelEvent) => {
      if (!(event.target instanceof Element)) return false;
      const scrollRegion = event.target.closest<HTMLElement>('[data-card-scroll-region]');
      if (!scrollRegion || scrollRegion.scrollHeight <= scrollRegion.clientHeight) return false;

      const maxScrollTop = scrollRegion.scrollHeight - scrollRegion.clientHeight;
      return event.deltaY < 0
        ? scrollRegion.scrollTop > 0
        : scrollRegion.scrollTop < maxScrollTop - 1;
    };

    const getWheelDeltaInPixels = (event: WheelEvent) => {
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        return event.deltaY * 16;
      }
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return event.deltaY * window.innerHeight;
      }
      return event.deltaY;
    };

    const applyDesktopWheelSpeedLimit = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        !window.matchMedia('(min-width: 601px)').matches ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX) ||
        canNestedRegionConsumeWheel(event)
      ) {
        lastWheelTimestamp = null;
        return false;
      }

      const elapsedMs = lastWheelTimestamp === null
        ? MIN_WHEEL_FRAME_MS
        : Math.min(
            Math.max(event.timeStamp - lastWheelTimestamp, MIN_WHEEL_FRAME_MS),
            MAX_WHEEL_FRAME_MS,
          );
      lastWheelTimestamp = event.timeStamp;

      const deltaPixels = getWheelDeltaInPixels(event);
      const maximumDelta = MAX_DESKTOP_WHEEL_SCROLL_SPEED_PX_PER_SECOND * (elapsedMs / 1000);
      const limitedDelta = Math.sign(deltaPixels) * Math.min(Math.abs(deltaPixels), maximumDelta);

      event.preventDefault();
      event.stopPropagation();
      window.scrollBy({ top: limitedDelta, behavior: 'auto' });
      return true;
    };

    const onWheelCapture = (e: WheelEvent) => {
      const blocked = shouldBlockScrollInput();
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        triggerHomeCardShake();
        return;
      }
      applyDesktopWheelSpeedLimit(e);
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

  useMainContentRouteSync({ pathname, showContent, isAnimating });

  // 페이드 애니메이션 계산은 useFadeAnimation 훅 사용
  const { greetingFade, photoCardFade, appsFade } = useFadeAnimation(scrollProgress);

  const rightCardTransform = isAnimating
    ? `${getRightCardTransform(scrollProgress, hoverPhase)} ${selectedCertification ? 'rotateY(180deg)' : ''}`
    : `scale(${CARD_SCALE}) translateX(32px) rotate(2deg) ${selectedCertification ? 'rotateY(180deg)' : ''}`;

  return (
    <>
      {!showContent && (
        <WelcomeScreen
          onComplete={handleWelcomeComplete}
          ready={welcomeMode !== 'checking' && allResourcesLoaded}
          progressPercent={progressPercent}
          compact={welcomeMode !== 'full'}
        />
      )}
      <div
        aria-hidden={isShortViewport}
        className="desktop-experience desktop-background min-h-[300vh]"
        style={{
          opacity: isShortViewport ? 0 : showContent ? 1 : 0,
          pointerEvents: isShortViewport ? 'none' : showContent ? 'auto' : 'none',
        }}
      >
          <span className={`desktop-brand fixed left-8 top-8 z-50 transition-all duration-1000 ease-out ${
            isAnimating
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`} style={{ color: 'rgb(196 181 253)' }}>
            JACE-S
          </span>

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
            className={`desktop-background min-h-screen flex items-center justify-center p-4 transition-all duration-1000 ease-out sticky top-0 ${
              isAnimating
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4'
            }`}
          >
            {/* 세로 상태선 - 왼쪽 고정 (1번~4번 마커) */}
            <div
              className="desktop-navigation fixed left-8 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-3"
              style={{ gap: 'clamp(0.25rem, 1.5vh, 0.75rem)' }}
            >
              {/* 1번 마커 */}
              <div
                className="desktop-navigation-item flex flex-col items-center gap-2"
                style={{ gap: 'clamp(0.25rem, 1vh, 0.5rem)' }}
              >
                <button
                  onClick={() => {
                    const windowHeight = window.innerHeight;
                    window.scrollTo({
                      top: windowHeight * 0,
                      behavior: 'smooth',
                    });
                  }}
                  className={`desktop-navigation-button h-3 rounded-full transition-all duration-300 cursor-pointer ${
                    scrollProgress === 0
                      ? 'bg-purple-600 w-9'
                      : scrollProgress > 0
                      ? 'bg-purple-400 w-3'
                      : 'bg-slate-600 w-3'
                  }`}
                  style={{
                    height: 'clamp(0.35rem, 1.6vh, 0.75rem)',
                    width: scrollProgress === 0
                      ? 'clamp(1.5rem, 4.5vh, 2.25rem)'
                      : 'clamp(0.35rem, 1.6vh, 0.75rem)',
                  }}
                  aria-label="Home"
                />
                <span
                  className="desktop-navigation-label text-xs text-white/80 whitespace-nowrap"
                  style={{ fontSize: 'clamp(0.55rem, 1.7vh, 0.75rem)' }}
                >
                  home
                </span>
              </div>

              {/* 진행 바 (1번~2번 사이) */}
              <div
                className="desktop-navigation-progress w-1 h-32 bg-slate-700/50 relative overflow-hidden rounded-full"
                style={{
                  width: 'clamp(0.18rem, 0.35vh, 0.25rem)',
                  height: 'clamp(2rem, 18vh, 8rem)',
                }}
              >
                <div
                  className="absolute top-0 left-0 w-full bg-purple-600 transition-all duration-300 ease-out rounded-full"
                  style={{
                    height: scrollProgress >= 1 ? '100%' : `${(scrollProgress / 1) * 100}%`,
                  }}
                />
              </div>

              {/* 2번 마커 */}
              <div
                className="desktop-navigation-item flex flex-col items-center gap-2"
                style={{ gap: 'clamp(0.25rem, 1vh, 0.5rem)' }}
              >
                <button
                  onClick={() => {
                    const windowHeight = window.innerHeight;
                    window.scrollTo({
                      top: windowHeight * 1.5,
                      behavior: 'smooth',
                    });
                  }}
                  className={`desktop-navigation-button h-3 rounded-full transition-all duration-300 cursor-pointer ${
                    scrollProgress >= 1 && scrollProgress < 2
                      ? 'bg-purple-600 w-9'
                      : scrollProgress >= 2
                      ? 'bg-purple-400 w-3'
                      : 'bg-slate-600 w-3'
                  }`}
                  style={{
                    height: 'clamp(0.35rem, 1.6vh, 0.75rem)',
                    width: scrollProgress >= 1 && scrollProgress < 2
                      ? 'clamp(1.5rem, 4.5vh, 2.25rem)'
                      : 'clamp(0.35rem, 1.6vh, 0.75rem)',
                  }}
                  aria-label="Apps"
                />
                <span
                  className="desktop-navigation-label text-xs text-white/80 whitespace-nowrap"
                  style={{ fontSize: 'clamp(0.55rem, 1.7vh, 0.75rem)' }}
                >
                  apps
                </span>
              </div>

              {/* 진행 바 (2번~4번 사이) */}
              <div
                className="desktop-navigation-progress w-1 h-32 bg-slate-700/50 relative overflow-hidden rounded-full"
                style={{
                  width: 'clamp(0.18rem, 0.35vh, 0.25rem)',
                  height: 'clamp(2rem, 18vh, 8rem)',
                }}
              >
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
              <div
                className="desktop-navigation-item flex flex-col items-center gap-2"
                style={{ gap: 'clamp(0.25rem, 1vh, 0.5rem)' }}
              >
                <button
                  onClick={() => {
                    const windowHeight = window.innerHeight;
                    window.scrollTo({
                      top: windowHeight * 3,
                      behavior: 'smooth',
                    });
                  }}
                  className={`desktop-navigation-button h-3 rounded-full transition-all duration-300 cursor-pointer ${
                    scrollProgress >= 3
                      ? 'bg-purple-600 w-9'
                      : 'bg-slate-600 w-3'
                  }`}
                  style={{
                    height: 'clamp(0.35rem, 1.6vh, 0.75rem)',
                    width: scrollProgress >= 3
                      ? 'clamp(1.5rem, 4.5vh, 2.25rem)'
                      : 'clamp(0.35rem, 1.6vh, 0.75rem)',
                  }}
                  aria-label="Comment"
                />
                <span
                  className="desktop-navigation-label text-xs text-white/80 whitespace-nowrap"
                  style={{ fontSize: 'clamp(0.55rem, 1.7vh, 0.75rem)' }}
                >
                  comments
                </span>
              </div>
            </div>

            {/* 1번 마커 구간 - Home */}
            <div ref={homeRef} className="desktop-card-stage relative w-full flex items-center justify-center gap-0" style={{ perspective: '1000px' }}>
              {/* 왼쪽 카드 - 오른쪽으로 이동 (옆으로만 움직임), 세 번째 구간에서 플립 */}
              <div
                ref={leftCardRef}
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
                  profileLinks={profileLinks || undefined}
                  greetingText={greetingText[language]}
                  nameSuffix={nameSuffix[language]}
                  disablePointerEvents={isCardFlipped || (scrollProgress > 0 && scrollProgress < 1) || scrollProgress >= 2}
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
                ref={rightCardRef}
                data-role="right-card"
                className={`desktop-photo-card w-1/2 h-full rounded-2xl relative transform cursor-pointer ${isHomeCardShaking ? 'home-card-shake' : ''}`}
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
                    const hasActiveHoverState =
                      hoverPhaseRef.current !== 'none' ||
                      isRightCardHoveredRef.current ||
                      isHoverAnimationRunningRef.current ||
                      isZIndexChangedRef.current ||
                      pendingHoverEnterRef.current ||
                      pendingHoverLeaveRef.current;
                    if (!hasActiveHoverState) {
                      isHoverLeaveFlowActiveRef.current = false;
                      return;
                    }

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
                      photoCardFade={desktopPhotoCardFade}
                      onCertificationsLoaded={handleCertificationsLoaded}
                      onHomePhotosLoaded={handleHomePhotosLoaded}
                      onHomePhotosProgress={handleHomePhotosProgress}
                      instantPhotoSwitch
                    />
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* 2번 마커 구간 - Apps */}
          <div ref={appsRef} className="desktop-background h-screen flex items-center justify-center text-white">
          </div>

          {/* 4번 마커 구간 - Comments */}
          <div ref={commentRef} className="desktop-background h-screen flex items-center justify-center text-white">
          </div>

          {/* 4번 마커 구간 */}
          <div ref={marker4Ref} className="desktop-background h-screen flex items-center justify-center text-white">
          </div>
        </div>
      <MobileContent
        visible={showContent && !isShortViewport}
        isViewportBlocked={isShortViewport}
        apps={apps}
        currentProjectPage={currentProjectPage}
        setCurrentProjectPage={setCurrentProjectPage}
        language={language}
        setLanguage={setLanguage}
        certificationText={certificationText}
        profileName={profileName}
        profileDescription={profileDescription}
        profileLinks={profileLinks || undefined}
        greetingText={greetingText[language]}
        nameSuffix={nameSuffix[language]}
      />
      {isShortViewport && <ShortViewportScreen language={language} />}
    </>
  );
}
