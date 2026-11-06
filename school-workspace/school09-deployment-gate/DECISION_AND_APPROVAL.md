# SCHOOL-09 最終 배포 게이트 및 CLOSED 설치 승인 요청서

2026-11-06 KST. **CONDITIONAL GO — 정확히 고정된 후보의 CLOSED 설치에만 해당한다.**
이번 문서는 승인 요청이며 실제 운영 설치·권한 변경·활성화는 수행하지 않았다.

## 판정 근거

- 원격 통합 HEAD `838cc0b1a7dc50129aebda75cf18b73386ed9bf7` 일치. 문서 전용 후보는 이 통합 SHA에서 파생된 사전점검 브랜치에 작성했다. 제품과 SQL 변경 없음.
- [GitHub Actions 42147372547](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/42147372547): 같은 SHA, push, completed/success. school09-impact job 성공. SQL 불변 해시, Windows native PostgreSQL17 설치/데이터 보존 복구, 역사적 Portable 해시, Windows DPAPI/재실행/정리 단계 성공을 API로 확인했다.
- portable-gui/integration/account-configured-portable job은 skipped이므로 새 전체 Portable 빌드 PASS로 주장하지 않는다. Windows GUI PASS는 기존 인계 증거로 보존한다. 이번에 테스트/Actions를 재실행하지 않았다.
- Actions artifact 13470548036은 만료되지 않았으나 이 환경의 artifact 다운로드는 외부 blob 접근403으로 실패했다. artifact 내부 원문을 새로 확인했다고 주장하지 않는다. API의 run/job/step 증거와 기존 저장소 증거를 사용했다.
- D0 기존 결과: LOCAL PostgreSQL17.6 30 PASS, LOCAL PostgREST15 PASS, MOCK1 PASS, FAIL0. H3 등 재사용 증거는 신규 수로 합산하지 않았다. 기존 Windows·LOCAL·복원 시험 반복 없음.
- 사용자 인계: 운영 백업3종 PASS, SHA-256 PASS, public64개 선별 격리 복원 PASS. 이는 사용자 제공 완료 증거로 수용한다. 실제 백업 파일/원문 개인정보는 열거나 패키지에 넣지 않았다. 전체 관리형 Supabase 복원은 미검증이다.
- Hosted 읽기 전용 검사: PostgreSQL17.6, public 일반 테이블64/RLS232/definer20. public 함수 기준선 해시 `7d9f5da2c5f8bbe21c0b2c616cdbdce5`는 직전 사전점검과 동일하다. 행 데이터 불변까지 이 해시가 증명하는 것은 아니다.
- workspace/workspace_private/workspace_auth_bridge/workspace_bootstrap, 예정 ws_역할, public ws_함수/관계/타입 충돌 없음. 기존 Auth users/sessions는 supabase_auth_admin 소유/RLS 유지. 세션4열 SELECT, auth.uid/jwt EXECUTE, users.id REFERENCES, DB CREATE/public CREATE grant option/CREATEROLE은 현재 설치 신원에 존재한다. Auth CREATE/소유자 SET ROLE은 불가로 유지된다.

## 고정 SQL — SHA-256

기준 경로: `school-workspace/school09d0/`. 파일은 원본 바이트 그대로 사용하며 CRLF 변환도 금지한다.

| 파일 | SHA-256 |
|---|---|
| `sql/00-hosted-preflight-select.sql` | `be541aaa486d4dae5074a721e069898abe7216d74fb1642534588b9fc381e426` |
| `sql/01-install-closed-candidate.sql` | `bb18855935e71646343312b83c3d77428eb56ae235419220c01b4aa2b08dedac` |
| `sql/02-postflight-select.sql` | `db2a72022e8fc8d74efc0222fb41e3f92ba5db6dc6427038efd5a260c157e290` |
| `sql/03-emergency-close.sql` | `35c9cc7517d6f86dc4ab0a46a848dbc8d8dddd95c8847082bf8e14ba688b580c` |

