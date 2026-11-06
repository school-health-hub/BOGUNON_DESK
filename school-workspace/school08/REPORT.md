# SCHOOL-08 최종 안정화·Cloud B 인계 — CONDITIONAL

## 1. 최신 통합 SHA

원격 재확인: integration/school-05-account-02b-qa `142c2d9bcf0f2831e10191de30e9d640fb2d83e5`, integration/electron-feature-baseline `243ae95e69483dfbe8d2438c41f858577d748048`. 제공 값과 동일했다. 기존 통합을 다시 수행/덮어쓰기하지 않았다.

## 2. SCHOOL07 기준

feature/school-07-shared-inventory `282b6bcd905584bd0504f65d297133a3d563611d`. S06 eca3ef6 원격도 그대로다. 이전 ZIP06/07 Manifest66/100개 SHA256 검증, 파일 단위로 S06 SQL·S05 제품 연결이 S07에 포함됨을 확인했다. 원본 브랜치 및 이전 인계 패키지 불변.

## 3. SCHOOL08 Source

독립 worktree / feature/school-08-stabilization. 새 기능 개발이 아니라 누적 설치/lifecycle/통합 검증과 재고 nullable 타입 오류 수정만 수행했다. 최종 SHA/원격 영수증은 커밋 자기참조를 피하기 위해 외부 GIT_RECEIPT와 최종 첨부 보고서에 기록한다.

## 4. Git 계보·FF

시작 시 역사142c2d9→S07 left/right0/8, S06→S07 0/4 확인. 두 통합 HEAD 모두 후보 부모의 조상이다. 최종 원격 HEAD/계보·FF 가능성은 최종 receipt에 재확인한다. FF 가능해도 Cloud C는 병합하지 않는다. 142c2d9 이후 상속된 Instructor 변경도 파일 목록에 포함해 인계했다.

## 5. 누적 migration

frozen foundation → 외부 Auth 최소권한 Gate → atomic S06 core+S07 Inventory →54 CLOSED → 별도 QA activation. CLI로 생성한 cumulative migration, 전체 entry·close·지문 검증 스크립트를 구현했다. 기존 부모 파일/장부를 덮어쓰지 않고 누적 S08 private 장부2개가 lifecycle을 관리한다. 신규 사업 테이블/권한 의미 변경 없음.

빈 PostgreSQL17 설치·순서·CLOSED/ACTIVE 재실행·전체 entry 재실행·동시 설치·이름/권한 선행조건·후반 실패 전체 rollback·기존 public metadata/개인 fixture 보존·정상 차단/재공개·드리프트/긴급 차단 검증. 기존 S06/07 앱 DB 자동 adoption은 거부하고 데이터 삭제/덮어쓰기를 하지 않는다. Hosted 적용 파일로 확정하지 않는다.

## 6. 전체 기능 연동

동일 합성 학교/계정으로 검색→가입→관리자 승인/구성원 정지, 교사 업무 생성·지원강사 배정/진행/완료, 일정 생성·수정, 전달 대상 작성·본인 읽음·교사 완료, 재고 입고·본인 사용·교사 조정/폐기·임박/부족을 실제 Main handler/전용 IPC 형태로 연결했다. 다른 학교 전환 시 task/activity/inventory가 모두 B 컨텍스트이며 지연A 응답은 폐기된다. 세션 만료/로그아웃/회수 후 공동 상태 정리. 개인 업무·일정·재고 자동 동기화 없음.

## 7. RLS/RPC 보안

| 실행 분류 | PASS | FAIL |
|---|---:|---:|
| S08 누적 설치/권한/lifecycle LOCAL DB | 20 | 0 |
| S07 실제 도메인 보안 재사용 LOCAL DB | 31 | 0 |
| LOCAL POSTGREST 실제 HTTP, 합성 HS256/Auth | 7 | 0 |
| 실제 Main/모의 IPC/합성 Auth + LOCAL DB 전체 흐름 | 3 | 0 |
| 기존 SCHOOL01 권한 불변조건 LOCAL DB | 34 | 0 |
| SCHOOL02 DB+일부 MOCK/jsdom 회귀 | 22 | 0 |
| SCHOOL03 DB+일부 MOCK/jsdom 회귀 | 21 | 0 |
| SCHOOL04 DB+일부 MOCK/jsdom 회귀 | 22 | 0 |
| 기존 Main/Preload/production 경계 MOCK/jsdom | 12 | 0 |

반복 실행 수를 새 고유 시나리오 수로 합산하지 않는다. 스위트 간 겹치는 동작을 총합의 독립 시나리오로 주장하지 않는다.

역할·학교 격리/pending·회수/마지막 관리자·담당자·캘린더 상한·본인 ack·재고 음수/만료/동시성·멱등성/version·audit rollback을 검사했다.54 public invoker/private purpose chain만 authenticated 실행 가능, 그 외 private helper는 거부, 역할3 NOBYPASSRLS/NOLOGIN, 모든 Workspace 테이블 FORCE RLS/비소유 runtime 확인. 기존 함수19 경고는 수정/재사용하지 않았다. Hosted 보안 감사가 아니다.

## 8. Electron/Web

