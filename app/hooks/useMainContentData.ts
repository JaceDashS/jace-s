import { useCallback, useEffect, useState } from 'react';
import { fetchAssetsManifest, fetchProfileOverview } from '../utils/assetUtils';
import type { Language } from '../types/mainContent';
import type { App } from '../types/app';

type AppApiItem = Omit<App, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

interface AppsApiResponse {
  apps?: AppApiItem[];
}

type ProfileLinks = Record<string, string>;

interface HomePhotosProgress {
  completed: number;
  total: number;
}

const DEFAULT_HOME_PHOTO_TOTAL = 6;

export function useMainContentData(language: Language) {
  const [apps, setApps] = useState<App[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profileDescription, setProfileDescription] = useState('');
  const [profileLinks, setProfileLinks] = useState<ProfileLinks | null>(null);
  const [appsLoaded, setAppsLoaded] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [certificationsLoaded, setCertificationsLoaded] = useState(false);
  const [homePhotosLoaded, setHomePhotosLoaded] = useState(false);
  const [homePhotosProgress, setHomePhotosProgress] = useState<HomePhotosProgress>({
    completed: 0,
    total: DEFAULT_HOME_PHOTO_TOTAL,
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    async function loadApps() {
      try {
        const response = await fetch('/api/apps?page=1&limit=100', {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          if (response.status === 404) {
            setApps([]);
            return;
          }
          throw new Error(`Failed to fetch apps: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          setApps([]);
          return;
        }

        const data: AppsApiResponse = await response.json();
        const appsData = (data.apps || []).map((app) => ({
          ...app,
          createdAt: new Date(app.createdAt),
          updatedAt: new Date(app.updatedAt),
        }));

        if (!cancelled) {
          setApps(appsData);
        }
      } catch {
        if (!cancelled) {
          setApps([]);
        }
      } finally {
        if (!cancelled) {
          setAppsLoaded(true);
        }
        clearTimeout(timeoutId);
      }
    }

    loadApps();

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProfileLoaded(false);

    async function loadProfileOverview() {
      try {
        const manifest = await fetchAssetsManifest();
        if (!manifest) return;

        const profileData = await fetchProfileOverview(manifest);
        if (!profileData) return;

        const currentLangData = profileData[language] || profileData.en;
        if (currentLangData && !cancelled) {
          setProfileName(currentLangData.name);
          setProfileDescription(currentLangData.description || '');
          setProfileLinks(currentLangData.links || null);
        }
      } catch {
        // Profile overview 로드 실패 시 조용히 처리
      } finally {
        if (!cancelled) {
          setProfileLoaded(true);
        }
      }
    }

    loadProfileOverview();

    return () => {
      cancelled = true;
    };
  }, [language]);

  const handleCertificationsLoaded = useCallback(() => {
    setCertificationsLoaded(true);
  }, []);

  const handleHomePhotosLoaded = useCallback(() => {
    setHomePhotosLoaded(true);
  }, []);

  const handleHomePhotosProgress = useCallback((completed: number, total: number) => {
    setHomePhotosProgress((previous) => ({
      completed,
      total: total > 0 ? total : previous.total,
    }));
  }, []);

  const homeTotal = homePhotosProgress.total || DEFAULT_HOME_PHOTO_TOTAL;
  const totalUnits = 3 + homeTotal;
  const completedUnits =
    (appsLoaded ? 1 : 0) +
    (profileLoaded ? 1 : 0) +
    (certificationsLoaded ? 1 : 0) +
    Math.min(homePhotosProgress.completed, homeTotal);

  return {
    apps,
    profileName,
    profileDescription,
    profileLinks,
    allResourcesLoaded: appsLoaded && profileLoaded && certificationsLoaded && homePhotosLoaded,
    progressPercent: totalUnits > 0 ? (completedUnits / totalUnits) * 100 : 0,
    handleCertificationsLoaded,
    handleHomePhotosLoaded,
    handleHomePhotosProgress,
  };
}
