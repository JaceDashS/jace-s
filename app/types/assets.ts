/**
 * 에셋 manifest 타입 정의
 */

export interface AssetItem {
  id: number;
  file: string;
  variant?: 'large' | 'small';
}

export interface AssetSet {
  basePath: string;
  items: AssetItem[];
}

export interface CertificationDocument {
  type: 'pdf' | 'image';
  file: string;
}

export interface CertificationIcon {
  file: string;
}

export interface Certification {
  basePath: string;
  icon: CertificationIcon;
  documents: CertificationDocument[];
}

export interface DataFile {
  basePath: string;
  file: string;
}

export interface AssetsManifest {
  version: number;
  generatedAt: string;
  sets: {
    apps?: AssetSet;
    homePhotos?: AssetSet;
    certifications?: Record<string, Certification>;
    data?: {
      profileOverview?: DataFile;
    };
  };
}

export interface CertificationData {
  key: string;
  iconUrl: string;
  documents: { type: 'pdf' | 'image'; url: string }[];
}