정상 순서: `00` READ-ONLY → 승인된 `01` 단일 트랜잭션 CLOSED 설치 → `02` READ-ONLY 사후 검사. `03`은 조건부 긴급 차단 전용이며 정상 설치 순서에 포함하지 않는다. 이전 migration 누적 실행, A2 Auth 생성, raw Auth GRANT, 로컬 activation/fixture는 제외한다.

## 운영 변경 승인 요청 범위 — 아직 미승인

대상은 **BogunOn `xxownwxxajzrviuvvfiu`, Sydney, database postgres 하나**다. BAERURI는 조회/변경/시험 대상이 아니다. 추가 프로젝트·유료 플랜 없음.

요청하는 변경은 `01`에 명시된 Workspace 전용 schema/role/table/index/FK/RLS/private function/Auth bridge 및 공개54 wrapper 생성과 해당 신규 객체에 대한 소유권·GRANT/REVOKE뿐이다. 새 역할 체인과 installer 권한은 고정 SQL에 있는 범위로 한정한다. Workspace bridge는 기존 postgres의 Auth 읽기 권한을 사용하며 Workspace 역할에 Auth 원문 SELECT를 부여하지 않는다. 기존 public 테이블·Auth 스키마 객체·기존20 함수·Auth/provider 설정은 변경 대상이 아니다.

설치 신원 postgres의 BYPASSRLS 예외는 제한된 private boolean2개에 남는다. 실제 Hosted owner/FK/SECURITY DEFINER 실행은 아직 미실행이므로 권한 메타데이터를 설치 성공으로 간주하지 않는다. PUBLIC/anon/authenticated 및 creator default ACL의 노출은 같은 트랜잭션의 최종 hardening에서 제거해야 한다.

**CLOSED 의미:** public54 및 대응 private54의 외부 실행 차단, 원시 테이블 미공개, 최초 관리자 bootstrap 별도 CLOSED, 제품 Feature Gate 비활성. 함수 소유자/신뢰된 내부 역할까지 제거한다는 뜻은 아니다. 설치 단계가 잠시 부여하는 권한을 외부 세션에 노출하지 않도록 파일을 분할/auto-commit하지 않는다.

설치 승인은 기능 활성화, 테스트 계정 생성, OAuth 설정, 로그인 시험, 관리자 부여, 학교 directory 운영 데이터 입력을 포함하지 않는다. 이 패키지에는 운영 활성화 SQL이 없으며 추후 제한된 시험용 allowlist와 서버 인가/내부 호출 권한을 별도 검토해야 한다.

## 설치 전 반드시 채울 승인 영수증

- [ ] 승인자·실행자·감시자·복구 담당자, 유지보수 시작/종료 및 중단 연락 경로
- [ ] 백업3종의 식별자·시점·해시·보관 위치·접근 담당자 기록. 원문/비밀은 이 문서/Git에 첨부하지 않음
- [ ] 선별 복원 성공 범위(public64)와 미검증 범위(Managed Auth 전체/플랫폼 설정/암호화 키 의존)를 승인자가 인지
- [ ] 허용 손실시점(RPO)·중단시간(RTO)와 전체 복구를 보장할 수 없다는 제약 수용
- [ ] 위 Source SHA·4해시·project ref를 승인서에 명시. 실행 직전00/endpoint 다시 대조, drift/충돌이면 승인 자동 보류
- [ ] 정확한01 CLOSED 설치 승인 및 아래 조건의03 긴급 차단 사전 승인. 전체 데이터 복원/파괴적 삭제 권한은 제외

이 조건을 충족하기 전 실행하지 않는다. 이 승인표가 생성됐다는 이유만으로 승인 완료 처리하지 않는다.

## 중단·긴급 차단·복구

