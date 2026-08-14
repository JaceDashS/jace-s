'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { App } from '../types/app';
import type { Language } from '../types/mainContent';
import useMediaQuery from '../hooks/useMediaQuery';
import { MOBILE_CARD_INDEXES, useMobileCardGesture } from '../hooks/useMobileCardGesture';
import CardBack from './Card/CardBack';
import CardFront from './Card/CardFront';
import CommentSection from './Card/CommentSection';
import RightCardContent from './Card/RightCardContent';
import styles from './MobileContent.module.css';

interface MobileContentProps {
  visible: boolean;
  apps: App[];
  currentProjectPage: number;
  setCurrentProjectPage: (page: number | ((prev: number) => number)) => void;
  language: Language;
  setLanguage: (language: Language) => void;
  certificationText: Record<Language, string>;
  profileName: string;
  profileDescription: string;
  profileLinks?: Record<string, string>;
  greetingText: string;
  nameSuffix: string;
}

const cardAccentChannels = ['168 85 247', '34 211 238', '244 114 182'] as const;
const MOBILE_MEDIA_QUERY = '(max-width: 600px)';
const swipeCoachCopy: Record<Language, { title: string; description: string }> = {
  en: {
    title: 'Swipe to explore',
    description: 'Move between Home, Apps, and Comments',
  },
  ko: {
    title: '밀어서 둘러보기',
    description: '홈, 앱, 댓글 카드를 이동해 보세요',
  },
  ja: {
    title: 'スワイプして見る',
    description: 'ホーム・アプリ・コメントを移動できます',
  },
  zh: {
    title: '滑动浏览',
    description: '在主页、应用和评论卡片之间切换',
  },
};

const mobileUiCopy: Record<Language, {
  portfolioLabel: string;
  languageSelector: string;
  cardRegion: string;
  cardSelection: string;
  cards: readonly [string, string, string];
  cardLabel: (cardName: string) => string;
  goToCard: (cardName: string) => string;
  back: string;
}> = {
  en: {
    portfolioLabel: 'Mobile portfolio',
    languageSelector: 'Select language',
    cardRegion: 'Card area. Use the left and right arrow keys or swipe to change cards.',
    cardSelection: 'Select card',
    cards: ['Home', 'Apps', 'Comments'],
    cardLabel: (cardName) => `${cardName} card`,
    goToCard: (cardName) => `Go to ${cardName} card`,
    back: 'Back',
  },
  ko: {
    portfolioLabel: '모바일 포트폴리오',
    languageSelector: '언어 선택',
    cardRegion: '카드 영역. 좌우 화살표 키 또는 스와이프로 카드를 전환할 수 있습니다.',
    cardSelection: '카드 선택',
    cards: ['홈', '앱', '댓글'],
    cardLabel: (cardName) => `${cardName} 카드`,
    goToCard: (cardName) => `${cardName} 카드로 이동`,
    back: '뒤로',
  },
  ja: {
    portfolioLabel: 'モバイルポートフォリオ',
    languageSelector: '言語を選択',
    cardRegion: 'カード領域。左右の矢印キーまたはスワイプでカードを切り替えられます。',
    cardSelection: 'カードを選択',
    cards: ['ホーム', 'アプリ', 'コメント'],
    cardLabel: (cardName) => `${cardName}カード`,
    goToCard: (cardName) => `${cardName}カードへ移動`,
    back: '戻る',
  },
  zh: {
    portfolioLabel: '移动端作品集',
    languageSelector: '选择语言',
    cardRegion: '卡片区域。使用左右方向键或滑动切换卡片。',
    cardSelection: '选择卡片',
    cards: ['首页', '应用', '评论'],
    cardLabel: (cardName) => `${cardName}卡片`,
    goToCard: (cardName) => `前往${cardName}卡片`,
    back: '返回',
  },
};

