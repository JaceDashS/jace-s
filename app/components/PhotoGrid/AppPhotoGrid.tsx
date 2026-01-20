/**
 * 앱포토 그리드 컴포넌트 (4칸 레이아웃)
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { APP_PHOTO_GAP } from '../../constants/gridConstants';
import { fetchAssetsManifest, getRandomAppPhotos, createImageRetryHandler } from '../../utils/assetUtils';
import styles from './AppPhotoGrid.module.css';

const shouldLog = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';

interface AppPhotoGridProps {
  opacity: number;
  photoCardFade: number;
}

export default function AppPhotoGrid({ opacity, photoCardFade }: AppPhotoGridProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hashString = (input: string): number => {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  };

  const createSeededRandom = (seedValue: number) => {
    let seed = seedValue;
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  };

  useEffect(() => {
    async function loadPhotos() {
      setIsLoading(true);
      const manifest = await fetchAssetsManifest();
      if (manifest) {
        const randomPhotos = getRandomAppPhotos(manifest, 4);
        setPhotos(randomPhotos);
        if (shouldLog) {
          console.log('[app-photos]', 'app-photos-load-success', { 
            count: randomPhotos.length,
            urls: randomPhotos,
            ts: Date.now() 
          });
        }
      } else {
        if (shouldLog) {
          console.log('[app-photos]', 'app-photos-load-missing-manifest', { ts: Date.now() });
        }
      }
      setIsLoading(false);
    }
    loadPhotos();
  }, []);

  const shuffledPhotos = useMemo(() => {
    if (photos.length === 0) {
      return [];
    }

    const seed = hashString(photos.join('|'));
    const random = createSeededRandom(seed);
    const copy = [...photos];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [photos]);

  return (
    <div
      className={styles.gridContainer}
      style={{
        gap: `${APP_PHOTO_GAP * 0.25}rem`,
        opacity,
        pointerEvents: photoCardFade < 0.99 ? 'auto' : 'none',
      }}
    >
      {[0, 1, 2, 3].map((index) => {
        const photoUrl = shuffledPhotos[index];
        const handleError = photoUrl 
          ? createImageRetryHandler(photoUrl, 3, (img) => {
              img.style.display = 'none';
            })
          : undefined;

        return (
          <div key={index} className={styles.photoItem}>
            {isLoading ? (
              <div className={styles.loadingContainer}>
                <span className={styles.loadingText}>Loading...</span>
              </div>
            ) : photoUrl ? (
              <img
                src={photoUrl}
                alt={`App photo ${index + 1}`}
                className={styles.photoImage}
                onError={handleError}
              />
            ) : (
              <div className={styles.placeholderContainer}>
                <span className={styles.placeholderText}>Photo {index + 1}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

