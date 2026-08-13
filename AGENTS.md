# AGENTS.md

## 프로젝트 개요

- Next.js 16 App Router 기반의 개인 포트폴리오 웹 애플리케이션이다.
- React 19와 TypeScript를 사용한다.
- 사용자 화면, API Routes, WebSocket 서버, Oracle DB 연동 기능을 포함한다.
- 데스크톱과 모바일 화면은 동일한 데이터를 사용하되 별도의 레이아웃 컴포넌트로 구성할 수 있다.
- 현재 구현 상태를 문서나 계획보다 우선한다.

## 프로젝트 구조

- `app/`: Next.js App Router 페이지, API Routes, 컴포넌트, 훅, 서비스
- `app/components/`: 화면 컴포넌트
- `app/components/Card/`: 카드 내부 콘텐츠
- `app/components/PhotoGrid/`: 사진 그리드
- `app/hooks/`: React 커스텀 훅
- `app/constants/`: UI 및 애니메이션 상수
- `app/services/`: 애플리케이션 서비스
- `app/utils/`: 공통 유틸리티와 DB 관련 코드
- `app/types/`: 공유 TypeScript 타입
- `public/`: 정적 파일
- `scripts/`: API, WebSocket 및 배포 관련 실행 스크립트
- `server.ts`: Next.js 및 WebSocket을 실행하는 사용자 정의 서버
- `.github/workflows/deploy.yml`: ECS 배포 워크플로

## 코드 작성 규칙

- TypeScript strict 설정을 유지한다.
- 기존 React 함수형 컴포넌트와 훅 패턴을 따른다.
- 클라이언트 API가 필요한 컴포넌트에는 `'use client'`를 사용한다.
- 컴포넌트별 스타일은 기존 CSS Module 패턴을 우선한다.
- 전역 동작에 필요한 스타일만 `app/globals.css`에 작성한다.
- 기존 공개 props와 동작을 가능한 한 유지한다.
- 요청과 관계없는 리팩터링이나 포맷 변경을 하지 않는다.
- 새 추상화는 실제 중복이나 복잡도를 줄일 때만 추가한다.
- `@/*` 경로 별칭과 기존 상대 경로 사용 방식을 해당 파일의 관례에 맞춘다.
- 새 프로덕션 의존성은 사용자 승인 없이 추가하지 않는다.

## 명명 규칙

- React 컴포넌트와 타입은 PascalCase를 사용한다.
- 함수, 변수, 훅은 camelCase를 사용한다.
- 커스텀 훅은 `use`로 시작한다.
- CSS Module 클래스는 기존 파일의 camelCase 방식을 따른다.
- 컴포넌트 파일명은 해당 컴포넌트 이름과 일치시킨다.

## 주석 규칙

- 코드 자체로 명확한 내용은 주석으로 반복하지 않는다.
- 완전한 문장 형태의 설명형 주석은 한국어로 작성한다.
- 기능명, 구역명, 상태명처럼 짧은 명사구 주석은 일본어로 작성한다.
- 코드 식별자, 라이브러리 및 API 명칭은 번역하지 않는다.

## 변경 가능 영역

- 사용자 요청과 직접 관련된 컴포넌트, 스타일, 타입 및 테스트
- 필요한 경우 관련 상수와 훅
- 이번 모바일 카드 전환 작업에서는 다음 파일을 우선 대상으로 한다.
  - `app/components/MobileContent.tsx`
  - `app/components/MobileContent.module.css`

## 변경 금지 및 주의 영역

- `.env.development`, `.env.production`의 내용을 읽거나 출력하거나 커밋하지 않는다.
- 요청 없이 DB, 인증, WebSocket, 배포 설정을 변경하지 않는다.
- 사용자의 기존 미커밋 변경을 삭제하거나 되돌리지 않는다.
- 의존성 변경 없이 `package-lock.json`을 수정하지 않는다.
- 테스트, 린트 또는 타입 검사를 비활성화하지 않는다.
- 프로덕션 배포, 데이터 변경, 브랜치 삭제, 강제 푸시는 명시적 승인 없이 수행하지 않는다.

