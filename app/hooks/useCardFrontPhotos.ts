import { useEffect, useRef, useState } from 'react';
import { fetchAssetsManifest, getRandomHomePhotos } from '../utils/assetUtils';

interface UseCardFrontPhotosOptions {
  isCompactHome: boolean;
  photoCount: number;
}

export function useCardFrontPhotos({
  isCompactHome,
  photoCount,
}: UseCardFrontPhotosOptions): string[] {
  const [homePhotos, setHomePhotos] = useState<string[]>([]);
  const homePhotosLoadStartedRef = useRef(false);

  useEffect(() => {
    if (!isCompactHome || photoCount === 0 || homePhotosLoadStartedRef.current) {
      return;
    }

    let cancelled = false;
    homePhotosLoadStartedRef.current = true;

    const loadHomePhotos = async () => {
      const manifest = await fetchAssetsManifest();
      if (!manifest || cancelled) {
        return;
      }

      const selectedPhotos = getRandomHomePhotos(manifest, 1, 2);
      const selectedPhotoUrls = [...selectedPhotos.large, ...selectedPhotos.small];

      if (!cancelled) {
        setHomePhotos(selectedPhotoUrls);
      }
    };

    loadHomePhotos();

    return () => {
      cancelled = true;
    };
  }, [isCompactHome, photoCount]);

  return homePhotos;
}
