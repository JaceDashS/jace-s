# Next.js 애플리케이션 Dockerfile
FROM node:20-alpine AS base

# 의존성 설치 단계
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package.json package-lock.json* ./
RUN npm ci

# 개발 모드 단계 (빌드 없이 소스 코드만 복사)
FROM base AS builder-dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 개발 모드를 위한 환경변수 설정
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# 개발 모드용 환경 변수 (선택적)
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_ASSETS_URL
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_ASSETS_URL=${NEXT_PUBLIC_ASSETS_URL}

# 소셜 미디어 링크 환경 변수
ARG NEXT_PUBLIC_INSTAGRAM_URL
ENV NEXT_PUBLIC_INSTAGRAM_URL=${NEXT_PUBLIC_INSTAGRAM_URL}

ARG NEXT_PUBLIC_GITHUB_URL
ENV NEXT_PUBLIC_GITHUB_URL=${NEXT_PUBLIC_GITHUB_URL}

ARG NEXT_PUBLIC_EMAIL
ENV NEXT_PUBLIC_EMAIL=${NEXT_PUBLIC_EMAIL}

ARG NEXT_PUBLIC_COMPOSITION_URL
ENV NEXT_PUBLIC_COMPOSITION_URL=${NEXT_PUBLIC_COMPOSITION_URL}

ARG NEXT_PUBLIC_GUITAR_URL
ENV NEXT_PUBLIC_GUITAR_URL=${NEXT_PUBLIC_GUITAR_URL}

# 개발 모드는 빌드 없이 next dev로 실행 (런타임에서 실행)

# 프로덕션 빌드 단계
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 프로덕션 빌드를 위한 환경변수 설정
ARG NODE_ENV=production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 빌드 타임 환경 변수 (NEXT_PUBLIC_*는 빌드 시 번들에 포함됨)
ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}

# 소셜 미디어 링크 환경 변수 (런타임 전용 - ECS Task Definition에서 주입)
# ASSETS_URL, INSTAGRAM_URL, GITHUB_URL, EMAIL은 런타임 전용이므로 빌드 타임에 주입하지 않음
# COMPOSITION_URL, GUITAR_URL도 런타임 전용

# 버전 정보 (빌드 타임에 주입)
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}

# 프로덕션 빌드 실행
RUN npm run build

# 프로덕션 런타임 단계
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 런타임 환경 변수
# ASSETS_URL은 ECS Task Definition에서 런타임에 주입됨 (서버 사이드 전용)
# NEXT_PUBLIC_BASE_URL은 빌드 타임에 이미 번들에 포함됨
ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}

# 버전 정보 (빌드 타임에 주입된 값 유지)
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}

# nginx, supervisor, curl 설치
RUN apk add --no-cache nginx supervisor curl

# Next.js 사용자 생성
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js 빌드 결과물 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# nginx 설정 복사
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Next.js는 3000번 포트로 실행 (non-root 사용자)
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 80

# supervisor 설정 생성 (nginx와 Next.js 동시 실행)
RUN echo '[supervisord]' > /etc/supervisord.conf && \
    echo 'nodaemon=true' >> /etc/supervisord.conf && \
    echo 'user=root' >> /etc/supervisord.conf && \
    echo 'logfile=/var/log/supervisor/supervisord.log' >> /etc/supervisord.conf && \
    echo 'pidfile=/var/run/supervisord.pid' >> /etc/supervisord.conf && \
    echo '' >> /etc/supervisord.conf && \
    echo '[program:nginx]' >> /etc/supervisord.conf && \
    echo 'command=nginx -g "daemon off;"' >> /etc/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisord.conf && \
    echo 'stderr_logfile=/var/log/nginx/error.log' >> /etc/supervisord.conf && \
    echo 'stdout_logfile=/var/log/nginx/access.log' >> /etc/supervisord.conf && \
    echo '' >> /etc/supervisord.conf && \
    echo '[program:nextjs]' >> /etc/supervisord.conf && \
    echo 'command=/usr/local/bin/node server.js' >> /etc/supervisord.conf && \
    echo 'directory=/app' >> /etc/supervisord.conf && \
    echo 'user=nextjs' >> /etc/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisord.conf && \
    echo 'stdout_logfile=/dev/stdout' >> /etc/supervisord.conf && \
    echo 'stdout_logfile_maxbytes=0' >> /etc/supervisord.conf && \
    echo 'stderr_logfile=/dev/stderr' >> /etc/supervisord.conf && \
    echo 'stderr_logfile_maxbytes=0' >> /etc/supervisord.conf && \
    echo 'environment=PORT="3000",HOSTNAME="0.0.0.0",NODE_ENV="production"' >> /etc/supervisord.conf && \
    mkdir -p /var/log/nextjs /var/log/supervisor

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]



