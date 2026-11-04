# PARITY-P1-2 — 업무 폴더·즐겨찾기·메모 URL

기준 SHA: `f86b18f7721e82aaabd16153865428ce4e619263`.
기능 브랜치: `feature/electron-work-folders`.
판정: **CONDITIONAL** — Cloud 구현/합성 집중 검증 완료, Windows OS 실행 및 GUI NOT RUN.

## 원본 계약과 재사용

- `src-tauri/src/work_folders.rs`, `src/work-folders/workFolderService.ts`, `WorkFoldersPanel`, `SettingsCenterSections`, `QuickLauncherWidget`를 대조했다.
- 원본은 폴더와 별도의 즐겨찾기 플래그를 두지 않는다. 등록한 폴더 자체가 즐겨찾기이며 최대 12개, 이름 40자, `{id,name,path}` 순서 배열이다. 선택 등록·중복 거절·이름 변경·등록 해제·전체 ID 순서 변경·등록된 ID로 열기를 복원했다. 등록 해제는 디스크 폴더 삭제가 아니다.
- 기존 `WorkFoldersPanel`에 선택적 embedded/management 확장 지점만 추가했다. 기존 Tauri 호출부/service/Rust command와 저장소는 변경하지 않고 기본 표시·동작을 유지한다. Electron은 기존 `SurfaceDialog` 모달 접근성과 원본 목록을 재사용하고 업무 도구·Dock의 work-folder·빠른 실행 위젯에 연결한다.
- 기존 `QuickMemoEditor`/`extractMemoUrls`의 명시적 열기 버튼을 그대로 사용한다. 최대 5개 링크 표시, 일반 텍스트는 자동 실행하지 않는 계약을 유지한다. 메모 작성/저장/복원·업무 전달·복사 계약은 변경하지 않았다.
- Tauri의 `desktop-folder-favorites.json` 및 legacy `desktop-launchers.json` 자동 이전은 수행하지 않는다.

## Electron 저장 경계

위치: `<Electron userData>/work-data/work-folders/favorites.json` 및 `favorites.backup.json`.

```json
{"version":1,"revision":0,"favorites":[]}
```

- 원본 세 필드 `{id,name,path}`와 순서를 유지하고 Electron용 version/revision 외피만 추가했다. 가용성·표시 경로는 Main에서 계산하고 저장하지 않는다.
- Main만 경로를 등록한다. Renderer의 수정 요청은 ID/이름/전체 ID 순서/expectedRevision만 허용하며 임의 경로 또는 전체 저장 문서를 받지 않는다.
- exact-key schema, 12개/64KiB/이름/ID/경로 검사, 단일 Main queue와 expectedRevision 충돌 검사를 적용한다.
- 기존 `SettingsStore`의 exclusive 임시 파일·fsync·원자적 rename 및 제한된 Windows EPERM 재시도를 재사용한다. 저장 전 이전 정상본을 백업하고 쓰기 실패 시 primary를 유지한다. 정상 종료는 store queue를 기다린다.
- 손상·미지원 버전·과대 저장 파일을 자동 초기화하거나 덮어쓰지 않는다. 유효한 백업만 있으면 읽기 전용으로 표시하고 수정을 차단한다.
- 저장소 조상 폴더 및 저장 파일의 symlink/잘못된 타입, 파일 hardlink를 거절한다. 다른 모듈의 저장소·Finance 키·기존 메모 파일은 변경하지 않는다.

## OS 실행 및 URL 경계

