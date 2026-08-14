'use client';

import type { Language } from '../types/mainContent';
import styles from './ShortViewportScreen.module.css';

interface ShortViewportScreenProps {
  language: Language;
}

const shortViewportCopy: Record<Language, {
  title: string;
  description: string;
  hint: string;
}> = {
  en: {
    title: 'A taller window is required',
    description: 'Increase the window height to continue.',
    hint: 'Minimum height: 500px',
  },
  ko: {
    title: '화면 높이를 늘려 주세요',
    description: '계속하려면 창의 세로 높이를 500px 이상으로 늘려 주세요.',
    hint: '최소 높이: 500px',
  },
  ja: {
    title: 'ウィンドウの高さが必要です',
    description: '続行するにはウィンドウの高さを増やしてください。',
    hint: '最小の高さ: 500px',
  },
  zh: {
    title: '需要更高的窗口',
    description: '请增加窗口高度以继续。',
    hint: '最小高度：500px',
  },
};

export default function ShortViewportScreen({ language }: ShortViewportScreenProps) {
  const copy = shortViewportCopy[language];

  return (
    <main className={styles.screen} role="status" aria-live="polite">
      <div className={styles.panel}>
        <span className={styles.eyebrow}>JACE-S</span>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.description}>{copy.description}</p>
        <span className={styles.hint}>{copy.hint}</span>
      </div>
    </main>
  );
}