Chromium21 PASS: 실제 P0 renderer980×700/900×680(Preload MOCK→local BFF), Web390/320, 교사 업무/일정/전달 등록, 모바일 지원강사 업무 완료·일정 읽기·전달 읽음, 교사 처리 완료, 재고 등록/입고/사용·실패 안내·계정/학교 정리·Origin/CSRF. 전체 Windows GUI를 다시 만든 것이 아니다. 실제 WINDOWS REAL/HOSTED는 NOT RUN.

## 9. 기존 Windows PASS 보존

GitHub Actions41978328480 status=completed/conclusion=success/head142c2d9를 직접 조회했다. portable/evidence artifact2개도 조회 시 expired=false. DPAPI/로그아웃/재실행/업무·일정·인수인계 GUI/기존 기능/종료 PASS는 사용자 인계 및 해당 SHA의 역사적 증거로 보존한다. 새 S08 SHA로 승계하지 않고 workflow/Windows/Portable을 재실행하지 않았다.

## 10. 신규 Windows QA 범위

재고 UI/11개 Preload/dispatch·세션 경계/수량·유효기간/전체 모듈 학교 전환/새 SQL설치/개인 Inventory 불변/새Source 실행·종료. 직접 수정한 nullable guard와 S06/07 상속 경계를 파일 단위 CLOUD_B_HANDOFF에 명시했다. 기존 완료 Windows 통합을 다시 수행하는 지시가 아니다. 상속 Instructor 및 Finance 리소스 기대값 문제는 별도 검토 대상으로 남겼다.

## 11. 빌드·의존성 및 회귀 제한

- 재고 strict, 새 flow strict, Main/Preload/Renderer/test types, BFF/Web/P0 Renderer build PASS.
- root build: 동일 S07 기준과 똑같은13 오류, 신규0.
- S07 재고 TS18048 별도1건 실제 재현 후 수정. 이전 strict PASS를 자동 승계하지 않고 정정했다. 넓은 Workspace strict는9→8로 개선, 남은8은 xlsx 부재 진단.
- full Electron: locked xlsx 미설치/공식 CDN403으로 BLOCKED. 부분 빌드를 전체 package PASS로 표시하지 않았다. 버전/네트워크 정책 우회 없음.
- Cargo/rustc1.99.1은 설치되어 있었으며 기본 PATH/HOME 설정 문제였다. command-scoped CARGO_HOME/RUSTUP_HOME으로 확인. Rust 변경 없어 native/Tauri는 NOT RUN.
- npm lint/typecheck script 없음(NOT RUN), 실제 tsc와 존재하는 build 명령 실행.
- 개인 도구 선택 회귀75 PASS /1 기존 FAIL. Finance extraResources6 기대 vs 실제7 검사가 S07 baseline에서도 동일 실패. 처음 renderer boundary 파일 부재는 실제 renderer build 후 해결했다. 이 실패를 숨겨 전체 회귀 PASS라고 하지 않는다.
- 개인 Inventory/Dashboard/Dock69, Auth59 등 동일 S07 코드의 기존 증거는 source hash를 근거로 REFERENCED, 새 테스트 수로 합산하지 않는다. 전체 src/개인 저장·Auth/Main/Preload 코드 불변을 정적 비교한다.

## 12. 자율 수정

ThreadPool 이름 충돌1회, 본인 컨테이너 alias fixture 참조1회, nullable 타입1회, frozen 부모 반복 실행을 누적 entry로 안정화1회, 실제 renderer artifact 생성1회. 동일 결함3회 초과 없음. 정책/RLS 완화·service_role 우회·개인 기능 삭제/대규모 재작성 없음. 상세 QA_FIX_LOG 참조.

## 13. Git 보존

관련 새 SQL/통합/보안/UI 검사 통과, 새 회귀0 확인 후 feature commit/일반 push. 원격 SHA/divergence0/0/clean을 최종 확인한다. main/integration/기존06·07 브랜치 변경, merge/rebase/reset/강제push/운영배포 없음.

## 14. Cloud B 패키지

새 누적 SQL·entry/lifecycle·flow/보안 테스트·실행 로그·화면·기준 비교·역사 Windows metadata·변경 파일·상대경로 복원법·SHA256 Manifest·검증기를 ZIP에 포함. Git의 실제 Source와 파일 관계는 receipt로 명시. exact S07 부모 위의 delta로 복원하며 기존 통합 소스를 중복 복원하지 않는다. 비밀키/실세션/실제 학교 학생 데이터 없음.

## 15. 운영 Supabase 미검증

프로젝트 xxownwxxajzrviuvvfiu의 DB/Auth/RLS/RPC/Realtime 및 운영 계정/학교를 변경·생성·호출하지 않았다. Managed auth.sessions 최소권한/역할·소유권·PostgREST·OAuth redirect/provider/실 JWT refresh·회수·기존 SD 함수 영향은 NOT VERIFIED/NOT RUN. 법적 고지·보존·최초관리자·복구 정책의 기존 미결정도 유지. 실제 적용/인증 테스트/제품 Gate는 별도 사용자 승인 필요.

## 16. 최종 판정

**CONDITIONAL** — 로컬 누적 설치와 전체 Workspace 연동·보안 안정화 후보를 완성했다. 기존 Windows PASS는 보존하고 새 Source의 Windows/Hosted는 미검증으로 분리했다. full build 환경 및 baseline Finance 검사1건이 남아 운영 준비 완료·전체 release PASS가 아니다. Cloud B가 정확한 새 Source로 추가 Windows QA를 진행할 수 있는 인계 후보이다.
