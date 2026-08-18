import { useCallback, useEffect, useState } from 'react';

export type WelcomeMode = 'checking' | 'full' | 'returning';

const WELCOME_SESSION_KEY = 'jace-s:welcome-complete';
// 재방문이어도 항상 welcome 화면을 그대로 보여준다.
// false로 두면 같은 세션 안에서 되돌아온 방문은 compact 오버레이로 지나간다.
const ALWAYS_SHOW_FULL_WELCOME = true;

export function useWelcomeFlow() {
  const [showContent, setShowContent] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [welcomeMode, setWelcomeMode] = useState<WelcomeMode>('checking');

  useEffect(() => {
    const resolveWelcomeMode = window.setTimeout(() => {
      if (ALWAYS_SHOW_FULL_WELCOME) {
        setWelcomeMode('full');
        return;
      }

      try {
        const hasCompletedWelcome = window.sessionStorage.getItem(WELCOME_SESSION_KEY) === 'true';
        setWelcomeMode(hasCompletedWelcome ? 'returning' : 'full');
      } catch {
        setWelcomeMode('full');
      }
    }, 0);

    return () => window.clearTimeout(resolveWelcomeMode);
  }, []);

  const handleWelcomeComplete = useCallback(() => {
    try {
      window.sessionStorage.setItem(WELCOME_SESSION_KEY, 'true');
    } catch {
      // 세션 저장소를 사용할 수 없는 환경에서도 화면 전환은 계속 진행한다.
    }

    setShowContent(true);
    setTimeout(() => {
      setIsAnimating(true);
    }, 50);
  }, []);

  return {
    showContent,
    isAnimating,
    welcomeMode,
    handleWelcomeComplete,
  };
}
