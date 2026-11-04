# STABILITY-01 — 트레이 복귀·Finder 수명주기

기준 제품/원격 통합: `af52921c96b9b24b5dd5f49cc133471e634d2420`.
기능 브랜치: `feature/electron-tray-finder-lifecycle`.
판정: **CONDITIONAL — 코드상 결함 재현·수정 및 Cloud 검증 완료, 실제 Windows GUI NOT RUN**.

## 원인과 수정 전 증명

`main/main.mts`는 창을 한 번 만들고 FinderSearchService와 IPC를 그 창에 연결한다. Main의 `show()`는 동일 창을 restore/show/focus하며 renderer를 reload하거나 다른 화면을 remount하지 않는다.

기준 코드에서는 `window.on('close',()=>finderSearch.dispose())`가 먼저 실행되고, 이후 close 정책이 `preventDefault()` + `window.hide()`로 트레이에 숨겼다. close 취소는 이미 실행된 listener를 되돌리지 않는다. FinderSearchService.dispose는 `disposed=true`, 메모리 Key/known results 정리이고, operation은 disposed 상태를 영구 거절한다. show에서는 새 Finder 인스턴스를 만들지 않는다.

수정 전에 실제 Main 파일에서 Finder에 등록된 이벤트명을 읽어 Mock EventEmitter 창에 바인딩하고 **실제 FinderSearchService**를 사용했다. close/preventDefault/closed 구분을 가진 합성 창에서 `destroyed:false`, 다시 `visible:true`인데 `configured:false`가 됐다. 회귀 assertion은 기대 configured:true / 실제 false로 **1 FAIL**했다. 암호화 vault 모형에는 기존 Key가 남아 saved:true였다. 실제 Windows 실행 재현이 아니다.

별도로 사용자 확인 응답을 지연한 검색/Key 연결을 dispose하자 owned operation이 확인 응답을 기다려 종료되지 않는 경로도 재현했다. 종료된 요청의 rejection을 기다리는 **2개 테스트가 FAIL**했으며, 확인을 나중에 해제하면 종료됐다. timeout을 늘리거나 assertion을 제거하지 않았다.

재현 로그(해당 Cloud 세션): `/tmp/stability01-before-tests.log`, `/tmp/stability01-before-approval-tests.log`.

## 변경한 수명주기 계약

- **close = 종료 요청/트레이 정책**, **closed = 실제 창 파괴**로 구분한다. 트레이 hide/show는 같은 renderer·Finder·메모리 연결을 유지한다.
- Main 한 파일의 14개 terminal cleanup 등록 위치를 close→closed로 이동했다. Finder 외에 같은 창의 API/ChatGPT 세션, OCR/구매 파일 처리, 공문/행정, Finance close, 개발용 Inventory QA close도 포함한다. 같은 이벤트가 다른 도구의 세션까지 폐기하는 일을 피하기 위한 동일 원인의 수정이다. 해당 인증·암호화·업무 엔진 파일은 변경하지 않았다.
- 기존 최종 `quit()`의 dispose/flush, before-quit, security navigation, renderer crash 정리는 유지한다. API 세션 dispose와 Inventory QA close도 quit 진입 시 명시해 실제 종료 정리를 늦추지 않는다. 실제 quit에서는 Finder를 폐기하고 pending 요청/store flush를 기다린 뒤 tray/app을 종료한다.
- Finder의 비파괴 cancel과 영구 dispose는 그대로 구분한다. React Finder unmount는 기존 bridge.cancel만 호출하며 Main을 영구 폐기하지 않는다. 다시 진입하면 같은 Main service 상태와 저장 자료를 읽는다. 실제 앱 재시작은 새 service 인스턴스이며, 사용자가 선택한 기존 암호화 연결을 restore할 수 있다.
- 승인된 진행 중 검색은 hide만으로 취소하지 않는다. 새 요청을 자동 발생시키지도 않는다. 취소/다른 모듈 전환/unmount에는 기존 AbortSignal·generation·renderer epoch를 유지한다. 단지 숨김일 때 새 세션이 만들어진 것으로 취급하지 않는다.
- `finder-search.ts`에 **승인 응답 대기만** AbortSignal로 중단하는 작은 waitForApproval을 추가했다. 검색/Key 등록의 사용자 승인을 우회하지 않는다. 취소·종료 후 늦은 승인은 네트워크 요청이나 Key 쓰기로 이어지지 않는다. 취소한 이전 승인이 새 검색의 controller/result를 바꾸지 않는다.
- 확인 대기의 abort listener는 완료/실패/취소 시 해제한다. 새 timer/반복 listener/자동 retry는 추가하지 않는다. 기존 검색 timeout과 네트워크 abort, 원자적 Key 쓰기, Key vault, IPC sender/schema 검증은 그대로다. 이 helper는 OS 확인창을 임의로 강제 닫는 API가 아니며, 실제 native 확인창 종료 동작은 Windows 후속 확인 대상이다.

## Finder 상태·데이터 보존