## 현재 사용자 변경사항

작업 시작 시 다음 미커밋 변경이 존재한다.

- `app/components/MainContent.tsx`
- `app/globals.css`
- `app/utils/db.ts`
- `app/components/MobileContent.tsx`
- `app/components/MobileContent.module.css`

모든 기존 변경을 사용자 소유로 간주하고 보존한다. 특히 모바일 구현은 현재 작업을 기반으로 최소 범위에서 수정한다.

## 설치 및 실행

```sh
npm install
npm run dev
```

기본 개발 서버 주소는 `http://localhost:3000`이다.

Next.js 기본 개발 서버가 필요하면 다음 명령을 사용할 수 있다.

```sh
npm run dev:next
```

## 검증 명령

```sh
npm run lint
npm run type-check
npm run build
```

저장소에 일반적인 단위 테스트 러너는 확인되지 않았다. 기존 통합 스크립트는 다음과 같다.

```sh
npm run test:phase1
npm run test:phase3
npm run test:websocket:prod
```

외부 서비스나 실행 서버가 필요한 테스트는 전제 조건을 확인한 후 실행한다.

## 검증 순서

1. 변경 파일의 ESLint 검사
2. `npm run type-check`
3. `npm run lint`
4. `npm run build`
5. 모바일 사용자 흐름의 수동 또는 브라우저 기반 확인
6. 최종 diff 검토

UI 전환 변경은 최소한 다음을 확인한다.

- 600px 이하 화면에서만 모바일 화면이 노출되는지
- 홈, 앱, 댓글 카드 사이를 모두 이동할 수 있는지
- 전환 도중 카드 앞뒤 면이 잘못 겹치지 않는지
- 빠른 연속 입력으로 상태가 어긋나지 않는지
- 페이지 표시와 현재 카드 이름이 일치하는지
- 키보드 및 접근성 버튼으로 카드 이동이 가능한지
- `prefers-reduced-motion` 사용자를 위한 동작이 제공되는지
- 데스크톱 화면에 회귀가 없는지

## CI 및 배포

- `main` 브랜치 푸시 시 GitHub Actions가 ESLint와 TypeScript 검사를 수행한 뒤 Docker 이미지를 빌드하고 ECS에 배포한다.
- 로컬 구현 작업에서 배포 워크플로를 실행하거나 변경하지 않는다.
- 배포는 사용자의 별도 승인 없이는 수행하지 않는다.

## 커밋 규칙

- 하나의 커밋에는 하나의 논리적 작업만 포함한다.
- 기능 변경과 관계없는 리팩터링을 같은 커밋에 포함하지 않는다.
- 커밋 메시지는 한국어로 작성한다.
- 형식은 다음과 같다.

```text
[type] 작업 요약
- 필요한 보조 설명
```

- 허용 type: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`
- amend, squash, rebase 및 기존 커밋 수정은 명시적 요청 없이 수행하지 않는다.

## 리뷰 규칙

구현과 검증 후 최종 diff에서 다음을 확인한다.

- 모바일 전환 상태와 경계값
- 빠른 반복 입력과 애니메이션 중 입력
- 접근성과 reduced-motion 처리
- 레이아웃 넘침 및 화면 높이 변화
- 데스크톱 동작 회귀
- 불필요한 파일 변경
- 사용자 기존 변경 훼손 여부

## 완료 조건

- 모바일 카드의 슬라이드 전환이 요청한 뒤집기 전환으로 변경된다.
- 홈, 앱, 댓글 콘텐츠가 모두 접근 가능하다.
- 현재 카드 표시와 페이지 버튼이 정상 동작한다.
- 데스크톱 화면의 기존 동작을 유지한다.
- 적용 가능한 린트, 타입 검사 및 빌드가 성공한다.
- 최종 diff에 요청 범위 밖 변경이 없다.
- 실행하지 못한 검증과 남은 위험을 보고한다.

## 사용자 보고 형식

최종 보고는 다음 순서로 작성한다.

1. 결과
2. 변경
3. 검증
4. 리뷰
5. 미확인 사항
