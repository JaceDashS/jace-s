import { useEffect, useState } from 'react';
import type { Language } from '../types/mainContent';

export function useMainContentLanguage() {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const browserLang =
        navigator.language ||
        (navigator as Navigator & { userLanguage?: string }).userLanguage ||
        'en';
      const langCode = browserLang.toLowerCase().split('-')[0];

      if (langCode === 'ko' || langCode === 'ja' || langCode === 'zh') {
        setLanguage(langCode);
      } else {
        setLanguage('en');
      }
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  return { language, setLanguage };
}
