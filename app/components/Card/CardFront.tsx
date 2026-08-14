/**
 * 카드 앞면 컴포넌트
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { PROJECTS_PER_PAGE } from '../../constants/gridConstants';
import type { Language } from '../../types/mainContent';
import type { App } from '../../types/app';
import { useCardFrontLinks } from '../../hooks/useCardFrontLinks';
import { useCardFrontPhotos } from '../../hooks/useCardFrontPhotos';
import { useCardFrontResponsiveLayout } from '../../hooks/useCardFrontResponsiveLayout';
import ImageWithLoader from '../ImageWithLoader';
import AppItem from './AppItem';
import styles from './CardFront.module.css';

// 패딩 관련 상수
const PADDING_CONFIG = {
  // 상단 패딩 최대값 (px)
  TOP_PADDING_MAX: 100, // 5rem = 80px (16px 기준)
  // 하단 패딩 임계값 (px) - 이 값 이하로 내려가면 상단 패딩도 1:1로 줄어듦
  BOTTOM_PADDING_THRESHOLD: 48, // 3rem = 48px
  // 하단 패딩 최소값 (px)
  BOTTOM_PADDING_MIN: 32, // 2rem = 32px
} as const;

const cardFrontCopy: Record<Language, {
  appsTitle: string;
  emailLabel: string;
  emailCopied: string;
}> = {
  en: { appsTitle: 'Apps', emailLabel: 'Email', emailCopied: 'Email copied to clipboard!' },
  ko: { appsTitle: '앱', emailLabel: '이메일', emailCopied: '이메일 주소를 복사했습니다!' },
  ja: { appsTitle: 'アプリ', emailLabel: 'メール', emailCopied: 'メールアドレスをコピーしました！' },
  zh: { appsTitle: '应用', emailLabel: '邮箱', emailCopied: '邮箱地址已复制！' },
};

interface CardFrontProps {
  greetingFade: number;
  appsFade: number;
  photoCardFade: number;
  scrollProgress: number;
  apps: App[];
  currentProjectPage: number;
  setCurrentProjectPage: (page: number | ((prev: number) => number)) => void;
  language: Language;
  certificationText: Record<Language, string>;
  setIsCardFlipped: (flipped: boolean | ((prev: boolean) => boolean)) => void;
  profileName: string;
  profileDescription: string;
  profileLinks?: Record<string, string>;
  greetingText: string;
  nameSuffix: string;
  disablePointerEvents?: boolean;
  compactTypography?: boolean;
  layoutActive?: boolean;
}

export default function CardFront({
  greetingFade,
  appsFade,
  photoCardFade,
  scrollProgress,
  apps,
  currentProjectPage,
  setCurrentProjectPage,
  language,
  certificationText,
  setIsCardFlipped,
  profileName,
  profileDescription,
  profileLinks,
  greetingText,
  nameSuffix,
  disablePointerEvents = false,
  compactTypography = false,
  layoutActive = true,
}: CardFrontProps) {
  const uiCopy = cardFrontCopy[language];
  const closeAppModalText: Record<Language, string> = {
    en: 'Close',
    ko: '닫기',
    ja: '閉じる',
    zh: '关闭',
  };
  // 언어별 캐주얼 폰트 설정
  const getFontFamily = (lang: Language): string => {
    switch (lang) {
      case 'ko':
        return "'맑은 고딕', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
      case 'ja':
        return "'Hiragino Sans', 'Yu Gothic', 'Meiryo', 'Noto Sans JP', sans-serif";
      case 'zh':
        return "'Microsoft YaHei', 'SimHei', 'PingFang SC', 'Noto Sans SC', sans-serif";
      case 'en':
      default:
        return "system-ui, -apple-system, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif";
    }
  };

  const fontFamily = getFontFamily(language);
  const containerRef = useRef<HTMLDivElement>(null);
  const fadeContainerRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const buttonGroupRef = useRef<HTMLDivElement>(null);
  const isHomeLinksActive = scrollProgress === 0;
  const isCompactHome = compactTypography && scrollProgress === 0;
  const desktopCardAccent = appsFade > greetingFade ? '34 211 238' : '168 85 247';
  
  // 언어별 페이지네이션 텍스트
  const paginationText = {
    en: {
      previous: 'Previous',
      next: 'Next',
    },
    ko: {
      previous: '이전',
      next: '다음',
    },
    ja: {
      previous: '前へ',
      next: '次へ',
    },
    zh: {
      previous: '上一页',
      next: '下一页',
    },
  };
  const [emailCopied, setEmailCopied] = useState(false);
  const [expandedAppId, setExpandedAppId] = useState<number | null>(null);
  const {
    fontSize,
    descriptionFontSize,
    buttonPadding,
    smallButtonPadding,
    buttonFontSize,
    iconSize,
    homePhotoLayout,
  } = useCardFrontResponsiveLayout({
    containerRef,
    fadeContainerRef,
    descriptionRef,
    buttonGroupRef,
    greetingClassName: styles.greetingText,
    compactTypography,
    greetingText,
    isCompactHome,
    language,
    layoutActive,
    nameSuffix,
    profileDescription,
    profileName,
  });
  const homePhotos = useCardFrontPhotos({
    isCompactHome,
    photoCount: homePhotoLayout.count,
  });
  
  const {
    instagramUrl,
    githubUrl,
    email,
    compositionUrl,
    guitarUrl,
  } = useCardFrontLinks();

  const linkedDescription = useMemo(() => {
    if (!profileDescription) return null;

    const linkEntries = [
      {
        key: 'composition',
        text: profileLinks?.composition,
        url: compositionUrl,
      },
      {
        key: 'guitar',
        text: profileLinks?.guitar,
        url: guitarUrl,
      },
    ].filter((entry) => entry.text && entry.url) as Array<{
      key: string;
      text: string;
      url: string;
    }>;

    if (linkEntries.length === 0) return profileDescription;

    const escapeRegex = (value: string) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const pattern = linkEntries.map((entry) => escapeRegex(entry.text)).join('|');
    if (!pattern) return profileDescription;

    const regex = new RegExp(`(${pattern})`, 'g');
    const parts = profileDescription.split(regex);

    return parts.map((part, index) => {
      const linkEntry = linkEntries.find((entry) => entry.text === part);
      if (!linkEntry) {
        return part;
      }
      return (
        <a
          key={`${linkEntry.key}-${index}`}
          href={linkEntry.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.descriptionLink}
        >
          {part}
        </a>
      );
    });
  }, [profileDescription, profileLinks, compositionUrl, guitarUrl]);

  // 패딩 동적 계산 (상단/하단 패딩 조정)
  useEffect(() => {
    if (compactTypography) return;

    const updatePadding = () => {
      const fadeContainer = fadeContainerRef.current;
      const descriptionText = descriptionRef.current;
      const greetingElement = fadeContainer?.querySelector(`.${styles.greetingText}`);
      
      if (!fadeContainer || !greetingElement) return;
      
      const containerHeight = fadeContainer.clientHeight;
      const greetingHeight = greetingElement.clientHeight;
      const descriptionHeight = descriptionText?.clientHeight ?? 0;
      
      // 사용 가능한 공간 계산
      const availableSpace = Math.max(0, containerHeight - greetingHeight - descriptionHeight);
      
      // 하단 패딩 계산 (기본적으로 사용 가능한 공간의 절반, 최소값 보장)
      let bottomPadding = Math.max(availableSpace / 2, PADDING_CONFIG.BOTTOM_PADDING_MIN);
      
      // ????<" ?O"?"c ?3,?,? (?,"??? ?3???,)
      let topPadding = Math.max(0, availableSpace - bottomPadding);
      
      // ??~?<" ?O"?"c??" ?z,?3,??' ??"??~??o ?,'???????c', ????<" ?O"?"c??, 1:1??o ??,?-'?"?
      if (bottomPadding <= PADDING_CONFIG.BOTTOM_PADDING_THRESHOLD) {
        const ratio = bottomPadding / PADDING_CONFIG.BOTTOM_PADDING_THRESHOLD;
        topPadding = Math.max(0, topPadding * ratio);
        bottomPadding = Math.max(availableSpace - topPadding, PADDING_CONFIG.BOTTOM_PADDING_MIN);
        topPadding = Math.max(0, availableSpace - bottomPadding);
      }
      
      // ????<" ?O"?"c ??o?O???' ????sc (?z|?z, ??~?<" ?O"?"c??, ??"??"??O)
      if (topPadding > PADDING_CONFIG.TOP_PADDING_MAX) {
        topPadding = PADDING_CONFIG.TOP_PADDING_MAX;
        bottomPadding = Math.max(availableSpace - topPadding, PADDING_CONFIG.BOTTOM_PADDING_MIN);
        topPadding = Math.max(0, availableSpace - bottomPadding);
      }

      // CSS 변수로 패딩 적용
      fadeContainer.style.setProperty('--top-padding', `${topPadding}px`);
      fadeContainer.style.setProperty('--bottom-padding', `${bottomPadding}px`);
    };

    // 초기 계산
    const timeoutId = setTimeout(() => {
      updatePadding();
    }, 100);

    // ResizeObserver로 컨테이너 크기 변화 감지
    const resizeObserver = new ResizeObserver(() => {
      updatePadding();
    });

    if (fadeContainerRef.current) {
      resizeObserver.observe(fadeContainerRef.current);
    }
    if (descriptionRef.current) {
      resizeObserver.observe(descriptionRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [compactTypography, profileDescription]);

  return (
    <div
      ref={containerRef}
      className={`${styles.cardContainer} ${compactTypography ? styles.compactTypography : ''} relative`}
      inert={disablePointerEvents}
      aria-hidden={disablePointerEvents || undefined}
      style={{
        pointerEvents: disablePointerEvents ? 'none' : 'auto',
        '--mobile-card-accent': compactTypography ? undefined : desktopCardAccent,
        '--mobile-card-glow-opacity': compactTypography ? undefined : 0.18,
      } as CSSProperties}
    >
      {/* 텍스트 컨테이너 - 남은 공간을 모두 차지 */}
      <div className={styles.textContainer}>
        {/* 초기 컨텐츠 - 크로스페이드 아웃 */}
        <div
          ref={fadeContainerRef}
          className={styles.fadeContainer}
          style={{
            opacity: photoCardFade,
          }}
        >
          <h2 
            className={styles.greetingText}
            style={{ 
              fontFamily,
              fontSize: fontSize,
            }}
          >
            {greetingText || 'Hello, I\'m'}{profileName ? ` ${profileName}${nameSuffix || ''}` : ''}
          </h2>
          {profileDescription && (
            <div className={styles.descriptionContainer} data-card-scroll-region>
              <p 
                ref={descriptionRef}
                className={styles.descriptionText}
                style={{ 
                  fontFamily,
                  fontSize: descriptionFontSize,
                  pointerEvents: isHomeLinksActive ? 'auto' : 'none',
                }}
              >
                {linkedDescription}
              </p>
            </div>
          )}
          {isCompactHome && homePhotoLayout.count > 0 && (
            <div
              className={styles.dynamicHomePhotos}
              data-photo-count={homePhotoLayout.count}
              style={{ height: `${homePhotoLayout.height}px` }}
              aria-hidden="true"
            >
              {Array.from({ length: homePhotoLayout.count }, (_, index) => {
                const photoUrl = homePhotos[index];
                return (
                  <div key={photoUrl || `photo-slot-${index}`} className={styles.dynamicHomePhotoItem}>
                    {photoUrl ? (
                      <ImageWithLoader
                        src={photoUrl}
                        alt=""
                        className={styles.dynamicHomePhotoImage}
                        maxRetries={1}
                        loadingComponent={<span className={styles.dynamicHomePhotoPlaceholder} />}
                        fallback={<span className={styles.dynamicHomePhotoPlaceholder} />}
                        decoding="async"
                        loading="eager"
                        draggable={false}
                      />
                    ) : (
                      <span className={styles.dynamicHomePhotoPlaceholder} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* 변경된 컨텐츠 - 크로스페이드 인 */}
        <div
          className={styles.appsContainer}
          style={{
            opacity: appsFade,
            pointerEvents: scrollProgress >= 1 && scrollProgress < 2 ? 'auto' : 'none',
          }}
        >
          <h2 className={styles.sectionTitle}>{uiCopy.appsTitle}</h2>
          {/* 앱 목록 - 버튼 영역을 제외한 전체 공간 사용 */}
          <div
            className={`${styles.appsList} ${styles.compactAppsList} ${compactTypography ? '' : styles.desktopCompactAppsList}`}
            data-card-scroll-region
          >
            {apps
              .slice((currentProjectPage - 1) * PROJECTS_PER_PAGE, currentProjectPage * PROJECTS_PER_PAGE)
              .map((app) => (
                <AppItem
                  key={app.id}
                  app={app}
                  buttonFontSize={buttonFontSize}
                  iconSize={iconSize}
                  compact
                  expanded={expandedAppId === app.id}
                  closeLabel={closeAppModalText[language]}
                  onToggle={() => {
                    setExpandedAppId((currentId) => currentId === app.id ? null : app.id);
                  }}
                />
              ))}
                  </div>
          {/* 페이지네이션 - 카드 하단에 배치 (항상 표시, 5개 미만이면 비활성화) */}
          {apps.length > 0 && (
            <div className={styles.paginationContainer}>
              <button
                onClick={() => setCurrentProjectPage((prev) => Math.max(1, prev - 1))}
                disabled={currentProjectPage === 1 || apps.length <= PROJECTS_PER_PAGE}
                className={styles.paginationButton}
                style={{
                  paddingLeft: `${smallButtonPadding.px * 0.25}rem`,
                  paddingRight: `${smallButtonPadding.px * 0.25}rem`,
                  paddingTop: `${smallButtonPadding.py * 0.25}rem`,
                  paddingBottom: `${smallButtonPadding.py * 0.25}rem`,
                  fontSize: buttonFontSize,
                }}
              >
                {paginationText[language].previous}
              </button>
              <span 
                className={styles.paginationPageInfo}
                style={{
                  paddingLeft: `${smallButtonPadding.px * 0.25}rem`,
                  paddingRight: `${smallButtonPadding.px * 0.25}rem`,
                  paddingTop: `${smallButtonPadding.py * 0.25}rem`,
                  paddingBottom: `${smallButtonPadding.py * 0.25}rem`,
                  fontSize: buttonFontSize,
                }}
              >
                {currentProjectPage} / {Math.max(1, Math.ceil(apps.length / PROJECTS_PER_PAGE))}
              </span>
              <button
                onClick={() =>
                  setCurrentProjectPage((prev) =>
                    Math.min(Math.ceil(apps.length / PROJECTS_PER_PAGE), prev + 1)
                  )
                }
                disabled={currentProjectPage >= Math.ceil(apps.length / PROJECTS_PER_PAGE) || apps.length <= PROJECTS_PER_PAGE}
                className={styles.paginationButton}
                style={{
                  paddingLeft: `${smallButtonPadding.px * 0.25}rem`,
                  paddingRight: `${smallButtonPadding.px * 0.25}rem`,
                  paddingTop: `${smallButtonPadding.py * 0.25}rem`,
                  paddingBottom: `${smallButtonPadding.py * 0.25}rem`,
                  fontSize: buttonFontSize,
                }}
              >
                {paginationText[language].next}
              </button>
            </div>
          )}
        </div>
      </div>
      {/* 버튼을 카드의 우측 하단에 배치 (텍스트 컨테이너 밖) */}
      <div ref={buttonGroupRef} className={styles.buttonGroup}>
        <div className={styles.socialButtonRow}>
          {/* Instagram */}
          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.buttonBase} ${styles.buttonFilled} ${styles.buttonSocial}`}
              style={{
                opacity: greetingFade,
                pointerEvents: isHomeLinksActive ? 'auto' : 'none',
                transition: 'opacity 0.3s ease-in-out',
                paddingLeft: `${buttonPadding.px * 0.25}rem`,
                paddingRight: `${buttonPadding.px * 0.25}rem`,
                paddingTop: `${buttonPadding.py * 0.25}rem`,
                paddingBottom: `${buttonPadding.py * 0.25}rem`,
                fontSize: buttonFontSize,
                textDecoration: 'none',
              }}
            >
              <svg style={{ width: iconSize, height: iconSize }} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
              <span className={styles.buttonText}>Instagram</span>
            </a>
          )}
          {/* GitHub */}
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.buttonBase} ${styles.buttonFilled} ${styles.buttonSocial}`}
              style={{
                opacity: greetingFade,
                pointerEvents: isHomeLinksActive ? 'auto' : 'none',
                transition: 'opacity 0.3s ease-in-out',
                paddingLeft: `${buttonPadding.px * 0.25}rem`,
                paddingRight: `${buttonPadding.px * 0.25}rem`,
                paddingTop: `${buttonPadding.py * 0.25}rem`,
                paddingBottom: `${buttonPadding.py * 0.25}rem`,
                fontSize: buttonFontSize,
                textDecoration: 'none',
              }}
            >
              <svg className={styles.icon} style={{ width: iconSize, height: iconSize }} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span className={styles.buttonText}>GitHub</span>
            </a>
          )}
          {/* Email */}
          {email && (() => {
            
            const handleEmailClick = async (e: MouseEvent<HTMLAnchorElement>) => {
              e.preventDefault();
              
              try {
                // 클립보드에 이메일 주소 복사
                await navigator.clipboard.writeText(email);
                setEmailCopied(true);
                
                // 2초 후 복사 상태 해제
                setTimeout(() => {
                  setEmailCopied(false);
                }, 2000);
                
                // mailto 링크도 시도 (백업)
                const subject = encodeURIComponent('Contact from jace-s.com');
                const body = encodeURIComponent('Hello,\n\n');
                const mailtoLink = `mailto:${email}?subject=${subject}&body=${body}`;
                window.location.href = mailtoLink;
              } catch {
                // 클립보드 복사 실패 시 mailto 링크만 시도
                const subject = encodeURIComponent('Contact from jace-s.com');
                const body = encodeURIComponent('Hello,\n\n');
                const mailtoLink = `mailto:${email}?subject=${subject}&body=${body}`;
                window.location.href = mailtoLink;
              }
            };
            
            return (
              <a
                href={`mailto:${email}`}
                onClick={handleEmailClick}
                className={`${styles.buttonBase} ${styles.buttonFilled} ${styles.buttonSocial}`}
                style={{
                  opacity: greetingFade,
                  pointerEvents: isHomeLinksActive ? 'auto' : 'none',
                  transition: 'opacity 0.3s ease-in-out',
                  paddingLeft: `${buttonPadding.px * 0.25}rem`,
                  paddingRight: `${buttonPadding.px * 0.25}rem`,
                  paddingTop: `${buttonPadding.py * 0.25}rem`,
                  paddingBottom: `${buttonPadding.py * 0.25}rem`,
                  fontSize: buttonFontSize,
                  textDecoration: 'none',
                }}
                title={emailCopied ? uiCopy.emailCopied : `${uiCopy.emailLabel}: ${email}`}
              >
                <svg className={styles.icon} style={{ width: iconSize, height: iconSize }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className={styles.buttonText}>{emailCopied ? 'Copied!' : 'Email'}</span>
              </a>
            );
          })()}
        </div>
        {/* 자격증 */}
        <button
          onClick={(e) => {
            if (window.scrollY > 1) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            setIsCardFlipped(true);
          }}
          className={`${styles.buttonBase} ${styles.buttonOutline}`}
          style={{
            opacity: greetingFade,
            pointerEvents: isHomeLinksActive ? 'auto' : 'none',
            transition: 'opacity 0.3s ease-in-out',
            paddingLeft: `${buttonPadding.px * 0.25}rem`,
            paddingRight: `${buttonPadding.px * 0.25}rem`,
            paddingTop: `${buttonPadding.py * 0.25}rem`,
            paddingBottom: `${buttonPadding.py * 0.25}rem`,
            fontSize: buttonFontSize,
          }}
        >
          {certificationText[language]}
        </button>
      </div>
    </div>
  );
}
