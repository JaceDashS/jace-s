/**
 * 카드 뒷면 컴포넌트 (자격증 그리드 또는 코멘트 섹션)
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Language } from '../../types/mainContent';
import CommentSection from './CommentSection';
import { fetchAssetsManifest, getCertifications, createImageRetryHandler } from '../../utils/assetUtils';
import type { CertificationData } from '../../types/assets';
import { BUTTON_MAX_FACTOR, CARD_WIDTH, BUTTON_PADDING, BUTTON_FONT } from '../../constants/buttonConstants';
import { isInMarker1, isInMarker2 } from '../../constants/markerConstants';
import styles from './CardBack.module.css';

interface CardBackProps {
  scrollProgress: number;
  language: Language;
  certificationText: Record<Language, string>;
  setSelectedCertification: (cert: string | null) => void;
  setIsCardFlipped: (flipped: boolean | ((prev: boolean) => boolean)) => void;
}

export default function CardBack({
  scrollProgress,
  language,
  certificationText,
  setSelectedCertification,
  setIsCardFlipped,
}: CardBackProps) {
  const [certifications, setCertifications] = useState<CertificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevScrollProgressRef = useRef<number>(scrollProgress);
  const [buttonPadding, setButtonPadding] = useState<{ px: number; py: number }>({ 
    px: BUTTON_PADDING.MAX_PX * BUTTON_MAX_FACTOR, 
    py: BUTTON_PADDING.MAX_PY * BUTTON_MAX_FACTOR 
  });
  const [buttonFontSize, setButtonFontSize] = useState(
    `${BUTTON_FONT.MAX * BUTTON_MAX_FACTOR}rem`
  );

  useEffect(() => {
    async function loadCertifications() {
      setIsLoading(true);
      const manifest = await fetchAssetsManifest();
      if (manifest) {
        const certs = getCertifications(manifest);
        setCertifications(certs);
      }
      setIsLoading(false);
    }
    loadCertifications();
  }, []);

  // 버튼 크기 반응형 조정 (CardFront와 동일한 로직)
  useEffect(() => {
    const updateButtonSizes = () => {
      if (!containerRef.current) return;
      
      const containerWidth = containerRef.current.offsetWidth;
      const { MIN: minWidth, MAX: maxWidth } = CARD_WIDTH;
      
      const interpolate = (min: number, max: number, width: number): number => {
        if (width <= minWidth) return min;
        if (width >= maxWidth) return max;
        const ratio = (width - minWidth) / (maxWidth - minWidth);
        return min + (max - min) * ratio;
      };
      
      const buttonMaxPx = BUTTON_PADDING.MAX_PX * BUTTON_MAX_FACTOR;
      const buttonMaxPy = BUTTON_PADDING.MAX_PY * BUTTON_MAX_FACTOR;
      const buttonFontMax = BUTTON_FONT.MAX * BUTTON_MAX_FACTOR;
      
      const buttonPx = interpolate(
        BUTTON_PADDING.MIN_PX,
        buttonMaxPx,
        containerWidth
      );
      const buttonPy = interpolate(
        BUTTON_PADDING.MIN_PY,
        buttonMaxPy,
        containerWidth
      );
      const buttonFontSizeRem = interpolate(
        BUTTON_FONT.MIN,
        buttonFontMax,
        containerWidth
      );
      
      setButtonPadding({ px: buttonPx, py: buttonPy });
      setButtonFontSize(buttonFontSizeRem + 'rem');
    };

    const timeoutId = setTimeout(() => {
      updateButtonSizes();
    }, 100);
    
    const resizeObserver = new ResizeObserver(() => {
      updateButtonSizes();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, []);

  // scrollProgress 1.5 이상에서는 코멘트 섹션 표시, 그 외에는 자격증 그리드 표시
  const showComments = scrollProgress >= 1.5;

  // 댓글 섹션은 항상 마운트되어 미리 로드되도록 함 (보이지 않을 때는 숨김)
  // Back 버튼 클릭 핸들러
  const handleBackClick = useCallback(() => {
    setSelectedCertification(null);
    setIsCardFlipped(false);
  }, [setSelectedCertification, setIsCardFlipped]);

  // certification 카드 상태에서 스크롤 다운 감지하여 Back 버튼 자동 클릭
  useEffect(() => {
    const prevScrollProgress = prevScrollProgressRef.current;
    // 1번 마커 구간 또는 2번 마커 구간의 초반부에서 자격증 카드가 보이는 상태
    const isCertificationCardVisible = (isInMarker1(scrollProgress) || (isInMarker2(scrollProgress) && scrollProgress < 2)) && !showComments;
    const isScrollingDown = scrollProgress > prevScrollProgress;

    // certification 카드가 보이는 상태에서 스크롤 다운 시 Back 버튼 자동 클릭
    if (isCertificationCardVisible && isScrollingDown) {
      handleBackClick();
    }

    prevScrollProgressRef.current = scrollProgress;
  }, [scrollProgress, showComments, handleBackClick]);

  const handleCertificationClick = (certKey: string, documents: CertificationData['documents']) => {
    // 이미지나 PDF가 있으면 선택된 자격증으로 설정 (둘 다 RightCardContent에서 처리)
    const pdfDoc = documents.find(doc => doc.type === 'pdf');
    
    if (pdfDoc) {
        setSelectedCertification(certKey);
    }
  };

  return (
    <div
      ref={containerRef}
      className={styles.cardContainer}
    >
      {/* 댓글 섹션: 항상 마운트되어 미리 로드, 보이지 않을 때는 숨김 */}
      <div style={{ display: showComments ? 'block' : 'none', height: '100%', minHeight: 0 }}>
        <CommentSection />
      </div>
      
      {/* 자격증 그리드: 댓글이 보일 때는 숨김 */}
      <div style={{ display: showComments ? 'none' : 'block', height: '100%', minHeight: 0 }}>
        <div className={styles.contentContainer}>
          <h2 className={styles.sectionTitle}>{certificationText[language]}</h2>
          {/* 자격증 그리드 (3x3) */}
          <div className={styles.certGridWrapper}>
            <div className={styles.certGrid}>
            {isLoading ? (
              // 로딩 중 (최대 9개)
              Array.from({ length: 9 }).map((_, index) => (
                <div
                  key={index}
                    className={styles.loadingItem}
                >
                    <span className={styles.loadingText}>Loading...</span>
                </div>
              ))
            ) : certifications.length === 0 ? (
              // 자격증이 없는 경우
              <div className={styles.emptyMessage}>
                No certifications available
              </div>
            ) : (
              // 자격증 표시 (3x3 그리드, 빈 칸은 플레이스홀더로 표시)
              Array.from({ length: 9 }).map((_, index) => {
                const cert = certifications[index];
                
                if (cert) {
                  // 자격증이 있는 경우
                  const handleCertImageError = cert.iconUrl
                    ? createImageRetryHandler(
                        cert.iconUrl,
                        3,
                        (img) => {
                          // 최종 실패 시 기본 아이콘 표시
                          img.style.display = 'none';
                          if (img.parentElement) {
                            img.parentElement.innerHTML = '<span class="text-2xl">📜</span>';
                          }
                        }
                      )
                    : undefined;

                  return (
                    <button
                      key={cert.key}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCertificationClick(cert.key, cert.documents);
                      }}
                      className={styles.certItem}
                    >
                      {cert.iconUrl ? (
                        <img
                          src={cert.iconUrl}
                          alt={cert.key}
                          className={styles.certImage}
                          onError={handleCertImageError}
                        />
                      ) : (
                        <span className={styles.certEmoji}>📜</span>
                      )}
                    </button>
                  );
                } else {
                  // 빈 칸 플레이스홀더
                  return (
                    <div
                      key={`placeholder-${index}`}
                    className={styles.certPlaceholder}
                    >
                    <span className={styles.placeholderEmoji}>📜</span>
                    </div>
                  );
                }
              })
            )}
            </div>
          </div>
          {/* 뒤로 가기 버튼 (우측 하단) */}
          <div className={styles.backButtonContainer}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBackClick();
              }}
              className={styles.backButton}
              style={{
                paddingLeft: `${buttonPadding.px * 0.25}rem`,
                paddingRight: `${buttonPadding.px * 0.25}rem`,
                paddingTop: `${buttonPadding.py * 0.25}rem`,
                paddingBottom: `${buttonPadding.py * 0.25}rem`,
                fontSize: buttonFontSize,
              }}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

