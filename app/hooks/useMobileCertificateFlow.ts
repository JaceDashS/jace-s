import { useState } from 'react';
import type { HomeFace } from './useMobileCardGesture';

interface UseMobileCertificateFlowOptions {
  activeHomeFace: HomeFace;
  flipHomeFace: (target: HomeFace) => void;
}

export interface MobileCertificateFlow {
  selectedCertification: string | null;
  setMobileCertificateFlipped: (
    flipped: boolean | ((previous: boolean) => boolean)
  ) => void;
  showCertificateDetail: (certification: string | null) => void;
}

export function useMobileCertificateFlow({
  activeHomeFace,
  flipHomeFace,
}: UseMobileCertificateFlowOptions): MobileCertificateFlow {
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

  return {
    selectedCertification,
    setMobileCertificateFlipped,
    showCertificateDetail,
  };
}