1. endpoint/신원/해시/객체/선행권한 불일치, Auth CREATE 요구, 예기치 않은 GRANT 요구 시 설치 전 중단. 자동 프로젝트 대체/권한 확대 금지.
2. 하나의 direct 또는 session-pooler 세션, ON_ERROR_STOP=1, 파일 자체 BEGIN/COMMIT 유지. 임의 트랜잭션 경계 추가나 문장별 실행 금지. marker는 endpoint나 승인 대체물이 아니다.
3. COMMIT 이전 실패는 즉시 ROLLBACK/세션 종료, 카탈로그 기준선 대조. COMMIT 결과 불명이면 먼저 READ-ONLY release/객체 상태 확인 후 처리한다.
4. COMMIT 후 postflight에서 54 정확한 서명·공개/내부 ACL·owner·RLS·FK·bridge/bootstrap 차단·기존 public 기준선 검증. 단순 개수 일치만으로 성공 처리하지 않는다. 실패 시 Gate CLOSED 유지.
5. 비정상 EXECUTE 노출 또는 Workspace 오류 시 별도 사전 승인된03으로 canonical54쌍을 차단하고 closed_unverified 기록. 신뢰한 비BYPASS 함수 소유자·역할 SET 조건이 맞지 않으면03도 중단하고 운영자에게 인계. postgres 소유 전환으로 우회하지 않는다.
6.03은 데이터 삭제가 없고 Auth 원본 SELECT가 사라져도 실행 가능한 설계다. bootstrap 명령/운영자 권한은 별도 경로로 처음부터 CLOSED여야 한다. 진행 중 트랜잭션·이미 열린 클라이언트 메모리까지 회수하는 기능은 아니므로 새 진입 차단과 진행 요청 종료를 별도로 관리한다. 실제 Hosted03 실행은 NOT RUN이다.
7. 임의 DROP/TRUNCATE/전체 rollback restore 금지. 설치 후 데이터 손상은 비파괴 차단·증거 보존 후 별도 복구 승인. 전체 백업 복원은 이후 정상 쓰기까지 잃을 수 있으며 public64 선별 복원 성공은 Auth/플랫폼 전체 복구 보증이 아니다. Managed 객체 전체 복구가 필수인 상황은 현재 복구 능력 밖으로 분리한다.

## 기능 활성화 전 별도 게이트

- 실제 Hosted owner/FK/54 CLOSED 설치·사후 ACL 결과, Data API 노출 범위·캐시, private schema 비노출 검증
- 실제 OAuth/redirect/PKCE·Web 세션 저장소·로그아웃/세션 회수/현재 멤버십 재검사: NOT RUN
- 기존20 definer 내부 인가 및 신규 영역 간접 도달성의 추가 검토(문자열 검사만으로 안전 단정 금지)
- 최초 관리자 검증 책임자, 독립 승인자2인·대상자 자기 승인 배제, 증빙 최소수집·보존/삭제, 학교 기록/감사/백업 보존·퇴직/이관·국외 저장 고지 결정
- 제한 시험 신원·기간·기능·정리 및 최소 RPC allowlist 승인 후 시험, 결과 검토 후 별도 Feature Gate 활성화 승인

정책 미결정은 bootstrap/사용자 접근을 계속 닫아두는 조건이며 이번 CONDITIONAL GO를 서비스 활성화 승인으로 확대하지 않는다.

## 요청 문구

“BogunOn `xxownwxxajzrviuvvfiu`에 한해, 통합 SHA `838cc0b1a7dc50129aebda75cf18b73386ed9bf7`에서 고정한 위4개 SQL 해시 중00/02 읽기 전용 검사와01 CLOSED 설치를 승인한다. 승인 영수증의 담당자·백업·복구 제약·유지보수 창을 확인했으며, 정의된 이상 시03 긴급 차단만 허용한다. 기능 활성화·Auth 변경·계정 생성·실제 로그인 시험·전체 복원·파괴적 삭제는 별도 승인 대상으로 남긴다.”

**현재 이 승인 문구는 초안이며 승인되지 않았다. 설치/활성화 실행0건. 최종 CONDITIONAL GO.**
