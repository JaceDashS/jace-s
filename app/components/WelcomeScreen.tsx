'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './WelcomeScreen.module.css';

interface WelcomeScreenProps {
  onComplete: () => void;
  ready?: boolean; // 로딩 완료 여부
  progressPercent?: number;
  compact?: boolean;
}

export default function WelcomeScreen({
  onComplete,
  ready = false,
  progressPercent = 0,
  compact = false,
}: WelcomeScreenProps) {
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const hasStartedExitRef = useRef(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (ready && !hasStartedExitRef.current) {
      hasStartedExitRef.current = true;
      const animationFrameId = window.requestAnimationFrame(() => {
        setIsExiting(true);
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const completionDelay = prefersReducedMotion ? 20 : compact ? 240 : 1050;
        const timer = setTimeout(onComplete, completionDelay);
        timersRef.current.push(timer);
      });

      return () => {
        window.cancelAnimationFrame(animationFrameId);
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
      };
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [compact, ready, onComplete]);

  const clampedPercent = Math.min(100, Math.max(0, Math.round(progressPercent)));

  return (
    <div
      className={`${styles.overlay} ${compact ? styles.overlayCompact : ''} ${isExiting ? styles.overlayExiting : styles.overlayEntering}`}
    >
      {!compact && (
        <div
          className={`${styles.content} ${isExiting ? styles.contentExiting : styles.contentEntering}`}
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
      )}
    </div>
  );
}
