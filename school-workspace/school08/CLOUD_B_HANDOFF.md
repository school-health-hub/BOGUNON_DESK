# Cloud B — SCHOOL08 최종 Windows 후보 인계

## 보존할 완료 결과

`integration/school-05-account-02b-qa`의 `142c2d9bcf0f2831e10191de30e9d640fb2d83e5`, Actions [41978328480](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41978328480) success/head SHA를 GitHub에서 READ-ONLY 확인했다. 메타데이터 조회 시 portable/evidence artifact2개가 expired=false였다. binary를 내려받아 덮어쓰거나 workflow를 재실행하지 않았다.

공동 업무/일정/인수인계 GUI·DPAPI·로그아웃·재실행·기존 기능·종료/잔여 프로세스 PASS는 **그 SHA의 역사적 결과**로 보존한다. 상세 시나리오 PASS는 사용자 인계 자료이며 이번 Cloud C에서 재실행한 결과가 아니다. S07/S08 SHA로 자동 승계하지 않는다. 기존 통합을 다시 복원/덮어쓰지 않는다.

## Source 및 계보

부모 S07 `282b6bcd905584bd0504f65d297133a3d563611d`는 역사 통합142c2d9보다8커밋 앞서며 조상 관계 확인. S06 eca3ef6은 S07보다4커밋 전. 최신 Electron 통합은243ae95. 최종 Source SHA·최종 원격 HEAD/left-right/ancestry는 GIT_RECEIPT와 외부 최종 보고서 참조. Cloud C는 FF 가능해도 integration/main을 병합하지 않는다.

## 이번 후보의 직접 변경

- `school-workspace/school07/ui/InventoryWorkspace.tsx`: `s.item` optional access2곳. S07 TS18048 오류 수정. 수량/역할 의미 변경 없음. 실제 Windows에서 상세 선택/학교전환/로딩 중 예외·버튼 상태를 확인한다.
- `school-workspace/school08/supabase/migrations/*_cumulative_workspace.sql`: S06 core+S07 Inventory 원자적 조합. 신규 사업 함수/권한 없음. private release/RPC 장부2개만 추가. Windows PostgreSQL17 fixture 설치·UTF8 입력·순서/재실행/차단·재공개를 검증한다.
- `school-workspace/school08/sql/install-candidate.sql`: frozen foundation 반복 함정을 피하는 누적 entry. Auth capability 외부 Gate 유지.
- `school-workspace/school08/sql/activate-local.sql`, `close-local.sql`: 정확히54개 purpose chain 전체를 공개/차단. production UI Gate와 별개다.

## S07 이후 Windows에서 새로 확인할 범위

다음은 S07에 이미 존재하지만 역사 Windows142c2d9에는 없거나 달라진 경계다. S08에서 덮어쓰지 않았다.

| 파일/모듈 | Windows 추가 QA 이유 |
|---|---|
| electron-p0/main/workspace-product.ts | inventory dispatch, sender/frame/origin, account/school generation, 종료 cleanup |
| electron-p0/preload/preload.cts / workspace-protocol.ts | inventory 고정11 메서드, 범용 RPC/SQL/HTTP 없음, token 없음 |
| school05/server/provider.ts / school07/server/session.ts | Main 세션으로 재고 RPC, 로그아웃·학교전환 시 모든 module invalidate |
| school04/ui/IntegratedWorkspace.tsx / school05/ui/* | 새 물품 탭, 기존 업무·일정·인수인계·구성원 연결 |
| school07/core/* / ui/* | 물품/lot/입고/사용/조정/폐기/이력, 만료·부족, 비활성 물품, stale response |
| school06 / school07 SQL + school08 cumulative | 역할/스키마/Auth 최소권한/54 RPC CLOSED 설치 및 새버전 lifecycle |
| 기존 개인 Inventory 및 Dashboard/Dock | 공동 재고 때문에 개인 파일/암호화/백업/저장계약/개인 업무가 바뀌지 않았는지 |

추가 Windows 항목: isolated QA profile/합성 데이터만 사용, 980×700/900×680, teacher/admin/assistant/pending, 만료/정지, 로그인 없이 개인 기능, 재고 저장 실패, 학교A/B 전환과 늦은 응답, 세션 만료/로그아웃·재실행, 신규 Source SHA의 실행/종료 및 잔여 프로세스. 기존 EXE/실제 profile을 덮어쓰지 않고 Native WorkerW 제외 유지.

## 누적 설치

기존 Windows QA fixture 경로를 그대로 운영 migration으로 해석하지 않는다. 빈 `school01a` PostgreSQL17 격리 DB의 합성 auth_fixture/bootstrap → S08 foundation → 승인된 **합성** Auth 최소권한 fixture → cumulative app →54 CLOSED 확인 → local activation 순서다. `sql/install-candidate.sql`는 최초/반복 entry이며 parent 역할·Auth prerequisite가 없으면 중단한다. 상세 README/OPERATIONS 참조. S08 설치 후 부모 S06/07 frozen scripts를 직접 재실행하지 않는다.

기존 S06/07 데이터 DB를 자동 adoption하지 않는다. 별도 업그레이드 검토 전 fresh fixture DB를 사용한다. 데이터 삭제 rollback이나 CASCADE DROP을 실행하지 않는다.

## 검증 범위 구분

Cloud C: LOCAL PG17 / LOCAL POSTGREST13 / 실제 Main handler를 mock IPC로 호출 / Chromium 실제 P0 renderer+모의 Preload→BFF. Windows GUI·DPAPI·운영 Auth/PostgREST는 NOT RUN. 캡처를 Windows PASS로 쓰지 않는다.

## 남은 Gate

1. root build 기준 동일13 오류. S07 재고 nullable1은 수정 완료.
2. full Electron의 locked xlsx 미설치/공식 CDN403. 버전 바꾸거나 external 처리로 숨기지 않았다. 승인된 Windows 환경에서 lock 의존성 설치 후 전체 build/package 검증 필요.
3. `electron-p0/tests/finance-provenance.test.ts`의 실제7 리소스 vs 고정6 기대값1 실패가 S07 기준에서도 동일. 새 개인 기능 회귀로 보지 않되 전체 회귀 PASS로 숨기지 않는다. builder/Finance 권한·패키징 변경은 별도 검토.
4. 142c2d9 이후 상속된 Instructor 소스/리소스 변경도 존재한다(reference/git-lineage.json). S08 핵심 누적 DB에는 `instructors/sql/candidate.sql`를 포함하지 않는다. 전체 Source를 통합할 때 이 상속 범위도 별도로 판단하며 역사 Windows PASS로 덮지 않는다.
5. Hosted Auth/provider/redirect/JWT/세션 회수/PostgREST/Managed auth.sessions 최소권한 및 기존 SD19 함수 도달성 감사 미완료. 운영 권한/로그인/배포는 별도 승인.

운영 DB/학교/사용자 데이터, 실제 Auth 설정은 건드리지 않았다. production Workspace Gate는 기본 비활성이고 합성 기능은 격리 QA 전용이다. 운영 준비 완료/Portable PASS 인계가 아니라 Windows 추가 검증을 위한 CONDITIONAL 후보다.
