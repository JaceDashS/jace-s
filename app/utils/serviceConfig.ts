/**
 * 외부 서비스 설정 유틸리티
 */

export interface ServiceConfig {
  name: string;
  url: string;
  enabled: boolean;
}

/**
 * 외부 서비스 헬스체크 타임아웃 (밀리초)
 * 1분 = 60000ms
 */
export const EXTERNAL_HEALTH_TIMEOUT = 60000;

/**
 * GPT Visualizer 타임아웃 (밀리초)
 * 30초 = 30000ms
 */
export const GPT_VISUALIZER_TIMEOUT = 30000;

/**
 * 환경변수에서 서비스 설정을 읽어옵니다.
 * 형식: EXTERNAL_SERVICE_{SERVICE_NAME}_SERVER_URL
 */
export function getServiceConfigs(): ServiceConfig[] {
  const services: ServiceConfig[] = [];
  const prefix = 'EXTERNAL_SERVICE_';
  const suffix = '_SERVER_URL';

  // 환경변수에서 EXTERNAL_SERVICE_*_SERVER_URL 패턴 찾기
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && key.endsWith(suffix)) {
      // EXTERNAL_SERVICE_GPT_VISUALIZER_SERVER_URL -> gpt-visualizer
      const serviceName = key
        .slice(prefix.length, -suffix.length)
        .toLowerCase()
        .replace(/_/g, '-'); // 언더스코어를 하이픈으로 변환

      if (value && value.trim()) {
        // 콤마로 구분된 여러 URL 처리
        const urls = value
          .split(',')
          .map(url => url.trim())
          .filter(url => url.length > 0);
        
        // 각 URL마다 별도의 서비스 항목 생성 (같은 이름에 인덱스 추가)
        urls.forEach((url, index) => {
          services.push({
            name: urls.length > 1 ? `${serviceName}-${index + 1}` : serviceName,
            url: url,
            enabled: true,
          });
        });
      }
    }
  }

  return services;
}

/**
 * 특정 서비스의 URL을 가져옵니다.
 * 콤마로 구분된 여러 URL이 있는 경우 첫 번째 URL을 반환합니다.
 * @param serviceName 서비스 이름 (예: 'gpt-visualizer' 또는 'gpt_visualizer')
 */
export function getServiceUrl(serviceName: string): string | null {
  // 하이픈을 언더스코어로 변환하여 환경변수 키 생성
  const normalizedName = serviceName.toUpperCase().replace(/-/g, '_');
  const envKey = `EXTERNAL_SERVICE_${normalizedName}_SERVER_URL`;
  const urlValue = process.env[envKey];
  if (!urlValue || !urlValue.trim()) {
    console.error('[ServiceConfig] Missing required env var:', envKey);
    return null;
  }
  
  // 콤마로 구분된 여러 URL 중 첫 번째 URL 반환
  const urls = urlValue
    .split(',')
    .map(url => url.trim())
    .filter(url => url.length > 0);
  
  return urls.length > 0 ? urls[0] : null;
}

