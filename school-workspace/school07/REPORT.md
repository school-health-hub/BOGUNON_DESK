# SCHOOL-07 완료 보고 — CONDITIONAL

## 1. 기준 SHA·브랜치

- 원격 통합 재확인: `243ae95e69483dfbe8d2438c41f858577d748048`.
- 부모 SCHOOL06: `eca3ef6bcb62bd2a78526e4c12a02e8db5f381c6`, 통합 대비1/0.
- SCHOOL05 기존 출처: `6af60d6a071039a048833f27226f2a3c698fe80c`. 해당 브랜치와 통합의 동일성/Windows QA 완료를 가정하지 않았다.
- 독립 `feature/school-07-shared-inventory`. 통합/main/기존 feature를 수정·병합·rebase/reset하지 않았다.
- 최종 Source SHA·원격·divergence·clean은 ZIP의 GIT_RECEIPT 및 외부 최종 보고서 참조. 보고서 자체 SHA 순환을 피하기 위해 커밋 후 영수증으로 제공한다.

## 2. SCHOOL06 호환·보존

기존 ZIP SHA256 `34c1eec8d7e8d24239d8e0b2e98d14c89bcf865340161bf809b7ee6c1f511287`, 66개 Manifest 전부 검증. SCHOOL06 폴더 전체 byte 불변. 부모 foundation/Auth fixture/core에서 빈 DB 설치 후 S07 child 확장을 적용했다. 원본 기본39 CLOSED, S07 기본15 CLOSED 확인.

부모 장부를 덮어쓰지 않는 child release 장부를 추가했다. 최초 부모 지문 일치·child checksum/전체 구조 지문·재실행 no-op·공개 전 재검증·정상 close/reopen·드리프트 거부를 실제 실행했다. 새 public15 wrapper도 지문/ACL 범위에 포함한다.

확장 후 원본 frozen SCHOOL06 core 재실행은 의도적으로 거부한다. child 설치 순서를 사용해야 하며 Hosted 적용에는 별도 승인된 누적 release/관리형 권한 검토가 필요하다. S07 migration/activation은 **local-only**다. Hosted 설치 호환성을 확정하지 않는다.

## 3. 신규 DB·RLS·RPC

신규 사업 테이블4: shared_inventory_items / shared_inventory_lots / shared_inventory_movements / shared_inventory_locations. private 설치 장부1. 학교 복합FK, 생성/수정 membership epoch, 양수 version, 서버 request_id·감사 계약. 위치에도 작성/수정 멤버 epoch를 기록한다.

새 RLS12(사업11+장부1), 새 함수35(private20/public15), private definer16(목적별15+authz permission1), 전부 고정 빈 search_path. 공개는 invoker, 내부 실행은 NOLOGIN/NOBYPASSRLS 비소유 ws_runtime/authz_reader. raw 테이블·내부 dispatch·장부 접근 금지. Auth GRANT/기존 public 개인 테이블/기존 SECURITY DEFINER20 변경 없음.

공개 목적별15:

- list_inventory_items / get_inventory_item / create_inventory_item / edit_inventory_item / list_inventory_lots
- receive/use/adjust/dispose_inventory
- list_inventory_movements / list_inventory_alerts
- list_inventory_locations / save_inventory_location
- get_inventory_context / set_inventory_lot_state

실제 이름은 ws_v1_ 접두사와 `sql/rpc-contracts.json`/`core/signature.ts` 참조. 동일 JSON payload DTO를 Main/BFF transport에서 고정 계약으로 검증하며 범용 IPC/RPC 실행은 제공하지 않는다. 객체 전체 목록은 evidence/object-inventory.json.

## 4. 물품·lot·거래

등록/편집·분류·최소 수량·보관 위치 등록/이름 변경. lot별 유효기간/입고일/수량/사용 가능 상태. 물품 전체 보유/사용 가능/임박/만료/사용 불가 수량, 부족 표시. 입고/사용/조정/폐기는 새 거래로 남기고 기존 거래 UPDATE/DELETE 권한 없음. 사용 가능 상태 변경은 STATE 거래(delta0)로 기록한다.

수량은 소수3자리/0~10억, 음수 차감 불가. 새 lot는 version0, 기존 변경은 lot version, 물품/위치는 각각의 version. 학교 advisory lock+lot FOR UPDATE로 같은 lot 동시 거래를 직렬화한다. 부모 잠금 규칙을 보존해 학교 단위 직렬화가 MVP 처리량 상한이다. 같은 request_id·payload 재사용은 한 번만 반영, 다른 payload/학교/명령은 거부. 거래·receipt·audit는 단일 트랜잭션이며 audit 실패 주입 시 모두 rollback됨을 확인했다.

