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
const DESKTOP_MEDIA_QUERY = '(min-width: 601px)';
const MAX_SCROLL_PROGRESS = 3;
const APPS_START_PROGRESS = 1;
const APPS_END_PROGRESS = 2;
const APPS_BUTTON_TARGET_PROGRESS = 1.5; // 네비게이터 apps 버튼이 이동하는 지점
const SCROLL_REARM_DISTANCE_PROGRESS = 0.2;
const WHEEL_GESTURE_IDLE_MS = 300;
// 스크롤이 멈추면 잠금은 저절로 풀린다. 다만 느리게 스크롤해도 자물쇠가 보이도록
// 최소 표시 시간을 보장한다 (이보다 일찍 풀리지 않는다).
const APPS_LOCK_MIN_HOLD_MS = 500;
const SHORT_VIEWPORT_MEDIA_QUERY = '(max-height: 499.5px)';
const APPS_LOCK_BODY_PATH = 'M12 10.5 C10.3 10.5 8.7 10.5 7 10.5 C5.9 10.5 5 11.4 5 12.5 C5 14.5 5 16.5 5 18.4 C5 19.3 5.7 20 6.6 20 C10.2 20 13.8 20 17.4 20 C18.3 20 19 19.3 19 18.4 C19 16.5 19 14.5 19 12.5 C19 11.4 18.1 10.5 17 10.5 C15.3 10.5 13.7 10.5 12 10.5 Z';
// 고리: 오른쪽 다리는 길게(y 17까지) 몸통 깊숙이, 왼쪽 다리는 짧게(y 11.5) 몸통 상단에 살짝만 걸친다.
// 몸통보다 먼저 그려서 z축상 뒤에 놓이므로, 몸통(y 10.5~20)에 가려진 부분은 보이지 않는다.
const APPS_SHACKLE_PATH = 'M15 17 L15 8.1 C15 6.44 13.66 5.1 12 5.1 C10.34 5.1 9 6.44 9 8.1 L9 11.2';
// 잠금 해제 시 고리만 위로 올라온다. 짧은 왼쪽 다리가 몸통 위로 빠져나오며 열린 것처럼 보인다.
const APPS_SHACKLE_OPEN_TRANSFORM = 'translateY(-3px)';
// 자물쇠는 평상시 숨어 있다가 아래 단계에서만 나타난다.
//   closing -> closed : 재잠금 (고리 낙하 후 사라짐)
//   holding -> opening -> opened : 진입 정지 (고정 -> 고리 상승 -> 사라지며 활성 상태로)
type AppsLockPhase = 'closing' | 'closed' | 'holding' | 'opening' | 'opened' | null;

const APPS_LOCK_FADE_MS = 200; // 자물쇠 등장/퇴장 페이드
const APPS_UNLOCK_OPEN_MS = 360; // 고리 상승
const APPS_UNLOCK_OPEN_EASING = 'cubic-bezier(0.34, 1.32, 0.64, 1)'; // 살짝 튀어오르며 열림
// 잠길 때는 자물쇠가 먼저 나타난 뒤(delay) 고리가 가속하며 내려꽂힌다.
const APPS_LOCK_CLOSE_MS = 240;
const APPS_LOCK_CLOSE_DELAY_MS = 110;
const APPS_LOCK_CLOSE_EASING = 'cubic-bezier(0.55, 0, 0.85, 0.35)';
const APPS_LOCK_CLOSE_HOLD_MS = 260; // 잠긴 모습을 잠깐 보여주고 사라진다
// 정지 상태에서 계속 굴릴 때만 뜨는 중앙 안내 문구. 자물쇠가 풀리면 함께 사라진다.
const APPS_LOCK_HINT_FADE_IN_MS = 260;
const APPS_LOCK_HINT_FADE_OUT_MS = 420;
const APPS_LOCK_HINT_OPACITY = 0.72;
// 막히자마자 띄우면 다급해 보인다. 잠긴 뒤 이만큼 더 굴리고 있을 때만 안내가 뜬다.
const APPS_LOCK_HINT_DELAY_MS = 900;
// 문구 뒤에 깔리는 띠. 화면 좌우로 쭉 이어지고, 페이드아웃은 좌우 방향으로만 일어난다.
// 위아래 경계는 흐리지 않고 선으로 또렷하게 남는다.
const APPS_LOCK_HINT_BAND_HEIGHT = '2rem';
const APPS_LOCK_HINT_BAND_WIDTH = 'min(24rem, 58vw)';
const APPS_LOCK_HINT_BAND_GRADIENT =
  'linear-gradient(90deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.6) 22%, rgba(15,23,42,0.8) 50%, rgba(15,23,42,0.6) 78%, rgba(15,23,42,0) 100%)';
