# 외부 서비스 연동

## 목적

Supabase, ChatGPT/OpenAI, BOGUNON, 온라인 보건실, 업무포털과 안전하게 연결하면서 로컬 기능과 인증·데이터 경계를 유지한다.

## 확정 요구사항

- 외부 전송 전에 사용자 승인과 개인정보 경계 적용
- 비밀값을 Git·로그·증거 문서에 기록하지 않음
- 연결 실패가 로컬 데이터 손실이나 무단 재시도를 만들지 않음
- BOGUNON 웹과 DESK의 기능 역할을 구분

## 현재 구현 범위

`origin/main@97f9ee9`에 Supabase auth/client, ChatGPT connection/plan service, browser launcher, BOGUNON·온라인 보건실·업무포털 action registry가 있다. 일부 URL action은 `configured: false`다.

구현 상태: `PARTIAL`.

## QA 상태

`NOT VERIFIED`. 단위 테스트와 개별 기능 QA가 존재하지만 현재 계정·기관 정책·운영 endpoint를 포함한 통합 검증은 확인되지 않았다.

## 아직 구현·확정하지 않은 범위

- 운영별 URL/configuration과 권한
- Inventory Supabase tenancy/RLS 운영 승인
- ChatGPT live failure observability와 데이터 보존 정책의 최종 통합
- ChatGPT 프로젝트/Drive에 Governance 문서를 게시하는 동기화 자동화

## 근거 및 연결 관계

`src/auth/**`, `src/chatgpt/**`, `src/ai/**`, `src/desktop/actionRegistry.ts`, `src-tauri/src/auth.rs`, `browser_launcher.rs`. Official Document, Record Helper, Education Video, Inventory가 이 경계를 소비한다.

## 위험 및 다음 작업

각 integration에 data classification, consent, timeout/retry, redaction, credential recreation, offline behavior를 문서화한다. 운영 DB와 외부 서비스 변경은 별도 사용자 승인을 받는다.