UI 및 저장 계약은 변경하지 않았다. 실제 BrowserWindow.hide는 renderer unmount가 아니므로 선택 영상·편집 중 안내문/메모가 메모리에 남는다. 사용자가 작업실을 닫아 React가 실제 unmount하면 저장한 자료만 다음 진입에서 복원되며, 미저장 내용을 자동 저장했다고 표시하지 않는다.

합성 기존 V1/V2 fixture를 **실제 EducationVideoLibraryStore**에 저장했다. hide/show 동안 양쪽 JSON bytes가 동일하고, 동일 textarea DOM node와 미저장 메모가 유지되는지 검사했다. 실제 Finder UI의 저장 버튼으로 변경 메모를 저장하고 unmount/remount했을 때 같은 영상 자료가 복원됐으며, 실제 closed 후 새 store에서도 복원됐다. V2 bytes는 계속 보존됐다. Key vault 테스트는 합성 메모리 vault이며 실제 Windows 암호화 저장소를 사용하지 않았다.

## Cloud 검증 결과

- 집중 Vitest **156 PASS / 21개 파일**. 신규 수명주기 9개와 기존 관련 회귀 147개이며 반복 실행 합산이 아니다.
- 신규: 수정 전 경로 재현, 최초 진입/트레이 복귀, 12회 반복 시 session Key/동일 인스턴스/고정 listener 수, 진행 검색 hide 보존, 명시 cancel/늦은 결과, 실제 closed의 abort/flush와 새 lifetime restore, 검색/연결 승인 대기의 종료, 과거 승인과 새 검색 분리, 실제 V1/V2 파일·메모·재진입/재시작 보존.
- 회귀: Finder 검색/YouTube 응답/전용 vault/UI/V1·V2, desktop, API/ChatGPT service, Finance IPC, OCR 이미지 IPC, Purchase 설정, Record UI, 업무 폴더, private drop preload, P1-4 routing, P1-5 공문 AI, Newsletter projects UI, QA profile.
- Electron Main/renderer/tests TypeScript 및 `npm run electron:p0:build` **PASS**. 기존 chunk 크기 경고는 유지한다. 루트 타입은 기준과 같은 기존 오류 **13개**, 신규 오류 signature **0개**다. 루트 전체 build PASS로 표시하지 않는다.
- 기존 ASAR Main/Preload runtime graph 및 **native CLI 5개/Record provenance 계약 검사 6 PASS**. Record 검증용 기존 Cloud native 산출물을 출처가 같은 ignored build 경로에 재사용하며 Rust 재컴파일/Portable 생성은 하지 않는다. OCR 자원 및 builder는 변경하지 않았다.
- lint script가 없어 새 script나 의존성을 추가하지 않았다. 변경 범위·diff·민감정보 패턴 검사. 실제 사용자 문서/학생 정보/학교 계정/금융정보/유료 API를 사용하지 않았다.

검증 로그: `/tmp/stability01-final-tests.log`, `/tmp/stability01-build.log`, `/tmp/stability01-root-types.log`, `/tmp/stability01-package-tests.log`. 이 Cloud Mock/DOM 결과는 Windows GUI 성공을 대신하지 않는다.

## 변경 파일

1. `electron-p0/main/main.mts`: terminal cleanup 이벤트와 실제 quit 정리.
2. `electron-p0/main/finder-search.ts`: 승인 대기 취소/종료 정리.
3. `electron-p0/tests/tray-finder-lifecycle.test.tsx`: 실제 서비스·소스 바인딩·Mock 창·Finder UI/합성 저장소 집중 테스트.
4. 본 문서.

새 IPC/저장 schema/마이그레이션/의존성/native CLI/CSS/렌더러 재마운트는 없다. 기존 브랜치·통합/main·사용자 실행본과 데이터는 변경하지 않는다. Native WorkerW 제외 유지. 기능 브랜치 일반 commit/push만 수행한다.

## Windows 인계 — 모두 NOT RUN

후속 승인 시 기존 Windows QA 방식으로 다음 경로만 함께 확인한다. 새 workflow/Portable은 이번 작업에서 생성하지 않는다.

1. 실제 트레이 숨김→아이콘 복귀를 반복하고 Finder 재검색/원본 열기/저장 자료·편집 메모/AI 연결 상태 확인.
2. 다른 모듈로 이동 후 Finder 재진입, 저장 자료 복원. 자동 재로그인이나 자동 유료 호출 없음 확인.
3. 검색·Key 확인창이 떠 있는 상태의 취소/최종 종료. 늦은 승인으로 외부 요청/Key 저장이 발생하지 않는지 확인.
4. 실제 앱 종료 후 소유 native child·요청·임시 사본·프로세스 잔여 0개 및 재시작 복원.
5. 980×700/1280×800의 작은 창 메뉴·스크롤·포커스 확인. TD2의 기존 PARTIAL 판정을 자동으로 PASS로 바꾸지 않는다.

이번 판정은 **Cloud 코드상 재현·수정 PASS / Windows 실사용 CONDITIONAL**이다. 원격 통합 HEAD가 기준 SHA를 유지하면 Cloud B에서 fast-forward 가능하며 자동 통합하지 않는다.