// 위아래 보더도 같은 방향으로만 사라진다 (양끝에서 뚝 끊기지 않도록).
const APPS_LOCK_HINT_BAND_BORDER =
  'linear-gradient(90deg, rgba(226,232,240,0) 0%, rgba(226,232,240,0.55) 22%, rgba(226,232,240,0.85) 50%, rgba(226,232,240,0.55) 78%, rgba(226,232,240,0) 100%)';
const APPS_LOCK_HINT_BAND_BORDER_WIDTH = '1px';
// 해제 연출: 문구 위로 자물쇠가 떠오른 뒤 고리가 열리고, 잠깐 머물다 전체가 함께 사라진다.
const APPS_HINT_LOCK_APPEAR_MS = 220;
const APPS_HINT_LOCK_HOLD_MS = 180;
// 안내 오버레이 단계. 'hint'는 문구가 떠 있는 동안, 'unlocking'은 해제 연출 구간이다.
type AppsHintPhase = 'hint' | 'unlocking' | null;
// apps 마커는 "멈춰 섰던 자리"에서만 활성이다. home 마커의 scrollProgress === 0 에 대응하되,
// 스크롤 값이 정확히 떨어지지 않을 수 있어 약간의 허용 오차를 둔다.
const APPS_ACTIVE_TOLERANCE_PROGRESS = 0.02;

