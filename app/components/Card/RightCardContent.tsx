/**
 * 오른쪽 카드 컨텐츠 컴포넌트 (포토 그리드 또는 선택된 자격증)
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import HomePhotoGrid from '../PhotoGrid/HomePhotoGrid';
import AppPhotoGrid from '../PhotoGrid/AppPhotoGrid';
import { fetchAssetsManifest, getCertifications } from '../../utils/assetUtils';
import type { CertificationData } from '../../types/assets';
import styles from './RightCardContent.module.css';
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

interface PdfViewport {
  width: number;
  height: number;
}

interface PdfRenderTask {
  promise: Promise<void>;
}

interface PdfPage {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
    transform?: number[];
  }) => PdfRenderTask;
}

interface PdfDocument {
  numPages: number;
  getPage: (pageNum: number) => Promise<PdfPage>;
}

interface PdfLoadingTask {
  promise: Promise<PdfDocument>;
  destroy: () => void;
}

interface PdfjsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: { url: string }) => PdfLoadingTask;
}

let pdfjsLibPromise: Promise<PdfjsLib> | null = null;

async function loadPdfjs(): Promise<PdfjsLib> {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(/* webpackIgnore: true */ PDFJS_URL) as Promise<PdfjsLib>;
  }
  const lib = await pdfjsLibPromise;
  if (lib.GlobalWorkerOptions.workerSrc !== PDFJS_WORKER_URL) {
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  }
  return lib;
}

interface PdfViewerProps {
  url: string | null;
  className?: string;
  canvasClassName?: string;
}

function PdfViewer({ url, className, canvasClassName }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    if (!url) return;

    let cancelled = false;
    let loadingTask: PdfLoadingTask | null = null;

    const run = async () => {
      const pdfjsLib = await loadPdfjs();
      if (cancelled) return;

      loadingTask = pdfjsLib.getDocument({ url });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
        if (cancelled) return;
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1 });
        const availableWidth = container.clientWidth || viewport.width;
        const availableHeight = container.clientHeight || 0;
        const widthScale = availableWidth / viewport.width;
        const heightScale = availableHeight ? availableHeight / viewport.height : Number.POSITIVE_INFINITY;
        const scale = Math.min(widthScale, heightScale);
        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        if (canvasClassName) {
          canvas.className = canvasClassName;
        }

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(scaledViewport.width * outputScale);
        canvas.height = Math.floor(scaledViewport.height * outputScale);
        canvas.style.width = `${scaledViewport.width}px`;
        canvas.style.height = `${scaledViewport.height}px`;

        const context = canvas.getContext('2d');
        if (!context) continue;

        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        };

        await page.render(renderContext).promise;
        if (cancelled) return;
        const wrapper = document.createElement('div');
        wrapper.style.width = '100%';
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        if (scaledViewport.width >= scaledViewport.height && availableHeight) {
          wrapper.style.minHeight = `${availableHeight}px`;
          wrapper.style.alignItems = 'center';
        }
        wrapper.appendChild(canvas);
        container.appendChild(wrapper);
      }
    };

    run().catch(() => {});

    return () => {
      cancelled = true;
      if (loadingTask) {
        loadingTask.destroy();
      }
    };
  }, [url, canvasClassName]);

  return <div ref={containerRef} className={className} />;
}

interface RightCardContentProps {
  selectedCertification: string | null;
  photoCardFade: number;
  onCertificationsLoaded?: () => void;
  onHomePhotosLoaded?: () => void;
}