export default function MobileContent({
  visible,
  apps,
  currentProjectPage,
  setCurrentProjectPage,
  language,
  setLanguage,
  certificationText,
  profileName,
  profileDescription,
  profileLinks,
  greetingText,
  nameSuffix,
}: MobileContentProps) {
  const uiCopy = mobileUiCopy[language];
  const isMobileViewport = useMediaQuery(MOBILE_MEDIA_QUERY);
  const {
    flipStageRef,
    activeCard,
    nextCard,
    flipPhase,
    rotation,
    flipDuration,
    activeHomeFace,
    nextHomeFace,
    isCertificateMounted,
    showSwipeCoachMark,
    dismissSwipeCoachMark,
    isCardMounted,
    goToCard,
    flipHomeFace,
    handleFlipEnd,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handlePointerOut,
    handleKeyDown,
  } = useMobileCardGesture({ visible, isMobileViewport });
  const [selectedCertification, setSelectedCertification] = useState<string | null>(null);

  const setMobileCertificateFlipped = (
    flipped: boolean | ((previous: boolean) => boolean)
  ) => {
    const shouldShowCertificate = typeof flipped === 'function'
      ? flipped(activeHomeFace !== 'home')
      : flipped;
    flipHomeFace(shouldShowCertificate ? 'certificate' : 'home');
  };

  const showCertificateDetail = (certification: string | null) => {
    if (!certification) return;

    setSelectedCertification(certification);
    flipHomeFace('certificateDetail');
  };

  const sharedCardProps = {
    apps,
    currentProjectPage,
    setCurrentProjectPage,
    language,
    certificationText,
    profileName,
    profileDescription,
    profileLinks,
    greetingText,
    nameSuffix,
  };

  const renderCard = (index: number) => {
    if (index === 2) {
      return (
        <div className={`${styles.cardShell} ${styles.commentCard}`}>
          <CommentSection title={uiCopy.cards[2]} />
        </div>
      );
    }

    return (
      <div className={`${styles.cardShell} ${index === 0 ? styles.homeCard : styles.appsCard}`}>
        <CardFront
          {...sharedCardProps}
          setIsCardFlipped={setMobileCertificateFlipped}
          greetingFade={index === 0 ? 1 : 0}
          appsFade={index === 1 ? 1 : 0}
          photoCardFade={index === 0 ? 1 : 0}
          scrollProgress={index}
          compactTypography
          layoutActive={visible}
        />
      </div>
    );
  };

  const isHomeFaceActive = activeCard === 0 && activeHomeFace === 'home';
  const isHomeFaceVisible = isHomeFaceActive || nextCard === 0 || nextHomeFace === 'home';
  const isCertificateFaceActive = activeCard === 0 && activeHomeFace === 'certificate';
  const isCertificateFaceVisible = isCertificateFaceActive || nextHomeFace === 'certificate';
  const isCertificateDetailFaceActive = activeCard === 0 && activeHomeFace === 'certificateDetail';
  const isCertificateDetailFaceVisible =
    isCertificateDetailFaceActive || nextHomeFace === 'certificateDetail';

  return (
    <section className={styles.mobileExperience} data-visible={visible} aria-label={uiCopy.portfolioLabel}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>JACE-S</span>
        <select
          className={styles.languageSelect}
          value={language}
          onChange={(event) => {
            dismissSwipeCoachMark();
            setLanguage(event.target.value as Language);
          }}
          aria-label={uiCopy.languageSelector}
        >
          <option value="en">🇺🇸 English</option>
          <option value="ko">🇰🇷 한국어</option>
          <option value="ja">🇯🇵 日本語</option>
          <option value="zh">🇨🇳 中文</option>
        </select>
      </header>

      <div
        ref={flipStageRef}
        className={styles.flipStage}
        data-coach-visible={showSwipeCoachMark}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerOut={handlePointerOut}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-label={uiCopy.cardRegion}
      >
        <article
          className={`${styles.cardLayer} ${showSwipeCoachMark && flipPhase === 'idle' ? styles.coachHint : ''} ${flipPhase === 'dragging' ? styles.isDragging : ''} ${flipPhase === 'settlingThrough' ? styles.isFlipping : ''} ${flipPhase === 'returning' ? styles.isReturning : ''}`}
          aria-label={uiCopy.cardLabel(activeHomeFace === 'certificateDetail' && selectedCertification
            ? selectedCertification
            : activeHomeFace === 'certificate'
              ? certificationText[language]
              : uiCopy.cards[activeCard])}
          onTransitionEnd={handleFlipEnd}
          style={{ '--card-rotation': `${rotation}deg`, '--flip-duration': `${flipDuration}ms` } as CSSProperties}
        >
          {isCardMounted(0) && (
            <div
              className={`${styles.cardFace} ${isHomeFaceActive ? styles.frontCardFace : styles.backCardFace} ${isHomeFaceVisible ? styles.visibleCardFace : styles.inactiveCardFace}`}
              aria-hidden={!isHomeFaceVisible}
            >
              {renderCard(0)}
            </div>
          )}
          {isCardMounted(0) && isCertificateMounted && (
            <div
              className={`${styles.cardFace} ${isCertificateFaceActive ? styles.frontCardFace : styles.backCardFace} ${isCertificateFaceVisible ? styles.visibleCardFace : styles.inactiveCardFace}`}
              aria-hidden={!isCertificateFaceVisible}
            >
              <div className={`${styles.cardShell} ${styles.certificateCard}`}>
                <CardBack
                  compact
                  scrollProgress={0}
                  language={language}
                  certificationText={certificationText}
                  setSelectedCertification={showCertificateDetail}
                  setIsCardFlipped={setMobileCertificateFlipped}
                />
              </div>
            </div>
          )}
          {isCardMounted(0) && selectedCertification && (
            <div
              className={`${styles.cardFace} ${isCertificateDetailFaceActive ? styles.frontCardFace : styles.backCardFace} ${isCertificateDetailFaceVisible ? styles.visibleCardFace : styles.inactiveCardFace}`}
              aria-hidden={!isCertificateDetailFaceVisible}
            >
              <div className={`${styles.cardShell} ${styles.certificateDetailCard}`}>
                <div className={styles.certificateDetailContent}>
                  <h2 className={styles.certificateDetailTitle}>{selectedCertification}</h2>
                  <div className={styles.certificateDetailDocument}>
                    <RightCardContent
                      certificateOnly
                      selectedCertification={selectedCertification}
                      photoCardFade={1}
                    />
                  </div>
                  <div className={styles.certificateDetailActions}>
                    <button
                      type="button"
                      className={styles.certificateDetailBackButton}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        flipHomeFace('certificate');
                      }}
                    >
                      {uiCopy.back}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {MOBILE_CARD_INDEXES.filter((index) => index !== 0 && isCardMounted(index)).map((index) => (
            <div
              key={index}
              className={`${styles.cardFace} ${index === activeCard ? styles.frontCardFace : styles.backCardFace} ${index === activeCard || index === nextCard ? styles.visibleCardFace : styles.inactiveCardFace}`}
              aria-hidden={index !== activeCard && index !== nextCard}
            >
              {renderCard(index)}
            </div>
          ))}
        </article>
        {showSwipeCoachMark && (
          <div
            className={styles.swipeCoachMark}
            role="status"
            aria-label={`${swipeCoachCopy[language].title}. ${swipeCoachCopy[language].description}`}
          >
            <div className={styles.swipeCoachGesture} aria-hidden="true">
              <svg className={styles.swipeCoachTrack} viewBox="0 0 160 24">
                <path d="M146 12H18M18 12l10-8M18 12l10 8" />
              </svg>
              <span className={styles.swipeCoachPointer}>
                <span className={styles.swipeCoachContact} />
                <svg className={styles.swipeCoachFinger} viewBox="0 0 24 24">
                  <path d="M22 14a8 8 0 0 1-8 8" />
                  <path d="M18 11v-1a2 2 0 0 0-4 0" />
                  <path d="M14 10V9a2 2 0 0 0-4 0v1" />
                  <path d="M10 9.5V4a2 2 0 0 0-4 0v10" />
                  <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4c-2.8 0-4.5-.86-5.99-2.34l-1.65-1.65a2 2 0 0 1 2.83-2.82L7 16" />
                </svg>
              </span>
            </div>
            <strong className={styles.swipeCoachTitle}>{swipeCoachCopy[language].title}</strong>
            <span className={styles.swipeCoachDescription}>{swipeCoachCopy[language].description}</span>
          </div>
        )}
      </div>

      <nav
        className={styles.pagination}
        aria-label={uiCopy.cardSelection}
        style={{ '--mobile-active-accent': cardAccentChannels[activeCard] } as CSSProperties}
      >
        {uiCopy.cards.map((label, index) => (
          <button
            key={label}
            type="button"
            className={index === activeCard ? styles.activeDot : styles.dot}
            onClick={() => goToCard(index)}
            aria-label={uiCopy.goToCard(label)}
            aria-current={index === activeCard ? 'page' : undefined}
            disabled={
              flipPhase !== 'idle' ||
              !isCardMounted(index) ||
              Math.abs(index - activeCard) > 1 ||
              (activeHomeFace !== 'home' && index !== 0)
            }
          />
        ))}
      </nav>
    </section>
  );
}
