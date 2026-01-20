/**
 * 스크롤 진행도 및 방향 추적 훅
 */
import { useState, useEffect } from 'react';

interface UseScrollProgressOptions {
  isActive: boolean;
  onScrollBlock?: (shouldBlock: boolean) => void;
  hoverStateRefs?: {
    hoverPhase: React.MutableRefObject<'none' | 'spread' | 'close'>;
    isRightCardHovered: React.MutableRefObject<boolean>;
    isHoverAnimationRunning: React.MutableRefObject<boolean>;
    isZIndexChanged: React.MutableRefObject<boolean>;
    pendingHoverEnter: React.MutableRefObject<boolean>;
    pendingHoverLeave: React.MutableRefObject<boolean>;
    isHoverLeaveFlowActive: React.MutableRefObject<boolean>;
  };
}

export const useScrollProgress = ({ isActive, onScrollBlock, hoverStateRefs }: UseScrollProgressOptions = { isActive: false }) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isScrollingUp, setIsScrollingUp] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    let rafId: number | null = null;
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      // 호버 해제 플로우가 시작되었고 완료 조건을 만족하지 못하면 스크롤 자체도 되돌린다
      if (hoverStateRefs) {
        const isHomeCardDefault =
          hoverStateRefs.hoverPhase.current === 'none' &&
          hoverStateRefs.isRightCardHovered.current === false &&
          hoverStateRefs.isHoverAnimationRunning.current === false &&
          hoverStateRefs.isZIndexChanged.current === false &&
          hoverStateRefs.pendingHoverEnter.current === false &&
          hoverStateRefs.pendingHoverLeave.current === false &&
          hoverStateRefs.isHoverLeaveFlowActive.current === false;
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
            hoverStateRefs.hoverPhase.current !== 'none' ||
            hoverStateRefs.isRightCardHovered.current ||
            hoverStateRefs.isHoverAnimationRunning.current ||
            hoverStateRefs.isZIndexChanged.current ||
            hoverStateRefs.pendingHoverEnter.current ||
            hoverStateRefs.pendingHoverLeave.current ||
            hoverStateRefs.isHoverLeaveFlowActive.current;
          if (hasActiveHoverState && onScrollBlock) {
            // 호버 상태 리셋은 외부에서 처리
            onScrollBlock(true);
          }
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
        return calculatedProgress;
      });
      
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: false });
    handleScroll(); // 초기 값 설정
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isActive, onScrollBlock, hoverStateRefs]);

  return { scrollProgress, isScrollingUp };
};

