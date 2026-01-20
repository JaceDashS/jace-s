#!/usr/bin/env node

/**
 * .env 파일을 읽어서 docker build 명령어에 --build-arg로 자동 전달하는 스크립트
 * 사용법: node scripts/docker-build-with-env.mjs <env-file> <docker-args...>
 * 
 * 관례: .env 파일의 NEXT_PUBLIC_* 변수와 NODE_ENV를 자동으로 --build-arg로 전달
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const envFile = process.argv[2];
const dockerArgs = process.argv.slice(3);

if (!envFile) {
  console.error('사용법: node scripts/docker-build-with-env.mjs <env-file> <docker-args...>');
  console.error('예: node scripts/docker-build-with-env.mjs .env.production --target runner -t jace-s:latest .');
  process.exit(1);
}

// package.json에서 버전 읽기
const packageJsonPath = path.resolve(process.cwd(), 'package.json');
let appVersion = 'unknown';
if (fs.existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    appVersion = packageJson.version || 'unknown';
  } catch (error) {
    console.warn('⚠️  package.json을 읽을 수 없습니다. 버전 정보를 사용할 수 없습니다.', error);
  }
}

// .env 파일 읽기
const envPath = path.resolve(process.cwd(), envFile);
if (!fs.existsSync(envPath)) {
  console.error(`에러: ${envFile} 파일을 찾을 수 없습니다.`);
  console.error(`       ${envFile}.template 파일을 복사하여 생성하세요.`);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

// .env 파일 파싱 (주석, 빈 줄 무시)
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  
  // 주석 무시 (#으로 시작)
  if (trimmed.startsWith('#')) {
    return;
  }
  
  // 빈 줄 무시
  if (!trimmed) {
    return;
  }
  
  // KEY=VALUE 형식 파싱
  const match = trimmed.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    
    // 값이 비어있으면 스킵 (주석 처리된 변수)
    if (!value) {
      return;
    }
    
    // 따옴표 제거
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    envVars[key] = value;
  }
});

// 빌드 타임에 필요한 환경 변수만 추출
const buildArgs = [];

// NODE_ENV (필수)
if (envVars.NODE_ENV) {
  buildArgs.push(`--build-arg NODE_ENV=${envVars.NODE_ENV}`);
} else {
  // 기본값 설정
  if (envFile.includes('production')) {
    buildArgs.push('--build-arg NODE_ENV=production');
  } else if (envFile.includes('development')) {
    buildArgs.push('--build-arg NODE_ENV=development');
  }
}

// APP_VERSION (package.json에서 읽은 버전)
buildArgs.push(`--build-arg APP_VERSION="${appVersion}"`);

// NEXT_PUBLIC_* 변수들 (빌드 타임에 필요)
Object.entries(envVars).forEach(([key, value]) => {
  if (key.startsWith('NEXT_PUBLIC_') && value) {
    // 값에 공백이나 특수문자가 있을 수 있으므로 따옴표로 감싸기
    const escapedValue = value.replace(/"/g, '\\"');
    buildArgs.push(`--build-arg ${key}="${escapedValue}"`);
  }
});

if (buildArgs.length === 0) {
  console.warn('⚠️  경고: .env 파일에서 빌드 타임 환경 변수를 찾을 수 없습니다.');
}

// Docker 빌드 명령어 조립
const buildCommand = `docker build ${buildArgs.join(' ')} ${dockerArgs.join(' ')}`;

console.log(`📦 .env 파일에서 환경 변수 로드: ${envFile}`);
console.log(`🔧 빌드 타임 환경 변수 (${buildArgs.length}개):`);
buildArgs.forEach(arg => {
  const match = arg.match(/--build-arg ([^=]+)=/);
  if (match) {
    console.log(`   - ${match[1]}`);
  }
});
console.log(`\n🚀 실행 명령어:\n${buildCommand}\n`);

try {
  execSync(buildCommand, { stdio: 'inherit' });
  console.log('\n✅ 빌드 완료!');
} catch (error) {
  console.error('\n❌ 빌드 실패!', error);
  process.exit(error?.status || 1);
}

