'use client';

import { useState, useRef } from 'react';

interface ImageWithLoaderProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallback?: React.ReactNode;
  loadingComponent?: React.ReactNode;
  maxRetries?: number;
  onFinalError?: (src: string) => void;
}

export default function ImageWithLoader({
  src,
  fallback,
  loadingComponent,
  maxRetries = 3,
  onFinalError,
  className,
  alt,
  style,
  ...props
}: ImageWithLoaderProps) {
  // src가 변경되면 key가 변경되어 내부 컴포넌트가 완전히 새로 마운트됨
  // 이를 통해 상태 초기화 로직을 별도로 작성할 필요가 없음
  return (
    <ImageWithLoaderInner
      key={src}
      src={src}
      fallback={fallback}
      loadingComponent={loadingComponent}
      maxRetries={maxRetries}
      onFinalError={onFinalError}
      className={className}
      alt={alt}
      style={style}
      {...props}
    />
  );
}

function ImageWithLoaderInner({
  src,
  fallback,
  loadingComponent,
  maxRetries = 3,
  onFinalError,
  className,
  alt,
  style,
  onLoad,
  onError,
  ...props
}: ImageWithLoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const retryCount = useRef(0);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // 이미 에러 상태라면 무시
    if (error) return;

    if (retryCount.current < maxRetries) {
      retryCount.current++;
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, retryCount.current - 1) * 1000;
      
      setTimeout(() => {
        const separator = src.includes('?') ? '&' : '?';
        // 타임스탬프를 갱신하여 브라우저 캐시 우회
        setCurrentSrc(`${src}${separator}_retry=${retryCount.current}&_t=${Date.now()}`);
      }, delay);
    } else {
      setIsLoading(false);
      setError(true);
      if (onFinalError) {
        onFinalError(src);
      }
    }
    
    // Call original onError if provided
    if (onError) {
        onError(e);
    }
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoading(false);
    setError(false);
    
    // Call original onLoad if provided
    if (onLoad) {
        onLoad(e);
    }
  };

  return (
    <>
      {isLoading && loadingComponent}
      {!error && (
        <img
          src={currentSrc}
          alt={alt}
          className={className}
          onError={handleError}
          onLoad={handleLoad}
          style={{ 
            ...style, 
            display: isLoading ? 'none' : (style?.display || undefined) 
          }}
          {...props}
        />
      )}
      {error && fallback}
    </>
  );
}
