import { useEffect, useState } from 'react';

export interface CardFrontLinks {
  instagramUrl: string;
  githubUrl: string;
  email: string;
  compositionUrl: string;
  guitarUrl: string;
}

function getBuildTimeLinks(): CardFrontLinks {
  return {
    instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || '',
    githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL || '',
    email: process.env.NEXT_PUBLIC_EMAIL || '',
    compositionUrl: process.env.NEXT_PUBLIC_COMPOSITION_URL || '',
    guitarUrl: process.env.NEXT_PUBLIC_GUITAR_URL || '',
  };
}

export function useCardFrontLinks(): CardFrontLinks {
  const [links, setLinks] = useState<CardFrontLinks>(getBuildTimeLinks);

  useEffect(() => {
    let cancelled = false;

    async function loadRuntimeLinks() {
      try {
        const response = await fetch('/api/config', {
          cache: 'no-store',
        });

        if (!response.ok || cancelled) {
          return;
        }

        const config = await response.json() as Partial<CardFrontLinks>;
        setLinks({
          instagramUrl: config.instagramUrl || '',
          githubUrl: config.githubUrl || '',
          email: config.email || '',
          compositionUrl: config.compositionUrl || '',
          guitarUrl: config.guitarUrl || '',
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('[CardFront] Failed to fetch config:', error);
        setLinks(getBuildTimeLinks());
      }
    }

    loadRuntimeLinks();

    return () => {
      cancelled = true;
    };
  }, []);

  return links;
}