## 5. 유효기간·부족 계산

Asia/Seoul 오늘 기준. 유효기간 당일까지 사용 가능, 어제 만료. 오늘/30일 inclusive, 31일 제외. 서버 상수 계층 s07_soon_days=30, 학교별 실제 설정은 후속 범위. 유효기간 없음/정상/임박/만료 구분, FEFO 표시(null 뒤). 만료/UNUSABLE 사용은 서버에서도 거부. 폐기/자동 차감 없음. 부족=사용 가능<최소 수량. 단위가 다른 수량을 합산하지 않고 요약은 종수, 각 카드/lot는 실제 수량을 표시한다.

목록500/이력 최근100 상한. MVP UI 검색/분류·알림 필터는 로드된 목록 기준으로 동작하며 큰 재고의 서버 pagination/search 연결은 후속 개선 사항이다.

## 6. 역할별 권한

Admin/Teacher 관리·입고·사용·조정·폐기. Assistant 기본 재고 조회·현재 epoch 본인 거래 이력만, inventory.receive/use 명시 allow+own scope일 때 본인 거래만. deny 우선. 관리/조정/폐기 allow를 넣어도 Assistant 상한은 유지된다. A학교 교사 권한이 B학교 지원강사 권한을 덮어쓰지 않는다. pending·정지·만료·학교/계정 회수 시 매 요청 재인가. 개별 permission 관리 UI/운영 부여 RPC는 새로 만들지 않았고 합성 fixture만 사용했다. 실제 승인된 부여 절차 전에는 지원강사 쓰기 기본 비활성이다.

## 7. 보안·동시성·멱등성 검증

| 스위트/분류 | PASS | FAIL | 한계 |
|---|---:|---:|---|
| 신규 수량·권한 LOCAL DB | 36 | 0 | 실제 PG17.6, 합성 사용자/학교 |
| 신규 설치/권한 상한/close/드리프트 LOCAL DB | 9 | 0 | 새 public wrapper 드리프트도 거부 |
| LOCAL POSTGREST | 7 | 0 | 실제13.0.4 HTTP, 합성 HS256/Auth |
| 신규 상태·UI·IPC | 6 | 0 | LOCAL DB+React/jsdom1, MOCK5 |
| Chromium 제품/BFF 화면 | 15 | 0 | Preload/Auth MOCK, 실제 local DB/BFF |
| 기존 SCHOOL01 불변조건 | 34 | 0 | LOCAL DB |
| 기존 SCHOOL02 | 22 | 0 | LOCAL DB + 일부 MOCK/jsdom |
| 기존 SCHOOL03 | 21 | 0 | LOCAL DB + 일부 MOCK/jsdom |
| 기존 SCHOOL04 | 22 | 0 | LOCAL DB + 일부 MOCK/jsdom |
| 기존 Auth | 59 | 0 | MOCK provider/cipher |
| 기존 제품 경계 | 12 | 0 | MOCK/jsdom, 고정 Preload 검사 포함 |
| 개인 Inventory/Dashboard/Dock 선택 회귀 | 69 | 0 | Node/jsdom, Windows 아님 |
| 정적 생성/원본 보호 | 9 | 0 | 개인 소스15개 byte 동일 |
| WINDOWS REAL / HOSTED SUPABASE | NOT RUN | — | 실제 연결/배포 없음 |

중복 실행은 새 고유 시나리오 수에 합산하지 않는다. 각 스위트는 서로 겹치는 동작을 포함할 수 있어 총합을 고유 업무 시나리오 수로 주장하지 않는다. 마지막 위치 epoch FK 및 비활성 물품 가용량 보강 후 영향받는 새 SQL/상태/UI 테스트를 재실행했으며 기존 기능 SQL/권한 규칙의 무관한 수정은 없다.

## 8. Electron/Web 화면

기존 Dashboard/Dock에서 우리 보건실 → 공동 물품관리. 개인 화면은 교체하지 않았다. 고정 Preload11 메서드와 Main sender/frame/origin 검증 유지. Main 세션 소유, Renderer에는 인증 토큰 반환 없음. 학교/계정 변경·로그아웃 generation/abort 정리. 서버 성공/재조회 후 확정 표시, 네트워크 실패 시 기존 수량을 낙관적으로 바꾸거나 성공으로 표시하지 않는다. 디스크 cache/offline queue 없음.

