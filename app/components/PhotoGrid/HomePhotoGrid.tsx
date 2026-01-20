/**
 * 홈포토 그리드 컴포넌트 (6칸 레이아웃)
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchAssetsManifest, getRandomHomePhotos, createImageRetryHandler } from '../../utils/assetUtils';
import styles from './HomePhotoGrid.module.css';

const shouldLog = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';

interface HomePhotoGridProps {
  opacity: number;
  photoCardFade: number;
  onLoaded?: () => void;
}

export default function HomePhotoGrid({ opacity, photoCardFade, onLoaded }: HomePhotoGridProps) {
  const [photos, setPhotos] = useState<{ large: string[]; small: string[] }>({
    large: [],
    small: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPhotos() {
      try {
        setIsLoading(true);
        const manifest = await fetchAssetsManifest();
        if (!cancelled && manifest) {
          const randomPhotos = getRandomHomePhotos(manifest, 2, 4);
          setPhotos(randomPhotos);
          if (shouldLog) {
            console.log('[welcome]', 'home-photos-load-success', { 
            large: randomPhotos.large.length, 
            small: randomPhotos.small.length,
            largeUrls: randomPhotos.large,
            smallUrls: randomPhotos.small,
            ts: Date.now() 
            });
          }
        } else if (!cancelled) {
          setPhotos({ large: [], small: [] });
          if (shouldLog) {
            console.log('[welcome]', 'home-photos-load-missing-manifest', { ts: Date.now() });
          }
        }
      } catch {
        if (!cancelled) {
          setPhotos({ large: [], small: [] });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          // home photos 로딩 완료 알림
          onLoaded?.();
        }
      }
    }

    loadPhotos();
    return () => {
      cancelled = true;
    };
  }, [onLoaded]);

  // 랜덤 배치: large 2개와 small 4개를 각각 랜덤 순서로 배치
  // useMemo로 한 번만 계산하여 리렌더링 시에도 동일한 배치 유지
  const { largeSlot0, largeSlot1, smallSlot0, smallSlot1, smallSlot2, smallSlot3 } = useMemo(() => {
    if (photos.large.length < 2 || photos.small.length < 4) {
      return {
        largeSlot0: photos.large[0] || '',
        largeSlot1: photos.large[1] || '',
        smallSlot0: photos.small[0] || '',
        smallSlot1: photos.small[1] || '',
        smallSlot2: photos.small[2] || '',
        smallSlot3: photos.small[3] || '',
      };
    }

    // Large 슬롯을 랜덤하게 섞어서 배치
    const shuffledLarge = [...photos.large].sort(() => Math.random() - 0.5);
    
    // Small 슬롯을 랜덤하게 섞어서 배치
    const shuffledSmall = [...photos.small].sort(() => Math.random() - 0.5);

    return {
      largeSlot0: shuffledLarge[0],
      largeSlot1: shuffledLarge[1],
      smallSlot0: shuffledSmall[0],
      smallSlot1: shuffledSmall[1],
      smallSlot2: shuffledSmall[2],
      smallSlot3: shuffledSmall[3],
    };
  }, [photos.large, photos.small]);

  // 각 이미지에 대한 재시도 핸들러 생성
  const handleLargeSlot0Error = useMemo(() => 
    largeSlot0 ? createImageRetryHandler(largeSlot0, 3, (img) => {
      img.style.display = 'none';
    }) : undefined,
    [largeSlot0]
  );
  const handleLargeSlot1Error = useMemo(() => 
    largeSlot1 ? createImageRetryHandler(largeSlot1, 3, (img) => {
      img.style.display = 'none';
    }) : undefined,
    [largeSlot1]
  );
  const handleSmallSlot0Error = useMemo(() => 
    smallSlot0 ? createImageRetryHandler(smallSlot0, 3, (img) => {
      img.style.display = 'none';
    }) : undefined,
    [smallSlot0]
  );
  const handleSmallSlot1Error = useMemo(() => 
    smallSlot1 ? createImageRetryHandler(smallSlot1, 3, (img) => {
      img.style.display = 'none';
    }) : undefined,
    [smallSlot1]
  );
  const handleSmallSlot2Error = useMemo(() => 
    smallSlot2 ? createImageRetryHandler(smallSlot2, 3, (img) => {
      img.style.display = 'none';
    }) : undefined,
    [smallSlot2]
  );
  const handleSmallSlot3Error = useMemo(() => 
    smallSlot3 ? createImageRetryHandler(smallSlot3, 3, (img) => {
      img.style.display = 'none';
    }) : undefined,
    [smallSlot3]
  );

  return (
    <div
      className={styles.gridContainer}
      style={{
        opacity,
        pointerEvents: photoCardFade > 0.01 ? 'auto' : 'none',
      }}
    >
      {/* Large Slot 0 (왼쪽 상단) */}
      <div className={styles.photoItem}>
        {isLoading ? (
          <div className={`${styles.loadingContainer} ${styles.loadingPurple}`}>
            <span className={styles.loadingText}>Loading...</span>
          </div>
        ) : largeSlot0 ? (
          <img 
            src={largeSlot0} 
            alt="Home photo large" 
            className={styles.photoImage}
            onError={handleLargeSlot0Error}
          />
        ) : (
          <div className={`${styles.placeholderContainer} ${styles.loadingPurple}`}>
            <span className={styles.placeholderText}>Large</span>
          </div>
        )}
      </div>

      {/* Small Slot 0-1 (오른쪽 상단 세로) */}
      <div className={styles.photoColumn}>
        <div className={`${styles.photoItem} ${styles.photoColumn}`}>
          {isLoading ? (
            <div className={`${styles.loadingContainer} ${styles.loadingBlue}`}>
              <span className={styles.loadingTextSmall}>Loading...</span>
            </div>
          ) : smallSlot0 ? (
            <img 
              src={smallSlot0} 
              alt="Home photo small" 
              className={styles.photoImage}
              onError={handleSmallSlot0Error}
            />
          ) : (
            <div className={`${styles.placeholderContainer} ${styles.loadingBlue}`}>
              <span className={styles.placeholderTextSmall}>Small</span>
            </div>
          )}
        </div>
        <div className={`${styles.photoItem} ${styles.photoColumn}`}>
          {isLoading ? (
            <div className={`${styles.loadingContainer} ${styles.loadingPink}`}>
              <span className={styles.loadingTextSmall}>Loading...</span>
            </div>
          ) : smallSlot1 ? (
            <img 
              src={smallSlot1} 
              alt="Home photo small" 
              className={styles.photoImage}
              onError={handleSmallSlot1Error}
            />
          ) : (
            <div className={`${styles.placeholderContainer} ${styles.loadingPink}`}>
              <span className={styles.placeholderTextSmall}>Small</span>
            </div>
          )}
        </div>
      </div>

      {/* Small Slot 2-3 (왼쪽 하단 세로) */}
      <div className={styles.photoColumn}>
        <div className={`${styles.photoItem} ${styles.photoColumn}`}>
          {isLoading ? (
            <div className={`${styles.loadingContainer} ${styles.loadingGreen}`}>
              <span className={styles.loadingTextSmall}>Loading...</span>
            </div>
          ) : smallSlot2 ? (
            <img 
              src={smallSlot2} 
              alt="Home photo small" 
              className={styles.photoImage}
              onError={handleSmallSlot2Error}
            />
          ) : (
            <div className={`${styles.placeholderContainer} ${styles.loadingGreen}`}>
              <span className={styles.placeholderTextSmall}>Small</span>
            </div>
          )}
        </div>
        <div className={`${styles.photoItem} ${styles.photoColumn}`}>
          {isLoading ? (
            <div className={`${styles.loadingContainer} ${styles.loadingYellow}`}>
              <span className={styles.loadingTextSmall}>Loading...</span>
            </div>
          ) : smallSlot3 ? (
            <img 
              src={smallSlot3} 
              alt="Home photo small" 
              className={styles.photoImage}
              onError={handleSmallSlot3Error}
            />
          ) : (
            <div className={`${styles.placeholderContainer} ${styles.loadingYellow}`}>
              <span className={styles.placeholderTextSmall}>Small</span>
            </div>
          )}
        </div>
      </div>

      {/* Large Slot 1 (오른쪽 하단) */}
      <div className={styles.photoItem}>
        {isLoading ? (
          <div className={`${styles.loadingContainer} ${styles.loadingIndigo}`}>
            <span className={styles.loadingText}>Loading...</span>
          </div>
        ) : largeSlot1 ? (
          <img 
            src={largeSlot1} 
            alt="Home photo large" 
            className={styles.photoImage}
            onError={handleLargeSlot1Error}
          />
        ) : (
          <div className={`${styles.placeholderContainer} ${styles.loadingIndigo}`}>
            <span className={styles.placeholderText}>Large</span>
          </div>
        )}
      </div>
    </div>
  );
}

