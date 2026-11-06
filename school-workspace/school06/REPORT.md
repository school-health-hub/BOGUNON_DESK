# SCHOOL-06 완료 보고 — CONDITIONAL

운영 적용 준비 후보를 구현·격리 검증했다. 실제 Hosted Supabase 연결/DDL/Auth/GRANT/RLS/Realtime 변경, 운영 로그인, 실제 사용자·학교 생성, Windows GUI 실행, 통합/main 병합·배포는 하지 않았다.

## 1. 기준 및 작업 브랜치

- 시작/재확인 원격 통합: `243ae95e69483dfbe8d2438c41f858577d748048`.
- SCHOOL-05: `6af60d6a071039a048833f27226f2a3c698fe80c`.
- SCHOOL-04: `8de4dfd8f13f3aeae8173edd7f28c9e8caa8fd8c`.
- 작업: `feature/school-06-hosted-readiness`, 독립 clone. 초기 빈 로컬 preflight branch는 사용하지 않았고 기존 브랜치 수정 없음.
- S05 대 통합은 3/15커밋 분기. Cloud B의 S04/S05 통합 후 Account/Instructor/QA 변경이 존재한다. 통합 완료 여부·Windows PASS는 커밋 제목으로 추정하지 않는다. 최신 통합 소스에서 신규 school06 폴더만 추가했다.
- 최종 Source/원격 SHA·divergence·clean 결과는 ZIP의 `GIT_RECEIPT.json` 및 최종 외부 보고서 참조(커밋 자기참조 방지).

## 2. 인계 자료 검증

SCHOOL-05 ZIP SHA256 `c5be60c01e81e22cb9c6cdaeadd25b65ebf8482398b772eb8561125d42260991`, Manifest649개 파일 모두 일치. 그 안의 A/C/02/03/04 원본 SQL과 현재 통합 소스를 비교하고 원본5개 체크섬을 고정했다. 이전 단계를 다시 덮어씌우지 않았다. 인증 B와 제품 S05는 현재 통합 코드를 재사용·회귀 검증했다. 상세: `reference/previous-handoff-verification.json`, `reference/git-baseline.json`, `reference/source-sql-manifest.json`.

## 3. Migration 설치 순서

preflight(READ-ONLY) → `20261105104546_workspace_foundation.sql` → **별도 Auth 최소권한 가능성/승인 Gate** → `20261105104548_workspace_core.sql`(A→C→02→03→04, 전체 원자적, RPC CLOSED) → 별도 승인된 activation.

각 파일은 명시적 트랜잭션이며 advisory lock으로 설치 직렬화. 순서 오류/이름 충돌/권한 부족/구조 드리프트는 중단. 같은 사양·같은 구조 재실행은 no-op. core 중간 division-by-zero 실패를 실제 주입해 앞 단계 앱 DDL까지 rollback되는 것을 확인했다. foundation은 남겨두어 복구 가능하며 데이터 삭제 rollback은 제공하지 않는다.

## 4. 신규 객체

실제 로컬 카탈로그 기준:

- 역할3: ws_owner/ws_runtime/ws_authz_reader, NOLOGIN/NOBYPASSRLS/비슈퍼.
- 테이블25: Workspace23 + private 설치/공개장부2.
- 공개 RPC39, 내부 함수82(내부 definer60). **모든 신규 함수 고정 빈 search_path**, 공개 wrapper invoker, 신규 내부 함수는 해당 runtime/reader/owner 문맥. 기존20개와 별개다.
- RLS66, FK42. Workspace 테이블 FORCE RLS, runtime/reader 비소유자.
- 학교·멤버십/term·가입/최초 관리자 요청·관리자 이관·역할권한·회수·감사·멱등성, 업무/담당자/이력, 일정/이력, 전달/대상snapshot/수정/읽음 포함.
- 실제 이름·시그니처·소유자·ACL·정책/FK 전체: `evidence/object-inventory.json`.

