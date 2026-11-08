# SCHOOL 관리자 이관 MFA 서버 후보

`closed-candidate.sql`은 D0 CLOSED 뒤에 별도로 검토하는 후보입니다. Core 54개와 Instructor 2개 원본, D0 객체와 릴리스 지문, H1 관리자 이관 Gate를 그대로 사용합니다. 설치 자체로 클라이언트 권한이 열리지 않습니다.

## 증거 경계

1. `begin_intent`가 사용자·현재 세션·학교·요청 종류·대상·변경 방식 또는 버전을 2분짜리 서버 요청 ID에 묶습니다.
2. 향후 신뢰 서버가 같은 사용자와 세션을 검증한 뒤 Supabase Auth에 새 TOTP 챌린지를 생성해야 합니다. 요청이 만들어진 뒤 챌린지를 생성하고, 정확한 챌린지 ID를 `bind_factor`로 등록한 다음에만 검증을 호출합니다.
3. 신뢰 서버가 동일 챌린지의 성공 응답을 직접 받고, 검증된 토큰의 발급자·사용자·세션을 대조한 뒤에만 `attest_factor`를 호출할 수 있습니다. 브라우저나 Electron이 제공하는 성공 표시, 기존 AAL2 또는 JWT의 `iat`만으로 이 역할을 대신할 수 없습니다. `supabase-adapters.ts`가 이 서버 측 Auth 연결 경계를 구현합니다.
4. `execute_intent`는 현재 학교 및 멤버십과 이관 수락자의 보건교사 역할, 해당 요청을 보낸 관리자의 유효 권한을 다시 확인합니다. 증거를 닫고 기존 이관 함수를 같은 트랜잭션에서 호출합니다. 실패하면 둘 다 롤백됩니다. 기존 이관 함수의 10분 세션 조건은 별도 조건으로 계속 적용됩니다.