- 선택: Main-owned `showOpenDialog(openDirectory)`만 사용한다. 취소는 기존 목록을 보존한다. 실제 폴더/모든 조상 디렉터리의 lstat·접근권한·realpath를 검사한다.
- 열기: Main이 저장된 ID를 조회한 다음 폴더를 다시 검사하고 `shell.openPath`를 호출한다. 파일/실행파일/명령/URL 열기로 확장하지 않는다. 이동·삭제, 권한 거부, 탐색기 실행 실패를 안전한 안내로 구분한다.
- Windows UNC/device/drive-relative/ADS/특수 이름/비정규 경로, symlink/junction 및 `.lnk`/`.url` 바로가기를 거절한다. 해석된 canonical 경로에도 같은 검사를 적용한다. Windows의 실제 mapped-drive/reparse-point 동작은 후속 실기기 검증 대상이다. 모든 네트워크 파일시스템을 완벽히 식별한다고 보장하지 않는다.
- 등록 해제는 Renderer의 명시적 요청과 Main native 확인(기본 취소) 후에만 저장한다. actual 폴더/파일을 삭제하는 API는 없다.
- URL: Main의 `p2:memo:open-url`에서 HTTP/HTTPS·호스트·길이·제어문자/역슬래시·URL 내 인증정보를 검증한 뒤 `shell.openExternal`을 호출한다. 임의 프로토콜·OS 명령은 받지 않는다.
- Main이 메모 URL로 HTTP 요청을 수행하거나 미리보기/로그인/쿠키/리디렉션 검사를 하지 않는다. 사용자가 클릭한 주소를 브라우저에 넘기며 이후 탐색은 브라우저가 처리한다.
- 모든 IPC는 정확한 window/senderFrame/renderer URL/인수 schema를 확인한다. 창 종료·navigation·renderer crash 뒤 늦은 picker 결과를 등록하지 않는다. 실제 OS opener는 테스트에서 대체했으며 외부 사이트를 열지 않았다.

## 집중 검증

- 고유 Vitest **126 PASS**: 폴더 CRUD·12개/이름/중복/정렬/재실행, 취소·revision 충돌·쓰기 실패·백업, 손상/미지원/과대/링크 저장 파일, 파일/바로가기/링크/없음/권한 거부, unsafe Windows path/URL, OS opener 실패, preload 최소 권한, UI 조작과 모달, 기존 메모 저장·재실행·명시적 URL 클릭.
- 같은 집중 범위에 Purchase P0-1/Finder P0-2/Record Helper P1-1·Quick Launcher·기존 Surface 접근성 최소 회귀를 포함했다. 반복 실행을 중복 합산하지 않았다.
- ASAR Main/Preload 전체 상대 import graph 및 기존 5개 native 자원/provenance 계약 **6 PASS**. 기존 Record CLI 합성 fixture와 검증 binary를 재사용했으며 새 native CLI/빌드 자원/의존성은 추가하지 않았다.
- Electron Main/Renderer/tests TypeScript 및 production build PASS. 저장소에 lint script가 없어 새 lint 명령을 만들지 않았다. diff 검사 PASS.
- 루트 타입 검사는 기준과 동일한 기존 오류 13개, 신규 오류 서명 0개다. Electron 전용 타입 검사와 구분한다.

Windows 탐색기/기본 브라우저 실행, native 선택·삭제 확인창, 실제 small-window/DPI/키보드 GUI, Windows mapped-drive/junction 특성은 **NOT RUN**. Portable/workflow/실제 학생·교직원 자료/학교 계정/운영 데이터는 사용하지 않았다.

## 인계 및 보호

변경은 새 protocol/store/IPC, renderer adapter와 국소 CSS, P0 진입점/preload/Main 등록, 기존 WorkFoldersPanel의 선택적 확장, 집중 테스트에 한정한다. TD2 Glass 공통 스타일/Dashboard geometry/위젯 ID·배치, Purchase/Finder/Record의 저장·AI 엔진, 기존 native CLI 5개 및 OCR은 보존한다. 전역 파일 드롭/계산기/명령 팔레트/서버 동기화는 추가하지 않았다.

통합 원격 HEAD가 여전히 기준 SHA라면 이 기능 브랜치를 Cloud B에서 fast-forward할 수 있다. 이번 작업은 기능 브랜치만 일반 push하며 main/통합 브랜치는 변경하지 않는다.