const sendScrollDebugLog = (event: string, details: Record<string, unknown> = {}) => {
  if (process.env.NODE_ENV !== 'development') return;

  void fetch('/api/debug/scroll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event, timestamp: Date.now(), ...details }),
  }).catch(() => undefined);
};

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
  // apps 게이트의 지속 상태. 잠겨 있으면 apps에 진입하는 첫 시도에서 한 번 멈춘다.
  // apps 바깥으로 충분히 멀어졌을 때만 다시 잠긴다.
  const appsGateLockedRef = useRef(true);
  const appStopWaitingForGestureRef = useRef<'down' | 'up' | null>(null);
  const appStopWaitingProgressRef = useRef<number | null>(null);
  const [appStopWaitingForGesture, setAppStopWaitingForGesture] = useState<'down' | 'up' | null>(null);
  // 자물쇠 표시 단계. null이면 자물쇠가 숨겨진 평상시(비활성/활성) 마커다.
  // closing/holding/opening 동안 보이고, closed/opened는 페이드아웃 구간이다.
  const appsLockPhaseTimeoutRef = useRef<number | null>(null);
  const [appsLockPhase, setAppsLockPhase] = useState<AppsLockPhase>(null);
  // 안내 문구는 정지된 채로 계속 굴릴 때만 뜬다. 바로 멈춘 사용자에게는 보이지 않는다.
  const appsHintPhaseRef = useRef<AppsHintPhase>(null);
  const [appsHintPhase, setAppsHintPhase] = useState<AppsHintPhase>(null);
  const appsHintTimeoutRef = useRef<number | null>(null);
  const appsHintShackleRafRef = useRef<number | null>(null);
  const [isAppsHintShackleOpen, setIsAppsHintShackleOpen] = useState(false);
  // 마커가 활성으로 보일 기준 progress. 정지했던 지점(또는 네비 버튼 목적지)이며,
  // 여기서 벗어나는 순간 비활성으로 돌아간다.
  const [appsActiveAnchor, setAppsActiveAnchor] = useState<number | null>(null);
  // 잠기는 순간 고리를 '열린 위치'에 한 프레임 세워둔 뒤 닫힌 위치로 트랜지션시키기 위한 상태
  const appsLockDropRafRef = useRef<number | null>(null);
  const [isAppsLockDropping, setIsAppsLockDropping] = useState(false);
  const lastWheelEventTimestampRef = useRef<number | null>(null);
  // 네비게이터 버튼처럼 휠 밖에서 잠금을 풀어야 하는 곳에서 쓰는 핸들
  // (대기 중에는 scroll 핸들러가 위치를 되돌리므로 먼저 해제해야 한다)
  const releaseAppsStopRef = useRef<(() => void) | null>(null);
  const wheelGestureIdleTimeoutRef = useRef<number | null>(null);
  const appsStopStartedAtRef = useRef<number | null>(null);
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

  // apps 진입 정지 안내 문구 매핑
  const appsLockHintText = {
    en: 'Pause for a moment',
    ko: '잠시 멈춰주세요',
    ja: '少し止まってください',
    zh: '请稍作停留',
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
    if (!showContent || !isAnimating) {
      sendScrollDebugLog('effect-inactive', { showContent, isAnimating });
      return;
    }

    sendScrollDebugLog('effect-active', {
      showContent,
      isAnimating,
      scrollY: window.scrollY,
    });

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

      const waitingDirection = appStopWaitingForGestureRef.current;
      const waitingProgress = appStopWaitingProgressRef.current;
      if (waitingDirection !== null && waitingProgress !== null) {
        const waitingScrollY = windowHeight * waitingProgress;

        if (Math.abs(scrollY - waitingScrollY) > 1) {
          window.scrollTo({
            top: waitingScrollY,
            behavior: 'auto',
          });
          lastScrollY = waitingScrollY;
          sendScrollDebugLog('scroll-recovered-at-apps', {
            direction: waitingDirection,
            scrollY,
            recoveredScrollY: waitingScrollY,
          });
          return;
        }
      }

      // 스크롤 진행도 계산 (3개 화면 높이 기준: 0~3, 플립 완료 시점까지)
      const calculatedProgress = Math.min(Math.max(scrollY / windowHeight, 0), MAX_SCROLL_PROGRESS); // 0~3

      // 재잠금은 실제 위치 기준으로 판단한다. 휠뿐 아니라 네비 버튼/키보드/스크롤바로
      // 이동한 경우에도 게이트가 다시 잠겨야 하기 때문이다.
      updateAppsGateLock(calculatedProgress);


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

    // 게이트가 잠긴 상태에서 apps 진입 경계를 넘으려 하면 그 지점을 돌려준다.
    const resolveAppsStop = (
      direction: 'down' | 'up',
      currentProgress: number,
      nextProgress: number,
    ) => {
      if (!appsGateLockedRef.current) return null;

      const stopProgress =
        direction === 'down' ? APPS_START_PROGRESS : APPS_END_PROGRESS;

      const crosses =
        direction === 'down'
          ? currentProgress < stopProgress && nextProgress >= stopProgress
          : currentProgress > stopProgress && nextProgress <= stopProgress;

      return crosses ? stopProgress : null;
    };

    const clearAppsLockPhaseTimeout = () => {
      if (appsLockPhaseTimeoutRef.current !== null) {
        window.clearTimeout(appsLockPhaseTimeoutRef.current);
        appsLockPhaseTimeoutRef.current = null;
      }
    };

    // 해제: 고리가 올라간 뒤(opening) 열린 채로 사라진다(opened).
    // 사라지는 동안 버튼은 활성 상태로 커지므로 두 모션이 이어져 보인다.
    const startAppsUnlockAnimation = () => {
      clearAppsLockPhaseTimeout();

      setAppsLockPhase('opening');
      appsLockPhaseTimeoutRef.current = window.setTimeout(() => {
        setAppsLockPhase('opened');
        appsLockPhaseTimeoutRef.current = window.setTimeout(() => {
          appsLockPhaseTimeoutRef.current = null;
          setAppsLockPhase(null);
        }, APPS_LOCK_FADE_MS);
      }, APPS_UNLOCK_OPEN_MS);
    };

    // 재잠금: 자물쇠가 나타나며 고리가 내려꽂히고(closing), 잠깐 머문 뒤 사라진다(closed).
    // 고리를 열린 위치에 트랜지션 없이 한 프레임 세워둬야 '내려오는' 모션이 그려진다.
    const startAppsRelockAnimation = () => {
      clearAppsLockPhaseTimeout();

      if (appsLockDropRafRef.current !== null) {
        window.cancelAnimationFrame(appsLockDropRafRef.current);
      }

      setIsAppsLockDropping(true);
      setAppsLockPhase('closing');
      appsLockDropRafRef.current = window.requestAnimationFrame(() => {
        appsLockDropRafRef.current = window.requestAnimationFrame(() => {
          appsLockDropRafRef.current = null;
          setIsAppsLockDropping(false);
        });
      });

      appsLockPhaseTimeoutRef.current = window.setTimeout(() => {
        setAppsLockPhase('closed');
        appsLockPhaseTimeoutRef.current = window.setTimeout(() => {
          appsLockPhaseTimeoutRef.current = null;
          setAppsLockPhase(null);
        }, APPS_LOCK_FADE_MS);
      }, APPS_LOCK_CLOSE_DELAY_MS + APPS_LOCK_CLOSE_MS + APPS_LOCK_CLOSE_HOLD_MS);
    };

    // apps 바깥으로 SCROLL_REARM_DISTANCE_PROGRESS 이상 벗어나면 게이트가 다시 잠긴다.
    // 정지 직후 위치(경계선 위)는 이 범위 밖이라 곧바로 재잠금되지 않는다.
    const updateAppsGateLock = (nextProgress: number) => {
      if (appsGateLockedRef.current) return;

      const relockedBelow = nextProgress <= APPS_START_PROGRESS - SCROLL_REARM_DISTANCE_PROGRESS;
      const relockedAbove = nextProgress >= APPS_END_PROGRESS + SCROLL_REARM_DISTANCE_PROGRESS;

      if (relockedBelow || relockedAbove) {
        appsGateLockedRef.current = true;
        startAppsRelockAnimation();
      }
    };

    const clearAppsHintTimeout = () => {
      if (appsHintTimeoutRef.current !== null) {
        window.clearTimeout(appsHintTimeoutRef.current);
        appsHintTimeoutRef.current = null;
      }
      if (appsHintShackleRafRef.current !== null) {
        window.cancelAnimationFrame(appsHintShackleRafRef.current);
        appsHintShackleRafRef.current = null;
      }
    };

    const showAppsLockHint = () => {
      clearAppsHintTimeout();
      appsHintPhaseRef.current = 'hint';
      setIsAppsHintShackleOpen(false);
      setAppsHintPhase('hint');
    };

    // 해제 연출. 고리는 자물쇠가 떠오른 뒤에 열리도록 transition delay로 미뤄져 있어서
    // 여기서는 '닫힘 -> 열림' 상태만 한 프레임 뒤에 뒤집어 준다.
    const startAppsHintUnlockOutro = () => {
      clearAppsHintTimeout();

      appsHintPhaseRef.current = 'unlocking';
      setAppsHintPhase('unlocking');
      setIsAppsHintShackleOpen(false);

      appsHintShackleRafRef.current = window.requestAnimationFrame(() => {
        appsHintShackleRafRef.current = window.requestAnimationFrame(() => {
          appsHintShackleRafRef.current = null;
          setIsAppsHintShackleOpen(true);
        });
      });

      appsHintTimeoutRef.current = window.setTimeout(() => {
        appsHintTimeoutRef.current = null;
        appsHintPhaseRef.current = null;
        setAppsHintPhase(null);
      }, APPS_HINT_LOCK_APPEAR_MS + APPS_UNLOCK_OPEN_MS + APPS_HINT_LOCK_HOLD_MS);
    };

    const clearAppStopWaitingForGesture = () => {
      if (wheelGestureIdleTimeoutRef.current !== null) {
        window.clearTimeout(wheelGestureIdleTimeoutRef.current);
        wheelGestureIdleTimeoutRef.current = null;
      }

      if (appStopWaitingForGestureRef.current === null) return;

      appStopWaitingForGestureRef.current = null;
      appStopWaitingProgressRef.current = null;
      appsStopStartedAtRef.current = null;
      setAppStopWaitingForGesture(null);
      // 문구가 떠 있었다면 그 자리에 자물쇠가 나타나 열린 뒤 전체가 함께 사라진다.
      if (appsHintPhaseRef.current === 'hint') {
        startAppsHintUnlockOutro();
      }
      startAppsUnlockAnimation();
    };

    releaseAppsStopRef.current = clearAppStopWaitingForGesture;

    // 막힌 채로 안내를 띄울 만큼 오래 굴렸는지.
    const hasHeldLongEnoughForHint = () => {
      const startedAt = appsStopStartedAtRef.current;
      return startedAt !== null && Date.now() - startedAt >= APPS_LOCK_HINT_DELAY_MS;
    };

    // 잠긴 뒤 최소 표시 시간이 아직 안 지났는지. 이 동안에는 어떤 이유로도 풀리지 않는다.
    const isWithinAppsLockMinHold = () => {
      const startedAt = appsStopStartedAtRef.current;
      return startedAt !== null && Date.now() - startedAt < APPS_LOCK_MIN_HOLD_MS;
    };

    // 스크롤이 멎으면 잠금이 저절로 풀린다. 최소 표시 시간이 남았으면 그만큼 미룬다.
    const scheduleAppStopWaitingTimeout = () => {
      if (wheelGestureIdleTimeoutRef.current !== null) {
        window.clearTimeout(wheelGestureIdleTimeoutRef.current);
      }

      const startedAt = appsStopStartedAtRef.current;
      const heldFor = startedAt === null ? 0 : Date.now() - startedAt;
      const delay = Math.max(WHEEL_GESTURE_IDLE_MS, APPS_LOCK_MIN_HOLD_MS - heldFor);

      wheelGestureIdleTimeoutRef.current = window.setTimeout(() => {
        wheelGestureIdleTimeoutRef.current = null;
        if (appStopWaitingForGestureRef.current === null) return;

        clearAppStopWaitingForGesture();
        lastWheelEventTimestampRef.current = null;
        sendScrollDebugLog('wheel-gesture-idle-unlock');
      }, delay);
    };

    const stopAtAppsBoundary = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        !window.matchMedia(DESKTOP_MEDIA_QUERY).matches ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX)
      ) {
        lastWheelEventTimestampRef.current = null;
        return false;
      }

      const deltaPixels = getWheelDeltaInPixels(event);
      if (deltaPixels === 0) {
        lastWheelEventTimestampRef.current = null;
        return false;
      }

      const currentScrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const currentProgress = currentScrollY / windowHeight;
      const nextProgress = (currentScrollY + deltaPixels) / windowHeight;
      const direction = deltaPixels > 0 ? 'down' : 'up';
      const nestedRegionConsumes = canNestedRegionConsumeWheel(event);
      const lastWheelEventTimestamp = lastWheelEventTimestampRef.current;
      const isNewWheelGesture =
        lastWheelEventTimestamp === null ||
        event.timeStamp - lastWheelEventTimestamp > WHEEL_GESTURE_IDLE_MS;

      lastWheelEventTimestampRef.current = event.timeStamp;

      sendScrollDebugLog('wheel-input', {
        scrollY: currentScrollY,
        currentProgress,
        nextProgress,
        deltaPixels,
        direction,
        eventTimeStamp: event.timeStamp,
        isNewWheelGesture,
        nestedRegionConsumes,
        gateLocked: appsGateLockedRef.current,
        waitingDirection: appStopWaitingForGestureRef.current,
      });

      if (nestedRegionConsumes) {
        lastWheelEventTimestampRef.current = null;
        sendScrollDebugLog('wheel-nested-region');
        return false;
      }

      const waitingDirection = appStopWaitingForGestureRef.current;
      if (
        waitingDirection !== null &&
        !isWithinAppsLockMinHold() &&
        (isNewWheelGesture || waitingDirection !== direction)
      ) {
        clearAppStopWaitingForGesture();
      }

      if (appStopWaitingForGestureRef.current !== null) {
        // 계속 굴리는 동안에는 막고, 멎으면 타이머가 풀어 준다.
        scheduleAppStopWaitingTimeout();
        event.preventDefault();
        event.stopPropagation();
        // 막힌 채로 계속 굴리고 있다는 뜻이지만, 곧바로 띄우면 너무 급하다.
        // 잠긴 지 APPS_LOCK_HINT_DELAY_MS 이상 지나도록 굴리고 있을 때만 띄운다.
        if (appsHintPhaseRef.current === null && hasHeldLongEnoughForHint()) {
          showAppsLockHint();
        }
        sendScrollDebugLog('wheel-blocked-waiting', { direction, scrollY: currentScrollY });
        return true;
      }

      const stopProgress = resolveAppsStop(direction, currentProgress, nextProgress);

      if (stopProgress === null) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      appStopWaitingForGestureRef.current = direction;
      appStopWaitingProgressRef.current = stopProgress;
      appsStopStartedAtRef.current = Date.now();
      setAppStopWaitingForGesture(direction);
      setAppsActiveAnchor(stopProgress);
      clearAppsLockPhaseTimeout();
      setAppsLockPhase('holding');
      scheduleAppStopWaitingTimeout();
      window.scrollTo({
        top: windowHeight * stopProgress,
        behavior: 'auto',
      });
      sendScrollDebugLog('wheel-stop-at-apps', {
        direction,
        stopProgress,
        scrollY: currentScrollY,
      });

      appsGateLockedRef.current = false;

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
      stopAtAppsBoundary(e);
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
      releaseAppsStopRef.current = null;
      appsStopStartedAtRef.current = null;
      if (wheelGestureIdleTimeoutRef.current !== null) {
        window.clearTimeout(wheelGestureIdleTimeoutRef.current);
        wheelGestureIdleTimeoutRef.current = null;
      }
      if (appsLockPhaseTimeoutRef.current !== null) {
        window.clearTimeout(appsLockPhaseTimeoutRef.current);
        appsLockPhaseTimeoutRef.current = null;
      }
      if (appsLockDropRafRef.current !== null) {
        window.cancelAnimationFrame(appsLockDropRafRef.current);
        appsLockDropRafRef.current = null;
      }
      if (appsHintTimeoutRef.current !== null) {
        window.clearTimeout(appsHintTimeoutRef.current);
        appsHintTimeoutRef.current = null;
      }
      if (appsHintShackleRafRef.current !== null) {
        window.cancelAnimationFrame(appsHintShackleRafRef.current);
        appsHintShackleRafRef.current = null;
      }
      appsHintPhaseRef.current = null;
      setAppsHintPhase(null);
      setIsAppsHintShackleOpen(false);
      appStopWaitingForGestureRef.current = null;
      setAppStopWaitingForGesture(null);
      setAppsLockPhase(null);
      setAppsActiveAnchor(null);
      setIsAppsLockDropping(false);
      lastWheelEventTimestampRef.current = null;
      appStopWaitingProgressRef.current = null;
      appsGateLockedRef.current = true;
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
  const isAppsScrollLocked = appStopWaitingForGesture !== null;
  // 자물쇠가 보이는 동안에만 SVG가 마커를 대신 그린다. 그 외에는 home/comments 마커와
  // 완전히 동일하게 버튼의 배경색/너비 CSS 트랜지션만으로 비활성↔활성이 처리된다.
  const isAppsLockVisible =
    appsLockPhase === 'closing' ||
    appsLockPhase === 'holding' ||
    appsLockPhase === 'opening';
  // 페이드아웃(opened) 중에도 고리는 열린 채로 두어야 사라지면서 다시 내려오지 않는다.
  const isAppsShackleOpen =
    isAppsLockDropping || appsLockPhase === 'opening' || appsLockPhase === 'opened';
  // 안내 오버레이(띠 + 문구 + 해제 자물쇠)는 통째로 뜨고 통째로 사라진다.
  const isAppsHintVisible = appsHintPhase !== null;
  // home 마커의 scrollProgress === 0 과 같은 성격: 멈춰 섰던 자리에서만 활성.
  const isAppsInActiveRange =
    appsActiveAnchor !== null &&
    Math.abs(scrollProgress - appsActiveAnchor) <= APPS_ACTIVE_TOLERANCE_PROGRESS;

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

          {/* apps 진입 정지 안내 - 화면 중앙.
              잠금이 풀리면 문구 위로 자물쇠가 떠올라 열리고, 띠/문구/자물쇠가 한꺼번에 사라진다. */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
            style={{
              opacity: isAppsHintVisible ? 1 : 0,
              transition: `opacity ${
                isAppsHintVisible ? APPS_LOCK_HINT_FADE_IN_MS : APPS_LOCK_HINT_FADE_OUT_MS
              }ms ease-out`,
            }}
          >
            <div className="relative flex w-full items-center justify-center">
              {/* 문구 폭 남짓의 띠. 좌우로만 사라지고 위아래는 보더로 또렷하게 끊는다. */}
              <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                  width: APPS_LOCK_HINT_BAND_WIDTH,
                  height: APPS_LOCK_HINT_BAND_HEIGHT,
                  background: APPS_LOCK_HINT_BAND_GRADIENT,
                }}
              >
                <span
                  className="absolute left-0 top-0 w-full"
                  style={{
                    height: APPS_LOCK_HINT_BAND_BORDER_WIDTH,
                    background: APPS_LOCK_HINT_BAND_BORDER,
                  }}
                />
                <span
                  className="absolute bottom-0 left-0 w-full"
                  style={{
                    height: APPS_LOCK_HINT_BAND_BORDER_WIDTH,
                    background: APPS_LOCK_HINT_BAND_BORDER,
                  }}
                />
              </span>
              {/* 해제되는 순간 문구 위로 떠오르는 자물쇠 (네비게이터의 것과 같은 모양) */}
              <svg
                className="absolute left-1/2 top-1/2 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  width: 'clamp(1.1rem, 2.8vh, 1.6rem)',
                  height: 'clamp(1.1rem, 2.8vh, 1.6rem)',
                  transform: 'translate(-50%, -50%) translateY(-2.1rem)',
                  opacity: appsHintPhase === 'unlocking' ? 1 : 0,
                  transition: `opacity ${APPS_HINT_LOCK_APPEAR_MS}ms ease-out`,
                }}
              >
                {/* 고리를 먼저 그려서 몸통 뒤(z축 아래)에 둔다 */}
                <path
                  d={APPS_SHACKLE_PATH}
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7"
                  style={{
                    transformBox: 'view-box',
                    transform: isAppsHintShackleOpen ? APPS_SHACKLE_OPEN_TRANSFORM : 'none',
                    // 자물쇠가 먼저 떠오른 뒤에 고리가 열리도록 그만큼 미룬다.
                    transition: `transform ${APPS_UNLOCK_OPEN_MS}ms ${APPS_UNLOCK_OPEN_EASING} ${APPS_HINT_LOCK_APPEAR_MS}ms`,
                  }}
                />
                <path d={APPS_LOCK_BODY_PATH} fill="currentColor" />
                <circle cx="12" cy="15.4" r="1.15" fill="rgb(15 23 42)" />
              </svg>
              <span
                className="relative whitespace-nowrap text-white"
                style={{
                  opacity: APPS_LOCK_HINT_OPACITY,
                  fontSize: 'clamp(0.7rem, 1.9vh, 0.9rem)',
                  letterSpacing: '0.14em',
                }}
              >
                {appsLockHintText[language]}
              </span>
            </div>
          </div>

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
                    releaseAppsStopRef.current?.();
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
                    // 버튼으로 이동한 지점도 "멈춰 선 자리"이므로 활성 기준점이 된다.
                    releaseAppsStopRef.current?.();
                    setAppsActiveAnchor(APPS_BUTTON_TARGET_PROGRESS);
                    window.scrollTo({
                      top: windowHeight * APPS_BUTTON_TARGET_PROGRESS,
                      behavior: 'smooth',
                    });
                  }}
                  className={`desktop-navigation-button relative rounded-full transition-all duration-300 ease-in-out cursor-pointer ${
                    isAppsLockVisible
                      ? 'bg-transparent text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                      : isAppsInActiveRange
                      ? 'bg-purple-600 w-9'
                      : scrollProgress > APPS_START_PROGRESS
                      ? 'bg-purple-400 w-3'
                      : 'bg-slate-600 w-3'
                  }`}
                  style={{
                    height: isAppsLockVisible
                      ? 'clamp(1rem, 2.5vh, 1.5rem)'
                      : 'clamp(0.35rem, 1.6vh, 0.75rem)',
                    width: isAppsLockVisible
                      ? 'clamp(1rem, 2.5vh, 1.5rem)'
                      : isAppsInActiveRange
                      ? 'clamp(1.5rem, 4.5vh, 2.25rem)'
                      : 'clamp(0.35rem, 1.6vh, 0.75rem)',
                  }}
                  aria-label={
                    isAppsScrollLocked
                      ? 'Apps (scroll paused)'
                      : 'Apps'
                  }
                >
                  {/* 자물쇠 전용 레이어. 페이드아웃되는 동안 버튼의 CSS 트랜지션이
                      비활성↔활성 전환을 이어받아 두 모션이 하나로 이어져 보인다. */}
                  <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                      opacity: isAppsLockVisible ? 1 : 0,
                      transition: `opacity ${APPS_LOCK_FADE_MS}ms ease-out`,
                    }}
                  >
                    {/* 고리를 먼저 그려서 몸통 뒤(z축 아래)에 둔다 */}
                    <path
                      d={APPS_SHACKLE_PATH}
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.7"
                      style={{
                        transformBox: 'view-box',
                        transform: isAppsShackleOpen
                          ? APPS_SHACKLE_OPEN_TRANSFORM
                          : 'none',
                        transition: isAppsLockDropping
                          ? 'none' // 열린 위치로 세우는 첫 프레임은 즉시 이동
                          : isAppsShackleOpen
                          ? `transform ${APPS_UNLOCK_OPEN_MS}ms ${APPS_UNLOCK_OPEN_EASING}`
                          : `transform ${APPS_LOCK_CLOSE_MS}ms ${APPS_LOCK_CLOSE_EASING} ${APPS_LOCK_CLOSE_DELAY_MS}ms`,
                      }}
                    />
                    <path d={APPS_LOCK_BODY_PATH} fill="currentColor" />
                    <circle cx="12" cy="15.4" r="1.15" fill="rgb(15 23 42)" />
                  </svg>
                </button>
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
                    releaseAppsStopRef.current?.();
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
