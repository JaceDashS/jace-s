/**
 * 에셋 관련 유틸리티 함수
 */
import { AssetsManifest, CertificationData } from '../types/assets';
import { isVerboseLoggingEnabled } from './logging';

const MANIFEST_PATH = '/manifest.json';
const CONFIG_FETCH_TIMEOUT_MS = 8000;
const MANIFEST_FETCH_TIMEOUT_MS = 8000;
const isServer = typeof window === 'undefined';
const shouldLog = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true' && (!isServer || isVerboseLoggingEnabled());

const log = (...args: unknown[]) => {
  if (shouldLog) {
    console.log(...args);
  }
};

const logError = (...args: unknown[]) => {
  if (shouldLog) {
    console.error(...args);
  }
};

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// 클라이언트 사이드에서 API로 가져온 URL 캐시
let cachedAssetsUrl: string | null = null;
let configFetchPromise: Promise<string> | null = null;

/**
 * Assets URL을 가져옵니다
 * 
 * 서버 사이드: ASSETS_URL 환경 변수 사용 (런타임)
 * 클라이언트 사이드: /api/config 엔드포인트를 통해 가져옴 (런타임)
 */
function getAssetsUrl(): string {
  if (typeof window === 'undefined') {
    // 서버 사이드에서는 ASSETS_URL (비-public) 환경 변수 사용
    const url = process.env.ASSETS_URL || process.env.NEXT_PUBLIC_ASSETS_URL || '';
    const result = url.replace(/\/$/, '');
    log('[assets]', 'getAssetsUrl-server', { 
      assetsUrl: process.env.ASSETS_URL,
      nextPublicAssetsUrl: process.env.NEXT_PUBLIC_ASSETS_URL,
      result,
      ts: Date.now() 
    });
    return result;
  }
  
  // 클라이언트 사이드에서는 캐시된 값이 있으면 사용
  if (cachedAssetsUrl !== null) {
    return cachedAssetsUrl;
  }
  
  // 캐시가 없으면 기본값 반환 (비동기로 API에서 가져오는 중)
  // fetchAssetsUrlFromApi()가 호출되면 캐시가 업데이트됨
  const fallbackUrl = window.location.origin;
  log('[assets]', 'getAssetsUrl-client-fallback', { 
    fallbackUrl,
    cachedAssetsUrl,
    ts: Date.now() 
  });
  return fallbackUrl;
}

/**
 * 클라이언트 사이드에서 /api/config를 통해 Assets URL을 가져옵니다
 */
async function fetchAssetsUrlFromApi(): Promise<string> {
  if (typeof window === 'undefined') {
    // 서버 사이드에서는 환경 변수 직접 사용
    const url = process.env.ASSETS_URL || process.env.NEXT_PUBLIC_ASSETS_URL || '';
    return url.replace(/\/$/, '');
  }

  // 이미 캐시된 값이 있으면 반환
  if (cachedAssetsUrl !== null) {
    return cachedAssetsUrl;
  }

  // 이미 요청 중이면 기존 Promise 반환
  if (configFetchPromise !== null) {
    return configFetchPromise;
  }

  // 새로운 요청 시작
  configFetchPromise = (async (): Promise<string> => {
    try {
      const response = await fetchWithTimeout(
        '/api/config',
        {
          cache: 'no-store', // 항상 최신 값 가져오기
        },
        CONFIG_FETCH_TIMEOUT_MS
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
      }
      
      const config = await response.json();
      const assetsUrl = config.assetsUrl || window.location.origin;
      const cleanUrl = assetsUrl.replace(/\/$/, '');
      
      // 캐시 업데이트
      cachedAssetsUrl = cleanUrl;
      
      log('[assets]', 'fetchAssetsUrlFromApi-success', {
        assetsUrl: cachedAssetsUrl,
        configAssetsUrl: config.assetsUrl,
        fallbackUsed: !config.assetsUrl,
        ts: Date.now()
      });
      
      return cleanUrl;
    } catch (error) {
      logError('[assets]', 'fetchAssetsUrlFromApi-error', {
        error: error instanceof Error ? error.message : String(error),
        ts: Date.now()
      });
      
      // 에러 시 기본값 사용
      const fallbackUrl = window.location.origin;
      const cleanUrl = fallbackUrl.replace(/\/$/, '');
      cachedAssetsUrl = cleanUrl;
      return cleanUrl;
    } finally {
      configFetchPromise = null;
    }
  })();

  return configFetchPromise;
}

