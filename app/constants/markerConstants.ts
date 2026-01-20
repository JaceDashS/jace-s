/**
 * 마커 구간 상수 정의
 * 각 마커의 시작과 끝 지점을 명확히 정의
 */

export const MARKER_1 = {
  START: 0,
  END: 1,
  NAME: 'Home',
  PATH: '/home',
} as const;

export const MARKER_2 = {
  START: 1,
  END: 3,
  NAME: 'Apps',
  PATH: '/apps',
} as const;

export const MARKER_4 = {
  START: 3,
  END: Infinity,
  NAME: 'Comments',
  PATH: '/comments',
} as const;

/**
 * 마커 범위 체크 헬퍼 함수
 */
export const isInMarker1 = (scrollProgress: number): boolean => {
  return scrollProgress >= MARKER_1.START && scrollProgress < MARKER_1.END;
};

export const isInMarker2 = (scrollProgress: number): boolean => {
  return scrollProgress >= MARKER_2.START && scrollProgress < MARKER_2.END;
};

export const isInMarker4 = (scrollProgress: number): boolean => {
  return scrollProgress >= MARKER_4.START;
};

/**
 * 마커 범위 내에 있는지 체크 (시작점 포함, 끝점 미포함)
 */
export const isInMarkerRange = (
  scrollProgress: number,
  start: number,
  end: number
): boolean => {
  return scrollProgress >= start && scrollProgress < end;
};