`ws_admin_mfa_verifier`는 NOLOGIN이며 연결용 계정이나 역할 멤버십을 설치하지 않습니다. [Supabase MFA Verification Hook](https://supabase.com/docs/guides/auth/auth-hooks/mfa-verification-hook)의 문서화된 입력에는 세션·챌린지 ID가 없어 이 증거 역할에 연결하지 않습니다.

## 활성화 의존성

운영 후보는 실제 Auth 검증 응답의 동일 세션·챌린지 귀속을 지원하는 신뢰 서버를 검증한 뒤에만 연결할 수 있습니다. 요청 JWT는 검증된 API 게이트웨이에서만 전달하고 사용자에게 DB 역할 접속 권한을 부여하지 않습니다. 기존 공개·내부 이관 RPC의 클라이언트 EXECUTE는 그 활성화에서도 CLOSED로 남겨야 합니다. 54개 전부에 EXECUTE를 부여하는 기존 로컬 시험용 활성화와 병용하면 안 됩니다. 후보는 기존 이관 함수의 일반 클라이언트 EXECUTE를 발견하면 새 요청과 실행을 거부합니다. MFA 실패 및 UI의 학교 전환·취소 시에는 `cancel_intent`를 호출해야 합니다. 다른 학교의 새 요청은 같은 세션의 이전 요청을 닫습니다.

기존 D0 및 Instructor 설치 순서에는 이 후보가 포함되지 않습니다. 54+2 CLOSED 설치나 일반 Workspace Gate를 여는 근거로 사용할 수 없습니다.

## 신뢰 서버 계약 후보

`trusted-server.ts`는 실제 네트워크·DB 자격증명을 포함하지 않는 닫힌 오케스트레이션 계약입니다. 요청과 공급자 응답을 런타임 파싱하고 다음 순서를 고정합니다.

1. 서버가 원래 access token의 서명·issuer·audience·만료와 live `session_id`를 검증합니다.
2. 같은 access token과 factor ID로 Supabase Auth challenge를 생성합니다.
3. 반환된 challenge ID를 사용자·세션·factor와 함께 `bind_factor` 어댑터에 전달합니다.
4. 같은 access token·factor ID·challenge ID로만 verify를 호출합니다.
5. verify가 반환한 새 access token을 다시 검증하고 `sub`와 `session_id`가 원본과 같으며 `aal2`인지 확인합니다.
6. 모두 일치할 때만 같은 증거를 `attest_factor`에 전달합니다. verify 또는 토큰 대조가 실패하면 사용자 세션으로 `cancel_intent`를 호출하는 reject 어댑터가 증거를 닫아야 합니다.

토큰 검증 어댑터는 단순 JWT decode가 아니라 Supabase Auth `getClaims`의 서명 검증, `getUser`의 현재 사용자 검증과 민감 작업용 live `auth.sessions` 확인을 모두 요구합니다. `trusted-server.ts`가 issuer·audience·만료·AAL과 검증 전후 `sub`·`session_id` 일치를 추가로 고정합니다. proof 어댑터는 상시 `postgres` 또는 `service_role` 호출로 대체하지 않습니다.

## 실제 서버 연결 모듈

- `trusted-http.ts`는 `POST /trusted-mfa/v1/verify`와 `POST /trusted-mfa/v1/cancel` 경계를 제공합니다. access token은 `Authorization: Bearer`로만 받고, 엄격한 JSON 크기·스키마 검사와 동일 프로세스의 중복 intent 억제를 적용합니다.
- `supabase-adapters.ts`는 공식 Auth challenge/verify 경로를 같은 사용자 access token으로 호출합니다. 반환된 새 토큰은 서명된 claims, Auth 사용자, live session을 다시 확인한 뒤에만 증거를 승인합니다.
- `SqlIntentProofStore`는 `bind_factor`와 `attest_factor`를 검증자 전용 실행 경계로 호출하고, 실패·취소는 원래 사용자 JWT 범위의 `cancel_intent`로 분리합니다. 모든 SQL 값은 매개변수로 전달합니다.
- `trusted-runtime.ts`는 위 어댑터를 하나의 HTTP handler로 조합합니다. `trusted-client.ts`는 기존 관리자 UI가 verify/cancel을 호출할 수 있는 최소 클라이언트 인터페이스이며 DB 권한이나 비밀키를 포함하지 않습니다.

운영 활성화에는 아직 서버 전용 배포 위치와 secret 보관, `ws_admin_mfa_verifier` NOLOGIN 역할을 대신해 제한된 함수만 실행하는 전용 로그인/멤버십, live `auth.sessions`를 최소 권한으로 확인하는 실행 경계, 사용자 JWT claims를 설정해 `cancel_intent`를 호출하는 DB 구현이 필요합니다. 다중 서버의 중복 요청은 DB의 open-intent 제약과 bind/attest 조건이 최종 권위이며 메모리 gate만 신뢰하면 안 됩니다. 이 조건과 실제 Supabase 격리 연결 검증 전까지 일반 Workspace Gate는 CLOSED입니다.

## 집중 검증

`qa.mjs`는 `BOGUNON_MFA_PG_BIN`에 지정한 PostgreSQL 17의 실행 파일을 사용하고 `BOGUNON_MFA_QA_TEMP` 아래에 독립된 루프백 DB를 생성합니다. `node school-workspace/admin-mfa/qa.mjs`로 실행합니다. 합성 Auth와 합성 검증 역할만 사용합니다. 실제 Google·Supabase MFA와 Electron은 이 실행 범위에 포함되지 않습니다.

`npx vitest run school-workspace/admin-mfa/trusted-server.test.ts`는 동일 세션·factor·challenge 순서, AAL2 재검증, 실패 시 reject 및 입력 경계 파싱을 합성 어댑터로 검증합니다. `npx tsc -p school-workspace/admin-mfa/tsconfig.json`은 이 계약만 독립적으로 타입 검사합니다.

새 서버 연결의 합성 집중 검증은 `npx vitest run school-workspace/admin-mfa/trusted-http.test.ts school-workspace/admin-mfa/supabase-adapters.test.ts`로 실행합니다. 위조 HTTP 요청, 중복 intent, 취소 실패, 오래된 챌린지, 토큰 사용자·세션 불일치와 매개변수화된 DB 경계를 실제 운영 계정 없이 확인합니다.
