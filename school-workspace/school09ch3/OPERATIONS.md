# 운영 전 조건 — 적용 명령이 아닌 승인 준비

## 새로 해소한 기술 의존성

- Auth schema CREATE, supabase_auth_admin SET/함수 OWNER 위임 요구 없음.
- Workspace 전용 역할에 Auth USAGE·SELECT·REFERENCES를 부여하는 요구 없음.
- A2 raw SELECT를 먼저 부여했다가 회수하는 순서 없음.
- 별도 foundation을 수동 설치한 후 연결하는 대신 fresh 전체 설치를 한 transaction으로 검증.

## 남은 Hosted 확인

04-hosted-readonly.sql을 승인된 ChatGPT READ-ONLY 경로에서 검토한다. 비밀번호·키·세션 UUID·실제 행을 요청하지 않는다.

1. 실제 postgres에 기존 Auth USAGE, sessions4열 SELECT, auth.uid/jwt EXECUTE, users.id REFERENCES가 있는가.
2. Workspace schema 생성/역할 생성·SET·public CREATE 위임이 가능한가. Auth owner SET/CREATE는 필요 없으며 없어야 한다.
3. Workspace의 FK 생성 및 새 테이블 소유권 이관에 추가 Managed 제약이 있는가.
4. Data API는 public만 노출하며 비공개 Auth/Workspace/bootstrap schema를 노출하지 않는가.
5. JWT claims JSON과 실제 auth.uid/jwt의 식별 의미가 일치하는가. OAuth redirect/provider·JWKS·refresh·logout/회수는 어떠한가.

카탈로그 SELECT는 실제 설치 성공 증거가 아니다. SQL 제한 guard는 school01a/isolated이며 운영에 그대로 적용할 수 없다.
추정으로 guard를 제거하지 않는다. 정확한 운영 후보 Source SHA/SQL을 검토한 후 별도 승인한다.

## 승인 후에만 준비할 설치·복구 절차

- 유효한 백업과 복구 연습, 기존 public RLS232/함수20 등 **최신** 상태/충돌 확인.
- 정확한 SQL 해시·역할권한·테이블 FK와 설치 신원 확인. 기존 Workspace가 있으면 fresh 후보는 중단.
- 설치는 하나의 transaction, ON_ERROR_STOP, 모든 기본 EXECUTE 제거도 commit 전에 완료.
- 실패 시 rollback, CLOSED 유지, 원인 검토 후 동일 후보 재실행. 임의 IF NOT EXISTS나 광범위 GRANT로 기존 개체를 채택하지 않는다.
- 성공 후 실제 signature54·최소권한·RLS·Auth 객체 불변·개인 데이터 불변을 비파괴 점검.
- 운영 활성화/최초 관리자 등록은 별도 승인. 이 후보의 QA 활성화 스크립트를 운영 활성화로 사용하지 않는다.
- 중단은 새 RPC 실행권한 회수와 Feature Gate CLOSED 우선. 업무 데이터/역할/스키마 자동 DROP·TRUNCATE는 하지 않는다.
- metadata drift는 활성화/재설치 거부다. 원인 불명 지문을 정상값으로 다시 저장하지 않는다.
- Hosted 실계정 시험은 별도 동의·합성 학교 정책·기간·기록/정리 계획과 승인 후 수행.

실제 Hosted 로그인/세션 회수·Data API 검증 전 운영 적용 BLOCKED를 유지한다.
main/통합 병합·Cloud B Windows QA·운영 배포는 이 작업의 권한이 아니다.
