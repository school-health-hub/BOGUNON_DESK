# SCHOOL 관리자 이관 MFA 서버 후보

`closed-candidate.sql`은 D0 CLOSED 뒤에 별도로 검토하는 후보입니다. Core 54개와 Instructor 2개 원본, D0 객체와 릴리스 지문, H1 관리자 이관 Gate를 그대로 사용합니다. 설치 자체로 클라이언트 권한이 열리지 않습니다.

## 증거 경계

1. `begin_intent`가 사용자·현재 세션·학교·요청 종류·대상·변경 방식 또는 버전을 2분짜리 서버 요청 ID에 묶습니다.
2. 향후 신뢰 서버가 같은 사용자와 세션을 검증한 뒤 Supabase Auth에 새 TOTP 챌린지를 생성해야 합니다. 요청이 만들어진 뒤 챌린지를 생성하고, 정확한 챌린지 ID를 `bind_factor`로 등록한 다음에만 검증을 호출합니다.
3. 신뢰 서버가 동일 챌린지의 성공 응답을 직접 받고, 검증된 토큰의 발급자·사용자·세션을 대조한 뒤에만 `attest_factor`를 호출할 수 있습니다. 브라우저나 Electron이 제공하는 성공 표시, 기존 AAL2 또는 JWT의 `iat`만으로 이 역할을 대신할 수 없습니다. 실제 Supabase 연결은 미구현입니다.
4. `execute_intent`는 현재 학교 및 멤버십과 이관 수락자의 보건교사 역할, 해당 요청을 보낸 관리자의 유효 권한을 다시 확인합니다. 증거를 닫고 기존 이관 함수를 같은 트랜잭션에서 호출합니다. 실패하면 둘 다 롤백됩니다. 기존 이관 함수의 10분 세션 조건은 별도 조건으로 계속 적용됩니다.

`ws_admin_mfa_verifier`는 NOLOGIN이며 연결용 계정이나 역할 멤버십을 설치하지 않습니다. [Supabase MFA Verification Hook](https://supabase.com/docs/guides/auth/auth-hooks/mfa-verification-hook)의 문서화된 입력에는 세션·챌린지 ID가 없어 이 증거 역할에 연결하지 않습니다.

## 활성화 의존성

운영 후보는 실제 Auth 검증 응답의 동일 세션·챌린지 귀속을 지원하는 신뢰 서버를 검증한 뒤에만 연결할 수 있습니다. 이후 별도 승인으로 새 함수 호출 권한과 클라이언트 연결을 설계해야 합니다. 요청 JWT는 검증된 API 게이트웨이에서만 전달하고 사용자에게 DB 역할 접속 권한을 부여하지 않습니다. 기존 공개·내부 이관 RPC의 클라이언트 EXECUTE는 그 활성화에서도 CLOSED로 남겨야 합니다. 54개 전부에 EXECUTE를 부여하는 기존 로컬 시험용 활성화와 병용하면 안 됩니다. 후보는 기존 이관 함수의 일반 클라이언트 EXECUTE를 발견하면 새 요청과 실행을 거부합니다. MFA 실패 및 UI의 학교 전환·취소 시에는 `cancel_intent`를 호출해야 합니다. 다른 학교의 새 요청은 같은 세션의 이전 요청을 닫습니다.

기존 D0 및 Instructor 설치 순서에는 이 후보가 포함되지 않습니다. 54+2 CLOSED 설치나 일반 Workspace Gate를 여는 근거로 사용할 수 없습니다.

## 집중 검증

`qa.mjs`는 `BOGUNON_MFA_PG_BIN`에 지정한 PostgreSQL 17의 실행 파일을 사용하고 `BOGUNON_MFA_QA_TEMP` 아래에 독립된 루프백 DB를 생성합니다. `node school-workspace/admin-mfa/qa.mjs`로 실행합니다. 합성 Auth와 합성 검증 역할만 사용합니다. 실제 Google·Supabase MFA와 Electron은 이 실행 범위에 포함되지 않습니다.