기존 public 테이블/정책/20개 sentinel 함수 및 Auth 권한 스냅샷 보존을 검사했다. 로컬 sentinel는 운영 함수 이름의 무해한 대역이며 실제 함수 내부 인가 감사가 아니다. 기존 owns_project/receive_medication은 신규 SQL에서 호출하지 않는다. Cloud B Instructor candidate는 별도 기능으로 제외하고 해시만 기록했다.

## 5. 보안·최소권한

인증·현재 계정/멤버십 상태·기간/epoch·학교·역할/개별권한을 실제 RPC/RLS에서 검사. pending/교차학교/지원강사 상승/자기 승인/마지막 관리자 및 동시 강등/직접 테이블/감사 변경/재가입 과거권한/세션회수/동일 request_id payload 충돌/버전 충돌/감사 원자성 부정 테스트 통과.

기본 설치에서는 authenticated조차 새 공개/내부 목적별 RPC를 실행할 수 없다. 별도 activation은 registry39에만 최소EXECUTE를 부여하며 app Production Gate를 열지 않는다. superseded 내부 request_join은 비공개 유지. permissive default function ACL의 예상치 못한 client 부여를 신규 함수에서만 제거한다. 새 테이블과 장부는 원시 접근 불가다.

Auth 최소권한은 **자동 부여하지 않는다**. Auth 소유자 fixture가 허용한4열(id,user_id,created_at,not_after)만 reader가 조회하는 경우 실제 실행 통과. 권한 없음/과도한 열 접근/managed Auth RLS 존재 시 닫힌 실패 정책. 실제 hosted 가능성 NOT VERIFIED이며 불가능하면 core 적용 BLOCKED. 대안은 별도 보안 정책 승인 사항이다.

## 6. 테스트 결과 — 반복 수 합산 안 함

| 분류/스위트 | PASS | FAIL | 범위 |
|---|---:|---:|---|
| 신규 LOCAL DB 설치·재실행·충돌·복구·ACL | 24 | 0 | 실제 PostgreSQL17.6, 빈 DB |
| 신규 LOCAL POSTGREST | 11 | 0 | 실제13.0.4 HTTP/HS256, 합성 Auth 발급자·테이블 |
| 기존 SCHOOL01 권한 불변조건 | 34 | 0 | 실제 DB, S02 directory 합성 fixture adapter |
| 기존 SCHOOL02 | 22 | 0 | LOCAL DB + 일부 MOCK 네트워크/React/jsdom |
| 기존 SCHOOL03 | 21 | 0 | LOCAL DB + 일부 MOCK/React/jsdom |
| 기존 SCHOOL04 | 22 | 0 | LOCAL DB + 일부 MOCK/React/jsdom |
| 기존 Auth adapter | 59 | 0 | MOCK provider/cipher/session store |
| 기존 S05 Gate/Preload/제품 경계 | 12 | 0 | MOCK/jsdom, production 합성 차단·개인 기능 독립 |
| 정적 재생성/보존 검사 | 9 | 0 | STATIC |
| CHROMIUM 새 화면 QA | NOT RUN | — | UI 변경 없음 |
| WINDOWS REAL / HOSTED | NOT RUN | — | 실제 운영/Windows 테스트 없음 |

각 스위트의 실제 실행 수이며 예전 단계 보고의34/36 등과 합산하거나 새 고유 시나리오 수로 확대하지 않는다. 전체 빈 DB 검증을 증거 inventory 추가 후 다시 수행했으며 반복 PASS 수를 중복 합산하지 않았다. JSON과 로그는 evidence에 보존했다.

## 7. Auth·PostgREST 검증 수준

실제 로컬 HTTP로 signed JWT→public invoker→private definer→RLS 경로를 통과했다. 익명/잘못된 서명/만료·private 경로/다른 학교/가짜 runtime role 차단, 멤버십 정지 및 Auth 세션 행 삭제 후 이전 JWT 거부를 확인했다. 일회용 서명키/JWT는 보존하지 않았다.

GoTrue/실제 JWT JWKS·provider/redirect·Hosted gateway/roleGRANT·refresh/logout/운영 auth.sessions 생명주기는 NOT RUN. 역할 전환이나 로컬 JWT 결과를 Hosted PASS로 확대하지 않는다. `AUTH_HOSTED_MATRIX.md`에 계약 및 운영 미검증 사항을 구분했다.

