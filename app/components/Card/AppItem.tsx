/**
 * App 아이템 컴포넌트
 * 클라이언트의 Apps.tsx 구조를 참고하여 이미지, 설명, 버튼을 표시
 */
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { App } from '../../types/app';
import { createImageRetryHandler } from '../../utils/assetUtils';
import styles from './AppItem.module.css';

const shouldLog = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';

interface AppItemProps {
  app: App;
  buttonFontSize: string;
  iconSize: string;
}

// SVG 아이콘 컴포넌트들
const AndroidIcon = ({ size }: { size: string }) => (
  <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993 0 .5511-.4483.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1349 1.0989L4.8429 5.4467a.4161.4161 0 00-.5676-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.186.8535 12.3104.8535 13.8218c0 .5668.4519 1.0247 1.0177 1.0247h20.2576c.5658 0 1.0177-.4579 1.0177-1.0247 0-1.5114-1.8354-2.6354-4.2675-3.5004"/>
  </svg>
);

const GlobeIcon = ({ size }: { size: string }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

const PlayIcon = ({ size }: { size: string }) => (
  <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5v14l11-7z"/>
  </svg>
);

const GithubIcon = ({ size }: { size: string }) => (
  <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

export default function AppItem({ app, buttonFontSize, iconSize }: AppItemProps) {
  const [showDemo, setShowDemo] = useState(false);
  const hasLoggedRef = useRef(false);

  const toggleDemo = () => {
    setShowDemo(prev => !prev);
  };

  // YouTube URL에서 video ID 추출
  const getYouTubeVideoId = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('v');
    } catch {
      return null;
    }
  };

  // 이미지 재시도 핸들러 생성
  const handleImageError = useMemo(() => 
    app.imageUrl 
      ? createImageRetryHandler(app.imageUrl, 3, (img) => {
          img.style.display = 'none';
        })
      : undefined,
    [app.imageUrl]
  );

  useEffect(() => {
    if (!shouldLog || !app.imageUrl || hasLoggedRef.current) {
      return;
    }
    hasLoggedRef.current = true;
    console.log('[app-item]', 'app-image-url', { 
      appTitle: app.title, 
      imageUrl: app.imageUrl,
      ts: Date.now() 
    });
  }, [app.imageUrl, app.title]);

  return (
    <div className={styles.appItem}>
      {app.imageUrl && (
        <img
          src={app.imageUrl}
          alt={`${app.title} icon`}
          className={styles.appImage}
          onError={handleImageError}
        />
      )}
      <div className={styles.appContent}>
        <h3 className={styles.appTitle}>{app.title}</h3>
        {app.description && (
          <p className={styles.appDescription}>{app.description}</p>
        )}
        <div className={styles.appButtons}>
          {app.apkUrl && (
            <a
              href={app.apkUrl}
              download
              className={styles.appButton}
              style={{ fontSize: buttonFontSize }}
            >
              <AndroidIcon size={iconSize} />
              <span>APK</span>
            </a>
          )}
          {app.webUrl && (
            <a
              href={app.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.appButton}
              style={{ fontSize: buttonFontSize }}
            >
              <GlobeIcon size={iconSize} />
              <span>Web</span>
            </a>
          )}
          {app.demoUrl && (
            <button
              onClick={toggleDemo}
              className={styles.appButton}
              style={{ fontSize: buttonFontSize }}
            >
              <PlayIcon size={iconSize} />
              <span>Demo</span>
            </button>
          )}
          {app.githubUrl && (
            <a
              href={app.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.appButton}
              style={{ fontSize: buttonFontSize }}
            >
              <GithubIcon size={iconSize} />
              <span>Code</span>
            </a>
          )}
        </div>
        {showDemo && app.demoUrl && (
          <div className={styles.demoContainer}>
            <iframe
              src={`https://www.youtube.com/embed/${getYouTubeVideoId(app.demoUrl) || ''}`}
              className={styles.demoIframe}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`${app.title} Demo`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

