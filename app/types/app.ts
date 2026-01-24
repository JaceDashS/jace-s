/**
 * App 타입 정의
 */
export interface App {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  apkUrl: string | null;
  installerUrl: string | null;
  portableUrl: string | null;
  webUrl: string | null;
  demoUrl: string | null;
  githubUrl: string | null;
  displayOrder: number;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}

