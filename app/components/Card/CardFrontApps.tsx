import type { Dispatch, SetStateAction } from 'react';
import { PROJECTS_PER_PAGE } from '../../constants/gridConstants';
import type { Language } from '../../types/mainContent';
import type { App } from '../../types/app';
import AppItem from './AppItem';
import styles from './CardFront.module.css';

interface CardFrontAppsProps {
  appsFade: number;
  scrollProgress: number;
  apps: App[];
  currentProjectPage: number;
  setCurrentProjectPage: Dispatch<SetStateAction<number>>;
  language: Language;
  appsTitle: string;
  compactTypography: boolean;
  buttonFontSize: string;
  iconSize: string;
  smallButtonPadding: { px: number; py: number };
  expandedAppId: number | null;
  setExpandedAppId: Dispatch<SetStateAction<number | null>>;
}

const closeAppModalText: Record<Language, string> = {
  en: 'Close',
  ko: '닫기',
  ja: '閉じる',
  zh: '关闭',
};

const paginationText: Record<Language, { previous: string; next: string }> = {
  en: { previous: 'Previous', next: 'Next' },
  ko: { previous: '이전', next: '다음' },
  ja: { previous: '前へ', next: '次へ' },
  zh: { previous: '上一页', next: '下一页' },
};

export default function CardFrontApps({
  appsFade,
  scrollProgress,
  apps,
  currentProjectPage,
  setCurrentProjectPage,
  language,
  appsTitle,
  compactTypography,
  buttonFontSize,
  iconSize,
  smallButtonPadding,
  expandedAppId,
  setExpandedAppId,
}: CardFrontAppsProps) {
  const pageCount = Math.max(1, Math.ceil(apps.length / PROJECTS_PER_PAGE));

  return (
    <div
      className={styles.appsContainer}
      style={{
        opacity: appsFade,
        pointerEvents: scrollProgress >= 1 && scrollProgress < 2 ? 'auto' : 'none',
      }}
    >
      <h2 className={styles.sectionTitle}>{appsTitle}</h2>
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
            {currentProjectPage} / {pageCount}
          </span>
          <button
            onClick={() => setCurrentProjectPage((prev) => Math.min(pageCount, prev + 1))}
            disabled={currentProjectPage >= pageCount || apps.length <= PROJECTS_PER_PAGE}
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
  );
}