/**
 * manifest.json을 가져옵니다
 */
export async function fetchAssetsManifest(): Promise<AssetsManifest | null> {
  try {
    // 클라이언트 사이드에서는 API를 통해 URL 가져오기
    const assetsUrl = typeof window !== 'undefined'
      ? await fetchAssetsUrlFromApi()
      : getAssetsUrl();
    
    if (!assetsUrl) {
      return null;
    }
    
    // URL 유효성 검사
    try {
      new URL(assetsUrl);
    } catch {
      return null;
    }
    
    const manifestUrl = `${assetsUrl}${MANIFEST_PATH}`;
    
    // URL 유효성 재검사
    let validUrl: string;
    try {
      validUrl = new URL(manifestUrl).href;
      log('[assets]', 'fetchAssetsManifest', { 
        assetsUrl, 
        manifestUrl, 
        validUrl,
        ts: Date.now() 
      });
    } catch (e) {
      logError('[assets]', 'fetchAssetsManifest-invalid-url', { 
        assetsUrl, 
        manifestUrl, 
        error: e,
        ts: Date.now() 
      });
      return null;
    }
    
    const response = await fetchWithTimeout(
      validUrl,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // CORS 문제 해결을 위한 옵션
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit', // CORS 문제 방지
      },
      MANIFEST_FETCH_TIMEOUT_MS
    );
    
    if (!response.ok) {
      logError('[assets]', 'fetchAssetsManifest-failed', { 
        validUrl, 
        status: response.status, 
        statusText: response.statusText,
        ts: Date.now() 
      });
      return null;
    }
    
    const manifest: AssetsManifest = await response.json();
    log('[assets]', 'fetchAssetsManifest-success', { 
      validUrl, 
      manifestSets: manifest?.sets ? Object.keys(manifest.sets) : [],
      ts: Date.now() 
    });
    return manifest;
  } catch {
    return null;
  }
}

/**
 * 에셋 파일의 전체 URL을 생성합니다
 */
export function getAssetUrl(basePath: string, fileName: string): string {
  const assetsUrl = getAssetsUrl();
  // basePath 정규화: 앞뒤 슬래시 제거
  const normalizedBasePath = basePath.replace(/^\/+|\/+$/g, '');
  // fileName 정규화: 앞 슬래시 제거
  const normalizedFileName = fileName.replace(/^\/+/, '');
  
  // 슬래시를 하나만 사용하여 조합
  let finalUrl: string;
  if (normalizedBasePath) {
    finalUrl = `${assetsUrl}/${normalizedBasePath}/${normalizedFileName}`;
  } else {
    finalUrl = `${assetsUrl}/${normalizedFileName}`;
  }
  log('[assets]', 'getAssetUrl', { 
    assetsUrl, 
    basePath, 
    fileName, 
    normalizedBasePath, 
    normalizedFileName, 
    finalUrl,
    ts: Date.now() 
  });
  return finalUrl;
}

/**
 * 배열에서 랜덤하게 N개의 요소를 선택합니다
 */
