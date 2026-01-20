This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

이 프로젝트는 독립적으로 작동하도록 설계되었습니다. `jace-s` 폴더를 어디로 옮겨도 정상적으로 작동합니다.

### 독립 실행 전제 조건

1. **프로젝트 루트에서 실행**: 반드시 `jace-s` 폴더(또는 `package.json`이 있는 디렉토리)에서 명령어를 실행해야 합니다.
2. **node_modules 설치**: 프로젝트 루트에 `node_modules`가 있어야 합니다.

### 문제 해결 (모듈 해석 오류 발생 시)

다음과 같은 오류가 발생하면:
```
Error: Can't resolve 'tailwindcss' in 'C:\dev\workspace'
```

다음 단계를 시도하세요:

```bash
# Windows
npm run clean
npm install
npm run dev

# Linux/Mac
npm run clean:unix
npm install
npm run dev
```

### 환경 변수 설정

먼저 환경 변수 파일을 생성해야 합니다:

1. `.env.development` - 개발 환경용
2. `.env.production` - 프로덕션 환경용 (Docker 빌드 시 사용)

자세한 내용은 `env.example.md` 파일을 참고하세요.

### 로컬 개발 서버 실행

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Docker 사용

Dockerfile 하나로 프로덕션과 개발 빌드를 모두 관리합니다.

### 프로덕션 빌드 및 실행

```bash
# 빌드 + 실행 한 번에
npm run docker:build:run:prod

# 또는 단계별로
npm run docker:build:prod  # 이미지 빌드
npm run docker:run:prod    # 컨테이너 실행
```

### 개발 빌드 및 실행

```bash
# 빌드 + 실행 한 번에
npm run docker:build:run:dev

# 또는 단계별로
npm run docker:build:dev  # 이미지 빌드
npm run docker:run:dev    # 컨테이너 실행
```

### 컨테이너 관리

```bash
# 컨테이너 중지
npm run docker:stop:prod  # 프로덕션
npm run docker:stop:dev   # 개발

# 컨테이너 제거
npm run docker:rm:prod    # 프로덕션
npm run docker:rm:dev     # 개발

# 중지 + 제거 한 번에
npm run docker:clean:prod # 프로덕션
npm run docker:clean:dev  # 개발
```

## 환경 변수

- `.env.development` - 개발 환경 변수
- `.env.production` - 프로덕션 환경 변수 (npm docker:build 시 자동 사용)
- `env.example.md` - 환경 변수 설정 가이드

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