980×700/900×680 실제 P0 renderer를 Chromium에서 실행해 물품 탭/개인 Dashboard 복귀 확인(Preload MOCK→local BFF). Web390/320px 화면 및48px 터치 대상·가로 넘침·브라우저 오류 검사. 스크린샷6개 포함. Windows Electron GUI는 NOT RUN이다.

## 9. 개인 Inventory 불변

개인 Inventory 관련 소스15개 byte hash 비교, 개인 Inventory/Dashboard/Dock 선택 회귀69 PASS. 개인 저장 경로·형식·암호화·백업·UI·자동 업로드 코드 변경 없음. 개인 파일을 탐색하거나 실제 사용자 자료를 읽어 테스트하지 않았다. 테스트 로컬 데이터만 사용했다. 변경된 공통 Preload는 별도 Workspace API 추가 부분이며 개인 Inventory IPC는 그대로다.

## 10. 기존 기능 회귀

앞 표의 SCHOOL01/02/03/04, Auth/제품 경계 및 개인 Inventory·Dashboard/Dock 선택 회귀를 실제 실행했다. 회귀별 LOCAL DB/MOCK 구분과 실행 로그를 보존했다. 과거 단계의 PASS 수를 새 테스트 수로 합산하지 않았다.

## 11. 타입·빌드

신규 S07 strict, Electron Main/Preload/Renderer/test 타입, BFF 서버/Web/P0 Renderer 빌드 PASS. 루트 npm run build는 최신 통합 기준에서 동일 재현되는 기존 타입 오류13개로 FAIL, 신규0. 전체 Electron 및 Instructor 포함 넓은 strict는 cache의 locked xlsx 부재/공식 CDN403으로 환경 BLOCKED. 기준에서도 같은 실패. 부분 빌드를 전체 Electron PASS로 확대하지 않았다. lint/typecheck script는 없어서 NOT RUN, 실제 tsc 명령을 실행했다. 기준/후보 로그 및 build-comparison.json 참조.

## 12. 자율 수정

기본값 seed의 owner FORCE RLS, 지원강사 물품 행 잠금, fixture actor 식별, CSS 선언, 실제 DB UI 대기시간, 새 Preload 목록, REST 다중 멤버 fixture, child public wrapper 지문 범위를 최소 수정했다. 각 결함의 실질적 수정1회, 보안 약화 없음. QA_FIX_LOG.md 및 예비 실패 로그 보존. 기존13 오류/네트워크403은 별도 환경·기준 문제로 분리했다.

## 13. Git commit/push

관련 새 기능·회귀·부정 검사 통과 후 전용 feature commit/일반 push. 원격 SHA·divergence·clean 확인. 변경 파일은 부모 대비 전용 폴더 및 Workspace 제품 연결10개 파일로 제한한다. protected 브랜치 변경/merge/강제push/운영배포 없음.

## 14. ZIP·Manifest

ZIP은 exact SCHOOL06 부모 위의 delta, Source SHA/변경 목록·실행 로그·화면·Manifest/검증기·상대경로 복원법을 포함한다. 압축 해제 후 모든 파일 SHA256 검증. 이전 SCHOOL06 패키지는 그대로 보존한다.

## 15. 운영·Windows NOT RUN

Hosted Supabase Auth/PostgREST/역할 GRANT/auth.sessions·provider/redirect/실세션 회수, 운영 신규 permission 부여 절차, 실제 Windows safeStorage/GUI/패키징은 NOT VERIFIED/NOT RUN. 운영 프로젝트 xxownwxxajzrviuvvfiu에 접속·변경·RPC 호출·실제 계정 생성 없음. 기존 함수 경고19건 변경/재사용 없음. Native WorkerW 정책 유지.

## 16. 다음 통합 단계 인계

Cloud B 인계 후보 준비: exact Source SHA로 diff 검토 → 새 inventory 전용 API/기본 disabled Gate 확인 → 개인 Inventory 저장/암호화/백업 무회귀 → Windows980×700/900×680·로그인 없이 개인 기능·계정학교 전환·네트워크 차단 QA. 운영 적용은 별도 누적 child migration·최소권한/정책 검토·명시적 승인 후에만 진행한다.

**최종 CONDITIONAL: 공동 물품·유효기간 기능과 로컬 협업 흐름을 구현·검증했다. Hosted/Windows/전체 Electron 환경 검증 및 운영 permission/배포 Gate가 남아 운영 준비 완료 또는 배포 PASS가 아니다.**
