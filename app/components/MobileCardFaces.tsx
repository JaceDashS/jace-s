import type { CSSProperties, ReactNode, TransitionEvent } from 'react';
import type { Language } from '../types/mainContent';
import {
  MOBILE_CARD_INDEXES,
  type HomeFace,
  type FlipPhase,
} from '../hooks/useMobileCardGesture';
import CardBack from './Card/CardBack';
import RightCardContent from './Card/RightCardContent';
import styles from './MobileContent.module.css';

interface MobileCardFacesProps {
  activeCard: number;
  nextCard: number | null;
  flipPhase: FlipPhase;
  rotation: number;
  flipDuration: number;
  showSwipeCoachMark: boolean;
  activeHomeFace: HomeFace;
  nextHomeFace: HomeFace | null;
  isCertificateMounted: boolean;
  selectedCertification: string | null;
  language: Language;
  certificationText: Record<Language, string>;
  cardLabel: string;
  backLabel: string;
  isCardMounted: (index: number) => boolean;
  renderCard: (index: number) => ReactNode;
  showCertificateDetail: (certification: string | null) => void;
  setMobileCertificateFlipped: (
    flipped: boolean | ((previous: boolean) => boolean)
  ) => void;
  onTransitionEnd: (event: TransitionEvent<HTMLElement>) => void;
}

export default function MobileCardFaces({
  activeCard,
  nextCard,
  flipPhase,
  rotation,
  flipDuration,
  showSwipeCoachMark,
  activeHomeFace,
  nextHomeFace,
  isCertificateMounted,
  selectedCertification,
  language,
  certificationText,
  cardLabel,
  backLabel,
  isCardMounted,
  renderCard,
  showCertificateDetail,
  setMobileCertificateFlipped,
  onTransitionEnd,
}: MobileCardFacesProps) {
  const isHomeFaceActive = activeCard === 0 && activeHomeFace === 'home';
  const isHomeFaceVisible = isHomeFaceActive || nextCard === 0 || nextHomeFace === 'home';
  const isCertificateFaceActive = activeCard === 0 && activeHomeFace === 'certificate';
  const isCertificateFaceVisible = isCertificateFaceActive || nextHomeFace === 'certificate';
  const isCertificateDetailFaceActive = activeCard === 0 && activeHomeFace === 'certificateDetail';
  const isCertificateDetailFaceVisible =
    isCertificateDetailFaceActive || nextHomeFace === 'certificateDetail';

  return (
    <article
      className={`${styles.cardLayer} ${showSwipeCoachMark && flipPhase === 'idle' ? styles.coachHint : ''} ${flipPhase === 'dragging' ? styles.isDragging : ''} ${flipPhase === 'settlingThrough' ? styles.isFlipping : ''} ${flipPhase === 'returning' ? styles.isReturning : ''}`}
      aria-label={cardLabel}
      onTransitionEnd={onTransitionEnd}
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
                    setMobileCertificateFlipped(true);
                  }}
                >
                  {backLabel}
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
  );
}
