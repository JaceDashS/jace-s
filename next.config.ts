import type { NextConfig } from "next";
import path from "path";

type NextConfigWithTurbopack = NextConfig & {
  turbopack?: {
    root?: string;
  };
};

const nextConfig: NextConfigWithTurbopack = {
  // Docker standalone 빌드를 위한 설정
  output: "standalone",

  // 프로젝트가 독립적으로 작동하도록 설정
  // Turbopack 프로젝트 루트를 명시하여 상위 워크스페이스 간섭 방지
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
