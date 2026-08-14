import { useCallback, useState } from 'react';
import type { MouseEvent } from 'react';

interface UseCardFrontEmailContactOptions {
  email: string;
}

export function useCardFrontEmailContact({ email }: UseCardFrontEmailContactOptions) {
  const [emailCopied, setEmailCopied] = useState(false);

  const handleEmailClick = useCallback(async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    try {
      await navigator.clipboard.writeText(email);
      setEmailCopied(true);

      window.setTimeout(() => {
        setEmailCopied(false);
      }, 2000);

      const subject = encodeURIComponent('Contact from jace-s.com');
      const body = encodeURIComponent('Hello,\n\n');
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    } catch {
      const subject = encodeURIComponent('Contact from jace-s.com');
      const body = encodeURIComponent('Hello,\n\n');
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    }
  }, [email]);

  return { emailCopied, handleEmailClick };
}