export function getRandomItems<T>(array: T[], count: number): T[] {
  if (array.length === 0 || count <= 0) return [];
  if (count >= array.length) return [...array];
  
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * 홈포토를 위한 랜덤 사진 선택 및 랜덤 배치
 * large: 2개, small: 4개
 * 반환값: { large: [슬롯0용, 슬롯1용], small: [슬롯0용, 슬롯1용, 슬롯2용, 슬롯3용] }
 * large 슬롯은 [0, 5] 위치, small 슬롯은 [1-2, 3-4] 위치에 배치됨
 */
export function getRandomHomePhotos(
  manifest: AssetsManifest,
  largeCount: number = 2,
  smallCount: number = 4
): { large: string[]; small: string[] } {
  const homePhotosSet = manifest.sets.homePhotos;
  if (!homePhotosSet) {
    return { large: [], small: [] };
  }

  const largePhotos = homePhotosSet.items.filter(item => item.variant === 'large');
  const smallPhotos = homePhotosSet.items.filter(item => item.variant === 'small');

  // 랜덤 선택 (이미 getRandomItems에서 섞임)
  const selectedLarge = getRandomItems(largePhotos, largeCount);
  const selectedSmall = getRandomItems(smallPhotos, smallCount);

  return {
    large: selectedLarge.map(item => getAssetUrl(homePhotosSet.basePath, item.file)),
    small: selectedSmall.map(item => getAssetUrl(homePhotosSet.basePath, item.file)),
  };
}

/**
 * 앱포토를 위한 랜덤 사진 선택
 */
export function getRandomAppPhotos(
  manifest: AssetsManifest,
  count: number = 4
): string[] {
  const appsSet = manifest.sets.apps;
  if (!appsSet) {
    return [];
  }

  const selected = getRandomItems(appsSet.items, count);
  return selected.map(item => getAssetUrl(appsSet.basePath, item.file));
}

/**
 * 자격증 목록을 가져옵니다
 */
export function getCertifications(manifest: AssetsManifest): CertificationData[] {
  const certificationsSet = manifest.sets.certifications;
  if (!certificationsSet) {
    return [];
  }

  return Object.entries(certificationsSet).map(([key, certification]) => {
    const iconUrl = getAssetUrl(certification.basePath, certification.icon.file);
    const documents = certification.documents
      .filter(doc => doc.type === 'pdf')
      .map(doc => {
        const docUrl = getAssetUrl(certification.basePath, doc.file);
        return {
          type: doc.type,
          url: docUrl,
        };
      });

    return {
      key,
      iconUrl,
      documents,
    };
  });
}

/**
 * Profile Overview 데이터를 가져옵니다
 */
export interface ProfileOverviewData {
  [key: string]: {
    name: string;
    description: string;
    links?: { [key: string]: string };
  };
}

export async function fetchProfileOverview(manifest: AssetsManifest): Promise<ProfileOverviewData | null> {
  try {
    if (!manifest || !manifest.sets) {
      return null;
    }

    const profileOverviewData = manifest.sets.data?.profileOverview;
    if (!profileOverviewData) {
      return null;
    }

    const profileOverviewUrl = getAssetUrl(profileOverviewData.basePath, profileOverviewData.file);
    const response = await fetch(profileOverviewUrl);
    
    if (!response.ok) {
      return null;
    }

    const data: ProfileOverviewData = await response.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * 이미지 로드 실패 시 재시도하는 핸들러를 생성합니다
 * @param originalSrc 원본 이미지 URL
 * @param maxRetries 최대 재시도 횟수 (기본값: 3)
 * @param onFinalError 최종 실패 시 호출될 콜백 함수
 * @returns onError 핸들러 함수
 */
export function createImageRetryHandler(
  originalSrc: string,
  maxRetries: number = 3,
  onFinalError?: (img: HTMLImageElement) => void
): (e: React.SyntheticEvent<HTMLImageElement, Event>) => void {
  const retryCounts = new WeakMap<HTMLImageElement, number>();

  return (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    const currentRetry = retryCounts.get(img) || 0;

    if (currentRetry < maxRetries) {
      // Exponential backoff: 1초, 2초, 4초
      const delay = Math.pow(2, currentRetry) * 1000;
      
      retryCounts.set(img, currentRetry + 1);
      
      setTimeout(() => {
        // 캐시 무효화를 위해 타임스탬프 추가
        const separator = originalSrc.includes('?') ? '&' : '?';
        img.src = `${originalSrc}${separator}_retry=${currentRetry + 1}&_t=${Date.now()}`;
      }, delay);
    } else {
      // 최대 재시도 횟수 초과 시 최종 에러 처리
      if (onFinalError) {
        onFinalError(img);
      } else {
        // 기본 동작: 이미지 숨김
        img.style.display = 'none';
      }
    }
  };
}