export default function RightCardContent({ 
  selectedCertification, 
  photoCardFade,
  onCertificationsLoaded,
  onHomePhotosLoaded,
}: RightCardContentProps) {
  const [certifications, setCertifications] = useState<CertificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedPdfUrl, setResolvedPdfUrl] = useState<string | null>(null);
  const [shouldLoadPdf, setShouldLoadPdf] = useState(false);
  const hasPreloadedPdfsRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCertifications() {
      try {
        setIsLoading(true);
        const manifest = await fetchAssetsManifest();
        if (!cancelled && manifest) {
          const certs = getCertifications(manifest);
          setCertifications(certs);
        } else if (!cancelled) {
          setCertifications([]);
        }
      } catch {
        if (!cancelled) {
          setCertifications([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          // certifications 로딩 완료 알림
          onCertificationsLoaded?.();
        }
      }
    }

    loadCertifications();
    return () => {
      cancelled = true;
    };
  }, [onCertificationsLoaded]);

  const preloadPdfUrl = (url: string) => {
    fetch(url, { method: 'GET', mode: 'no-cors', cache: 'force-cache' }).catch(() => {});
  };

  useEffect(() => {
    if (hasPreloadedPdfsRef.current || certifications.length === 0) return;
    const pdfUrls = certifications.flatMap(cert => cert.documents.map(doc => doc.url));
    pdfUrls.forEach(preloadPdfUrl);
    hasPreloadedPdfsRef.current = true;
  }, [certifications]);

  const selectedCert = selectedCertification
    ? certifications.find(c => c.key === selectedCertification)
    : null;
  const pdfDoc = selectedCert?.documents.find(doc => doc.type === 'pdf');

  // flip 애니메이션 완료 후 PDF 로딩 시작 (0.6초 지연)
  // 수정: resolvedPdfUrl을 null로 리셋하지 않고, PDF URL만 업데이트하도록 변경
  useEffect(() => {
    if (selectedCertification) {
      // flip 애니메이션 시작 시 일시적으로 표시만 숨김 (resolvedPdfUrl은 유지)
      setShouldLoadPdf(false);
      
      const timer = setTimeout(() => {
        setShouldLoadPdf(true);
      }, 600); // flip 애니메이션 duration (0.6초)
      
      return () => {
        clearTimeout(timer);
      };
    } else {
      // certification이 없으면 즉시 리셋
      setShouldLoadPdf(false);
      setResolvedPdfUrl(null);
    }
  }, [selectedCertification]);

  useEffect(() => {
    if (!pdfDoc?.url) {
      if (resolvedPdfUrl !== null) {
        setResolvedPdfUrl(null);
      }
      return;
    }

    if (!shouldLoadPdf) return;

    let cancelled = false;
    const originalUrl = pdfDoc.url;

    const checkUrl = async (url: string) => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
      } catch {
        return false;
      }
    };

    const resolve = async () => {
      const okOriginal = await checkUrl(originalUrl);
      if (cancelled) return;
      if (okOriginal) {
        setResolvedPdfUrl(originalUrl);
        return;
      }

      const fallbackUrl = originalUrl.includes('aws-ccp.pdf')
        ? originalUrl.replace('aws-ccp.pdf', 'aws-cpp.pdf')
        : null;

      if (!fallbackUrl) {
        setResolvedPdfUrl(null);
        return;
      }

      const okFallback = await checkUrl(fallbackUrl);
      if (!cancelled) {
        setResolvedPdfUrl(okFallback ? fallbackUrl : null);
      }
    };

    resolve();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc?.url, resolvedPdfUrl, shouldLoadPdf]);

  const photoGridContent = (
    <div className={styles.container}>
      <HomePhotoGrid opacity={photoCardFade} photoCardFade={photoCardFade} onLoaded={onHomePhotosLoaded} />
      <AppPhotoGrid opacity={1 - photoCardFade} photoCardFade={photoCardFade} />
    </div>
  );

  // 뒷면: 자격증
  const shouldShowEmptyMessage = Boolean(selectedCertification) && !resolvedPdfUrl;
  const certificationContent = (
    <div className={styles.certContainer}>
          {isLoading ? (
        <div className={styles.loadingText}>Loading...</div>
          ) : (
            <>
          {/* PDF viewer은 항상 렌더링 (프리로드용), PDF URL이 있을 때만 표시 */}
          <div
            className={styles.documentPdf}
            style={{ display: resolvedPdfUrl && shouldLoadPdf ? 'flex' : 'none' }}
          >
            <PdfViewer
              url={resolvedPdfUrl && shouldLoadPdf ? resolvedPdfUrl : null}
              className={styles.pdfViewer}
              canvasClassName={styles.pdfCanvas}
            />
          </div>
          {shouldShowEmptyMessage && (
            <div className={styles.notFoundContainer}>
              <p className={styles.notFoundText}>
                {selectedCertification && !selectedCert ? 'Certification not found' : 'No document available'}
              </p>
            </div>
          )}
            </>
          )}
        </div>
    );

  return (
    <div className={styles.flipContainer}>
      {/* 앞면: 포토 그리드 */}
      <div className={`${styles.flipFace} ${styles.flipFaceFront}`}>
        {photoGridContent}
      </div>
      {/* 뒷면: 자격증 */}
      <div className={`${styles.flipFace} ${styles.flipFaceBack}`}>
        {certificationContent}
      </div>
    </div>
  );
}
