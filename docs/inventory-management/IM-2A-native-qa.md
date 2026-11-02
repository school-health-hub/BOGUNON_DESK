# IM-2A Native QA

## 판정

`CONDITIONAL — 기능 검증 PASS, 자동 Native 캡처 미완료`

Windows Tauri 앱은 현재 Inventory worktree 소스에서 빌드·실행되었고 WebView2 및 980×700 클라이언트 영역을 확인했다. 대시보드와 `업무 도구` 패널의 `보건 업무 > 물품관리` 메뉴 노출도 실제 Native 창에서 확인했다.

후속 Native QA에서 `물품관리` 최초 진입 시 화면이 멈추는 현상을 재현했다. 원인은 `InventoryManagementPanel`의 기본 합성 adapter가 렌더마다 새로 생성되어 `loadWorkspace` effect가 반복 실행되는 것이었다. 기본 adapter를 모듈 수명 동안 안정된 인스턴스로 유지하도록 수정했고, 수정 전 멈춘 Tauri/Vite 세션만 종료한 뒤 현재 소스로 재실행했다.

재실행 후 사용자가 실제 Tauri 창에서 물품관리 진입, 본문·상세·검색·필터, 6개 업무 대화상자 및 Escape 닫기를 직접 조작해 모두 정상임을 확인했다. Codex Windows 창 전용 자동화는 `failed to write kernel assets: path not found` 오류로 초기화되지 않았고 WebView2 원격 디버깅 포트도 열리지 않아, Inventory 본문과 대화상자의 신규 자동 캡처는 수행하지 못했다. 다른 앱에 입력이 전달될 수 있는 포그라운드/좌표 우회는 사용하지 않았다.

## 실행 환경

- Source HEAD: `b2efb09ebb7bb10fb465714acbb702e445b69208`
- Executable: `src-tauri/target/debug/school-health-desk.exe`
- 실행 방식: `npm run tauri -- dev --no-watch`
- WebView2: `156.0.4314.58`
- 창 외부 크기: 996×739
- 창 클라이언트 영역: 980×700
- 빌드 전제조건: Strawberry Perl 5.42.3.1, NASM 2.16.01

## 확인 결과

| 항목 | 결과 |
|---|---|
| 현재 소스 기반 Tauri 빌드 및 실행 | PASS |
| 실행 파일과 Source HEAD 기록 | PASS |
| WebView2 자식 프로세스 | PASS |
| 980×700 클라이언트 영역 | PASS |
| 기존 DESK 대시보드 렌더링 | PASS |
| 업무 도구 패널 | PASS |
| 보건 업무 카테고리 | PASS |
| 물품관리 메뉴 노출 | PASS |
| 명령 팔레트 Native 실행 | NOT RUN |
| 물품관리 메인·상세 Native 화면 | PASS — 사용자 직접 조작 |
| 검색·필터 Native 동작 | PASS — 사용자 직접 조작 |
| 물품 등록·입고·사용·폐기·정정·구매 후보 대화상자 | PASS — 사용자 직접 조작 |
| Escape 닫기 | PASS — 사용자 직접 조작 |
| 자동 Native 스크린샷 | NOT RUN — 창 전용 자동화 런타임 오류 |
| 수정 후 집중 테스트 | 18/18 PASS |
| 수정 후 전체 회귀 | 1,254/1,254 PASS |
| TypeScript 및 Production build | PASS |

## 증거

- `.omo/evidence/im-2a/native/01-native-980x700-main.png`
- `.omo/evidence/im-2a/native/02-native-work-tools.png`

두 기존 캡처는 합성 Inventory 데이터가 아닌 기존 DESK 대시보드와 업무 도구 메뉴만 포함한다. 이번 재검증에서는 Inventory 본문 신규 캡처를 만들지 못했으며, 사용자 직접 조작 결과를 자동 캡처 증거로 확대 해석하지 않는다. 자동 캡처 과정에서 대상이 아닌 기존 브라우저가 잡힌 파일은 즉시 삭제했으며 증거 폴더에 남기지 않았다.

독립 시각 리뷰 2회는 두 캡처의 CJK 렌더링, 메뉴 가독성, 가로 오버플로 및 증거 범위를 `PASS / HIGH confidence`로 판정했다. 두 리뷰 모두 캡처되지 않은 Inventory 본문과 업무 대화상자를 Native PASS로 확대 해석하지 않고 전체 판정을 `CONDITIONAL`로 유지해야 한다고 확인했다. 기존 대시보드 시계 카드의 좁은 폭과 가로 스크롤 표시는 비차단 기존 화면 이슈로 분류했다.

## 잔여 증거 조건

기능 동작은 실제 Tauri에서 확인되었지만 신규 Inventory Native 캡처는 없다. 창 전용 자동화 런타임이 복구되는 세션에서 동일 빌드를 대상으로 본문·상세·검색·필터·6개 대화상자를 캡처하면 시각 증거 게이트를 완전히 닫을 수 있다. 이 미완료 항목 때문에 전체 판정은 `READY`로 올리지 않는다.

## Native 증거 마감 재시도

`IM-2A-NATIVE-EVIDENCE-CLOSE`에서 제품 기능이나 회귀 테스트를 변경하지 않고 캡처 자동화 초기화만 재검증했다.

- `cua_repl` 초기화: FAIL — `failed to write kernel assets: 지정된 경로를 찾을 수 없습니다. (os error 3)`
- `node_repl`의 공식 `@oai/sky` 초기화: FAIL — 동일 오류
- 시도 횟수: 2회로 제한 후 중단
- Temp, Codex runtime, `node_repl.exe` 및 `cua_node` 실행 경로: 존재
- 사용자 및 Codex sandbox 쓰기 권한: 확인
- 다른 독립 worktree의 기존 기록에서도 동일 오류 확인
- Tauri/Vite 신규 실행: 없음
- 다른 Electron·Codex 프로세스 조작: 없음

따라서 이번 마감 작업에서도 Inventory 메인·상세·검색·필터·6개 대화상자의 신규 Native 캡처는 `NOT RUN`이다. 실제 Tauri 기능의 사용자 직접 검증 PASS는 유지하지만, 캡처 증거 확보 PASS로 바꾸지 않는다.
