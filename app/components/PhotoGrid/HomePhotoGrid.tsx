/**
 * 홈포토 그리드 컴포넌트 (6칸 레이아웃)
 */
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchAssetsManifest, getRandomHomePhotos } from '../../utils/assetUtils';
import ImageWithLoader from '../ImageWithLoader';
import styles from './HomePhotoGrid.module.css';

const shouldLog = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';
const DEFAULT_MAX_WAIT_MS = 12000;

type SlotKey = 'large0' | 'large1' | 'small0' | 'small1' | 'small2' | 'small3';
type LoadState = 'loading' | 'loaded' | 'failed';

interface HomePhotoGridProps {
  opacity: number;
  photoCardFade: number;
  onLoaded?: () => void;
  maxWaitMs?: number;
  onProgress?: (completed: number, total: number) => void;
}

export default function HomePhotoGrid({
  opacity,
  photoCardFade,
  onLoaded,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
  onProgress,
}: HomePhotoGridProps) {
  const [photos, setPhotos] = useState<{ large: string[]; small: string[] }>({
    large: [],
    small: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [manifestLoaded, setManifestLoaded] = useState(false);
  const [slotStates, setSlotStates] = useState<Partial<Record<SlotKey, LoadState>>>({});
  const notifiedRef = useRef(false);
  const forceTimerRef = useRef<number | null>(null);
  const slotUrlsRef = useRef<Partial<Record<SlotKey, string>>>({});

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
          setManifestLoaded(true);
        }
      }
    }

    loadPhotos();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const slots: { key: SlotKey; url: string }[] = useMemo(
    () => [
      { key: 'large0', url: largeSlot0 },
      { key: 'large1', url: largeSlot1 },
      { key: 'small0', url: smallSlot0 },
      { key: 'small1', url: smallSlot1 },
      { key: 'small2', url: smallSlot2 },
      { key: 'small3', url: smallSlot3 },
    ],
    [largeSlot0, largeSlot1, smallSlot0, smallSlot1, smallSlot2, smallSlot3],
  );

  useEffect(() => {
    setSlotStates((prev) => {
      const next: Partial<Record<SlotKey, LoadState>> = {};
      for (const slot of slots) {
        if (!slot.url) {
          continue;
        }
        const prevUrl = slotUrlsRef.current[slot.key];
        if (prevUrl === slot.url && prev[slot.key]) {
          next[slot.key] = prev[slot.key];
        } else {
          next[slot.key] = 'loading';
        }
      }
      return next;
    });

    slotUrlsRef.current = slots.reduce<Partial<Record<SlotKey, string>>>((acc, slot) => {
      if (slot.url) {
        acc[slot.key] = slot.url;
      }
      return acc;
    }, {});
  }, [slots]);

  const markLoaded = useCallback((slotKey: SlotKey) => {
    setSlotStates((prev) => {
      if (prev[slotKey] === 'loaded') {
        return prev;
      }
      return { ...prev, [slotKey]: 'loaded' };
    });
  }, []);

  const markFailed = useCallback((slotKey: SlotKey) => {
    setSlotStates((prev) => {
      if (prev[slotKey] === 'failed') {
        return prev;
      }
      return { ...prev, [slotKey]: 'failed' };
    });
  }, []);

  const notifyLoaded = useCallback(() => {
    if (notifiedRef.current) {
      return;
    }
    notifiedRef.current = true;
    if (forceTimerRef.current !== null) {
      window.clearTimeout(forceTimerRef.current);
      forceTimerRef.current = null;
    }
    onLoaded?.();
  }, [onLoaded]);

  const totalSlots = slots.filter((slot) => Boolean(slot.url)).length;
  const completedCount = slots.reduce((count, slot) => {
    if (!slot.url) {
      return count;
    }
    const state = slotStates[slot.key];
    if (state === 'loaded' || state === 'failed') {
      return count + 1;
    }
    return count;
  }, 0);

  const allImagesLoaded =
    totalSlots > 0 &&
    slots.every((slot) => Boolean(slot.url) && slotStates[slot.key] === 'loaded');

  useEffect(() => {
    onProgress?.(completedCount, totalSlots);
  }, [completedCount, totalSlots, onProgress]);

  useEffect(() => {
    if (allImagesLoaded) {
      notifyLoaded();
    }
  }, [allImagesLoaded, notifyLoaded]);

  useEffect(() => {
    if (!manifestLoaded || notifiedRef.current) {
      return;
    }

    if (forceTimerRef.current !== null) {
      return;
    }

    forceTimerRef.current = window.setTimeout(() => {
      notifyLoaded();
    }, maxWaitMs);

    return () => {
      if (forceTimerRef.current !== null) {
        window.clearTimeout(forceTimerRef.current);
        forceTimerRef.current = null;
      }
    };
  }, [manifestLoaded, maxWaitMs, notifyLoaded]);

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
          <ImageWithLoader
            src={largeSlot0}
            alt="Home photo large"
            className={styles.photoImage}
            onLoad={() => markLoaded('large0')}
            onFinalError={() => markFailed('large0')}
            loadingComponent={
              <div className={`${styles.loadingContainer} ${styles.loadingPurple}`}>
                <span className={styles.loadingText}>Loading...</span>
              </div>
            }
            fallback={
               <div className={`${styles.placeholderContainer} ${styles.loadingPurple}`}>
                <span className={styles.placeholderText}>Failed</span>
              </div>
            }
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
            <ImageWithLoader
              src={smallSlot0}
              alt="Home photo small"
              className={styles.photoImage}
              onLoad={() => markLoaded('small0')}
              onFinalError={() => markFailed('small0')}
              loadingComponent={
                <div className={`${styles.loadingContainer} ${styles.loadingBlue}`}>
                  <span className={styles.loadingTextSmall}>Loading...</span>
                </div>
              }
              fallback={
                <div className={`${styles.placeholderContainer} ${styles.loadingBlue}`}>
                  <span className={styles.placeholderTextSmall}>Failed</span>
                </div>
              }
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
            <ImageWithLoader
              src={smallSlot1}
              alt="Home photo small"
              className={styles.photoImage}
              onLoad={() => markLoaded('small1')}
              onFinalError={() => markFailed('small1')}
              loadingComponent={
                <div className={`${styles.loadingContainer} ${styles.loadingPink}`}>
                  <span className={styles.loadingTextSmall}>Loading...</span>
                </div>
              }
              fallback={
                <div className={`${styles.placeholderContainer} ${styles.loadingPink}`}>
                  <span className={styles.placeholderTextSmall}>Failed</span>
                </div>
              }
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
            <ImageWithLoader
              src={smallSlot2}
              alt="Home photo small"
              className={styles.photoImage}
              onLoad={() => markLoaded('small2')}
              onFinalError={() => markFailed('small2')}
              loadingComponent={
                 <div className={`${styles.loadingContainer} ${styles.loadingGreen}`}>
                  <span className={styles.loadingTextSmall}>Loading...</span>
                </div>
              }
              fallback={
                <div className={`${styles.placeholderContainer} ${styles.loadingGreen}`}>
                  <span className={styles.placeholderTextSmall}>Failed</span>
                </div>
              }
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
             <ImageWithLoader
              src={smallSlot3}
              alt="Home photo small"
              className={styles.photoImage}
              onLoad={() => markLoaded('small3')}
              onFinalError={() => markFailed('small3')}
              loadingComponent={
                <div className={`${styles.loadingContainer} ${styles.loadingYellow}`}>
                  <span className={styles.loadingTextSmall}>Loading...</span>
                </div>
              }
              fallback={
                <div className={`${styles.placeholderContainer} ${styles.loadingYellow}`}>
                  <span className={styles.placeholderTextSmall}>Failed</span>
                </div>
              }
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
          <ImageWithLoader
            src={largeSlot1}
            alt="Home photo large"
            className={styles.photoImage}
            onLoad={() => markLoaded('large1')}
            onFinalError={() => markFailed('large1')}
            loadingComponent={
              <div className={`${styles.loadingContainer} ${styles.loadingIndigo}`}>
                <span className={styles.loadingText}>Loading...</span>
              </div>
            }
            fallback={
               <div className={`${styles.placeholderContainer} ${styles.loadingIndigo}`}>
                <span className={styles.placeholderText}>Failed</span>
              </div>
            }
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