## 8. Feature Gate 및 기존 제품 영향

제품 코드 변경0. 통합 기준의 production 합성 차단, 고정 목적별 Preload, sender/frame/origin, token 비노출, stale response/로그아웃 정리, disconnected/crash 시 개인 화면 독립을 현재 소스로 재검증했다. 신규 DB exposure도 CLOSED. 기존 개인 자료/Inventory/Finance/포털/Native WorkerW 정책 변경 없음. 운영 연결/개인 데이터 동기화 없음.

## 9. 타입·빌드

- Auth strict: PASS.
- Electron Main/Preload/Renderer TypeScript stages: PASS.
- Dashboard Vite: PASS(기존 큰 chunk 경고).
- `npm run build`: FAIL — 기준 SHA와 정확히 같은 기존 타입 오류13개. 신규0, 무관한 제품 수정 없음.
- Workspace 확장 strict 및 전체 Electron build: 환경 의존성 BLOCKED — 캐시에 lock의 xlsx 없음. 공식 CDN HTTP403. 기준 소스에서도 동일하게 재현. 버전 대체/기존 코드 수정하지 않았다.
- `npm run lint`/`npm run typecheck`: 해당 scripts 없음, NOT RUN. 존재하는 build/실제 tsc 명령을 사용했다.
- 로그/비교: `evidence/build-comparison.json`, baseline/후보 build 로그.

## 10. 자율 수정

PL/pgSQL record/alias 충돌1회, 보존 스냅샷 비결정 정렬1회 수정 후 전체 재검증. CLI supported 상태 디렉터리1회 분리. xlsx 공식 다운로드1회 실패 후 환경 제한으로 분리. 보안 정책 완화 없음. 상세 `QA_FIX_LOG.md`.

## 11. Git 및 인계

변경은 `school-workspace/school06/` 한 폴더뿐. 관련 보안/회귀/정적 검사 통과 후 feature 일반 commit/push, 원격 SHA/divergence/clean 재확인. main/integration 병합/강제push 없음. exact Source SHA와 변경파일은 최종 외부 receipt에 저장한다. ZIP은 Git 파일과 byte-identical한 delta + 외부receipt/Manifest/복원 안내로 구성하고 압축 해제 후 모든 SHA256을 검사한다. 기반 source는 exact 통합 SHA에서 복원하며 이전ZIP을 중복 덮어쓰지 않는다.

## 12. 운영 적용 체크리스트/Cloud B

`OPERATIONS.md`: 운영자/대상 프로젝트 확인, 백업·복원 증거, 이름/권한 사전검사, Auth 최소권한 Gate, 단계별 설치검증, 별도 RPC 공개 승인, 데이터 삭제 없는 emergency close, 드리프트 시 closed_unverified 보존, 제품 Gate 승인 조건을 명시했다. 운영에서 어느 절차도 실행하지 않았다.

Cloud B는 새 폴더만 검토해 통합 여부를 결정한다. 통합 기준이 변하면 compare와 영향 검증을 다시 수행하며 자동 덮어쓰기/병합하지 않는다. 실제 Windows 개인 DESK/Workspace 미연결·production 합성 차단/작은 창/암호화/계정학교 전환 검증 필요. Hosted 검증은 별도 ChatGPT READ-ONLY 감사와 명시적 변경·인증 테스트 승인 후 수행한다.

최초 관리자 검증 책임, 신뢰 directory, 보존기간·국외 저장 고지, 백업/복구 SLA 및 Instructor 포함 정책은 NEEDS DECISION. 기존 SECURITY DEFINER 본문 도달성 감사는 NEEDS REVIEW. Managed Auth 최소권한은 NOT VERIFIED이며 현 단계 자동 적용 불가.

**최종 CONDITIONAL: 격리 설치·보안·RPC 준비 후보 검증 완료. 실제 Hosted/Windows/전체 Electron 환경 의존성 및 운영 정책 Gate가 남아 운영 준비 완료 또는 배포 PASS가 아니다.**
