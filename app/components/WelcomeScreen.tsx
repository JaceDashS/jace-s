'use client';

import { useEffect, useRef } from 'react';
import styles from './WelcomeScreen.module.css';

interface WelcomeScreenProps {
  onComplete: () => void;
  ready?: boolean; // 로딩 완료 여부
  progressPercent?: number;
}

export default function WelcomeScreen({
  onComplete,
  ready = false,
  progressPercent = 0,
}: WelcomeScreenProps) {
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const hasStartedExitRef = useRef(false);

  // ready가 true가 되면 종료 애니메이션 + 0.25초 차단 후 완료
  useEffect(() => {
    if (ready && !hasStartedExitRef.current) {
      hasStartedExitRef.current = true;
      const timer = setTimeout(() => {
        onComplete();
      }, 800 + 250); // 800ms 애니메이션 + 250ms 상호작용 차단 (1/2로 단축)
      timersRef.current.push(timer);
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [ready, onComplete]);

  const clampedPercent = Math.min(100, Math.max(0, Math.round(progressPercent)));

  return (
    <div
      className={`${styles.overlay} ${ready ? styles.overlayExiting : styles.overlayEntering}`}
    >
      <div
        className={`${styles.content} ${ready ? styles.contentExiting : styles.contentEntering}`}
      >
        <h1 className={styles.title}>Welcome</h1>
        <p className={styles.subtitle}>{`${clampedPercent}%`}</p>
        <div className={styles.progressTrack} aria-label="Loading">
          <div
            className={styles.progressBar}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
