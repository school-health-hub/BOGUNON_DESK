# CLOUD-G1 Windows QA 인계

## 기준과 상태

- 저장소: `school-health-hub/BOGUNON_DESK`.
- 기준: `27ffc44cc9986984af0a7e4500b626fb7edc9b6e` (CLOUD-G0).
- 작업 브랜치: `codex/cloud-g1-windows-qa-handoff`. 최종 전체 Git SHA는 마감 보고 및 `git rev-parse HEAD`와 원격을 비교한다. 설치 파일의 실제 구현 전체 SHA는 Actions의 `G1-BUILD-RESULT.json:sourceSha`와 일치해야 한다. 뒤따르는 문서 전용 마감 SHA와 구분한다.
- 전체 기능/데이터 경계: [통합 매트릭스](../ELECTRON_FEATURE_INTEGRATION.md)의 CLOUD-G1 절.
- 상태: **QA 후보 / CONDITIONAL**. Windows CI와 실제 PC QA를 구분한다. TESTABLE/운영 준비 완료 표시를 하지 않는다.

## 이번 검증

- Cloud: 273 테스트/51파일, Rust Purchase 56개, Electron 3개 타입 구성 및 production build PASS.
- WIN-QA-04: 기존 파서 수정 `03e31e260d1edad656e704d63283544926a455a0`를 유지한다. 새 실제 합성 PDF·Rust/CLI/UI 회귀에서 4개 품목·23,500원·합계행 제외 PASS. 파서 재작성/중복 수정 없음.
- Windows CI: 실행 후 아래 결과를 기록한다. 기존 8개 진입+선택 Dock 공문 연결, 합성 PDF 1건만 GUI 확인한다. native 파일 선택창은 이 테스트에서 합성 경로 test double을 사용하므로 native dialog PASS로 표시하지 않는다.
- Portable·NSIS 및 fixed CLI를 빌드하고 후보 EXE SHA256/Authenticode 상태를 기록한다. 설치·제거를 실행하지 않는다. 운영 배포/자동 업데이트는 하지 않는다.
- 이번 Windows 실제 학교/집 PC 검증: **NOT RUN**. 기존 공문 파일 QA PASS는 사용자 보고를 재사용하며 재검증하지 않는다. Tauri DOC-V2-P11 PASS 역시 Electron GUI/ODT 호환성 증거로 대체하지 않는다.

## 다운로드 및 실행 (현재 PoC/운영 앱 보호)

1. 최종 보고의 G1 Actions에서 `CLOUD-G1-QA-candidate-<source SHA>`를 내려받아 새 폴더에 압축 해제한다. 원본 작업 폴더/운영 데이터 위치는 사용하지 않는다. 아티팩트는 7일 보존이며 만료 시 기존 구버전 설치 파일로 대신하지 않는다.
2. `G1-BUILD-RESULT.json`의 sourceSha와 작업 SHA, `Get-FileHash .\<실제 EXE 이름> -Algorithm SHA256` 결과와 `SHA256SUMS.txt`를 비교한다. 서명 상태는 manifest에 기록된다. 학교 정책이 실행을 차단하면 보호 기능을 우회하지 않고 중단·보고한다.
3. 이번 기본 QA는 **NSIS를 설치하지 않고 Portable EXE**로 한다. 기존 앱/PoC 제거·초기화·설정 삭제 금지. 일반 사용자 PowerShell에서 압축을 푼 폴더로 이동한 뒤 아래를 실행한다.

```powershell
# 같은 창에서 재실행하면 같은 격리 프로필을 사용한다. UUID를 메모해 둔다.
$env:ELECTRON_P0_TEST_RUN = [guid]::NewGuid().ToString()
$env:ELECTRON_P0_TEST_RUN
$pocExe = @(Get-ChildItem . -Filter 'BOGUNON-DESK-ELECTRON-P0-*-win-x64.exe')
if ($pocExe.Count -ne 1) { throw 'Portable EXE 한 개가 필요합니다. Setup EXE를 실행하지 마세요.' }
Start-Process -FilePath $pocExe[0].FullName -Wait
```

다시 실행할 때는 새 UUID를 생성하지 않고 마지막 `Start-Process`만 실행한다. 프로필은 `%APPDATA%\BOGUNON-DESK-ELECTRON-P0\test-runs\<UUID>`이며 기존 기본 PoC/운영 프로필과 분리된다. EXE 직접 더블클릭은 기존 기본 PoC 프로필을 사용할 수 있어 이 단계에서 피한다. NSIS는 산출물 확인용으로 함께 제공하며 설치/제거 QA는 별도 승인·격리 확인 후 수행한다.

## 실제 PC 집중 확인 항목

- Dashboard/Dock→업무 도구→각 포함 화면을 열고 복귀한다. 추가로 화면 꾸미기→Dock→공문 작업실 표시→해당 Dock 아이콘 진입을 확인한다. 기존 공문 파일 전체 QA는 반복하지 않는다.
- Purchase→가져오기 형식 PDF→동봉 `WIN-QA-04-synthetic.pdf` 선택→분석→적용. 이름 4개(합성 거즈/밴드/소독솜/체온계), 합계 23,500원, `예상 합계`라는 다섯 번째 품목이 없는지 확인한다. 취소 시 기존 품목 유지도 한 번 확인한다.
- 이번 UUID 프로필에서만 합성 메모·배치 저장 후 앱을 정상 종료하고 같은 UUID로 재실행해 복원을 확인한다. Purchase 품목은 세션 전용이므로 종료 후 사라지는 것이 현재 계약이다.
- 실제 파일 대화상자/한글 경로 및 필요한 출력만 별도 합성 폴더에서 확인한다. 원본 공문·학생·실제 금융·운영 재고 자료는 사용하지 않는다. 오류가 나면 덮어쓰기/초기화로 우회하지 않고 기능·단계·비식별 오류·sourceSha를 기록한다.

## 잔여 결함과 B 대기

- 전체 저장소 root TypeScript: 기존 26건(Electron bridge ambient 범위 24+기존 Tauri 공문 session/reference 2). Electron 타입/빌드 PASS와 구분한다. 이번 범위를 Tauri 타입 수정으로 확대하지 않는다.
- Newsletter 실제 승인 자산/긴 제목 출력, Purchase PDF native dialog/실제 PC 결과, 최신 생성 ODT K-에듀파인 호환성, 설치·제거 및 일반 사용자 패키지 QA는 미검증 상태를 유지한다.
- **Inventory Cloud B 통합 대기**: 현재는 기존 `8f0044cd…`의 합성 로컬 Inventory만 포함한다. 관찰한 별도 `feature/inventory-management` 원격 SHA는 `a765ad08570dc5513edf96bb970442026a0a31ce`이며 가져오거나 병합하지 않았다. B 최종 SHA·변경 범위·IPC/DTO 계약·검증 결과 인계를 받은 후 별도 승인된 통합 단계에서만 검토한다. RPC/RLS/migration/운영 DB를 수정하지 않는다.
- PR/main 병합/운영 배포/AI 신규 기능/TD2 재설계/공문 중복 이식 없음. 최종 판정은 Windows CI 결과와 실제 PC 미검증을 함께 기록한다.

## 최종 Windows CI 증거

- 구현/아티팩트 전체 SHA: **`571ac15e5600251e7140a21c7938d6d5e6a2ff37`**.
- [Windows Actions 41409674837](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41409674837): **SUCCESS**. 원본 합성 fixture·통합 테스트, Electron 타입/production build, fixed release CLI·Portable/NSIS 생성·패키지 CLI smoke, packaged Electron 집중 GUI(1 test, 5.9초), 후보 manifest/해시 기록·업로드 모두 성공.
- 다운로드: 위 Actions의 **`CLOUD-G1-QA-candidate-571ac15e5600251e7140a21c7938d6d5e6a2ff37`**. EXE 두 개, `SHA256SUMS.txt`, `G1-BUILD-RESULT.json`, `WIN-QA-04-synthetic.pdf`가 포함된다. 서명 상태는 manifest에 기록되며 CI는 NotSigned/Valid 이외의 상태를 거절했다. 실제 SHA256/서명 값은 동봉 기록과 대조한다. 증거 파일은 **`CLOUD-G1-evidence-41409674837`**에 있다. 업로드 시 두 아티팩트 모두 expired=false 확인(7일 보존).
- 실제 검증: Windows **win-unpacked의 packaged EXE**가 UUID 격리 프로필로 실행되어 기존 8개 대상, 설정·업무 도구 경유, optional 공문 Dock 진입·복귀와 PDF→main IPC→패키지 CLI→UI 4개/23,500원을 확인했다. `예상 합계`가 다섯 번째 품목으로 추가되지 않았다. native open dialog는 synthetic 경로 test double이므로 실제 파일 선택창 통과를 주장하지 않는다.
- **Windows CI PASS / Windows 실기기 NOT RUN**. Portable wrapper EXE의 실제 PC 실행, NSIS 설치/제거, 일반 사용자 데스크톱 환경, native 파일 선택과 외부 프로그램 확인은 미실행이다. packaged EXE smoke PASS를 Portable/NSIS 실기기 PASS로 대체하지 않는다. 이 후보는 Windows x64 대상이며 Cloud 실제 Electron GUI와 Linux 패키징은 NOT RUN이다.
- 전체 root `npx tsc --noEmit`은 현재도 26건으로 FAIL, G0와 동일하다. 닫힌 renderer boundary=true이며 기존 Tauri `officialDocumentSession`이 bundle에 없는 것을 확인했다. Electron 전용 타입·빌드 PASS와 혼동하지 않는다.
- **최종 CONDITIONAL: Windows 실기기 집중 QA에 인계할 후보 확보**. 알려진 범위 밖 결함을 고치기 위해 원본 Tauri/보호 데이터를 변경하지 않았다. Inventory B/RPC/RLS/migration 변경/병합 없음. 코드 변경 없이 이 검증 기록만 문서 마감 커밋(`[skip ci]`)으로 보존한다. 마감 전체 SHA/remote clean 여부는 최종 보고로 확인한다.

## Inventory Preview 원격 인계 및 Windows GUI 재현 (2026-11-02)

이 절은 별도 브랜치 **`codex/cloud-a-inventory-preview`**용이다. 위 G1 후보 EXE에는 Preview가 없으므로 이 검증에 사용하지 않는다. Preview 구현/자동 검증 체크포인트는 **`a8f8dc1da6416c4a6c0bed0e80526480231e9275`**이고, 뒤따르는 문서 전용 커밋을 포함한 최종 전체 SHA는 인계 보고와 원격 HEAD를 비교한다. 이번 사용자 승인은 해당 브랜치의 일반 push 및 이 문서 갱신에 한정한다. 실제 push 결과는 최종 보고로 확인한다.

현재 근거는 관련 테스트 **101 PASS**, Electron TypeScript/production build PASS다. 이 인계 단계에서는 테스트·빌드·GUI를 재실행하지 않는다. 실제 Electron GUI·좁은 창·Windows GUI는 **NOT RUN**이다. Cloud의 마지막 시도는 `Process failed to launch!`로 시작되지 않았으며 재시도/환경 재구성/보안 완화는 하지 않는다. 이전 G1 Windows CI나 Cloud B 테스트를 새 Preview GUI PASS로 대체하지 않는다.

### 1. 별도 Windows 작업본 확인

기존 Tauri/Electron/Inventory 작업 폴더·앱·Codex 세션은 건드리지 않는다. 아래 새 폴더가 이미 있으면 다른 이름을 쓰고 reset/clean/삭제로 덮어쓰지 않는다.

```powershell
git clone --single-branch --branch codex/cloud-a-inventory-preview https://github.com/school-health-hub/BOGUNON_DESK.git BOGUNON-DESK-Preview-QA
Set-Location BOGUNON-DESK-Preview-QA
git rev-parse HEAD
git status --porcelain
git ls-remote origin refs/heads/codex/cloud-a-inventory-preview
git rev-list --left-right --count HEAD...origin/codex/cloud-a-inventory-preview
```

HEAD는 최종 인계 SHA 및 원격과 동일, status 출력 없음, divergence `0 0`이어야 한다. 다르면 자동 merge/reset하지 않고 보고한다. `node --version`, `npm --version`으로 Node 24/npm 사용 가능 여부를 확인한다. 도구가 없거나 정책이 막으면 전역 설치/보호 우회 없이 BLOCKED로 기록한다.

### 2. Inventory 범위만 준비·실행

```powershell
npm ci
npm run electron:p0:build
# 이 두 E2E는 모두 UUID test-runs에서 합성 데이터만 사용한다.
npx playwright test --config electron-p0/playwright.config.ts inventory.e2e.ts --reporter=list
```

이 경로는 Electron을 사용하므로 별도 Chromium 설치나 Local Supabase/Rust CLI 빌드는 필요하지 않다. Node 모듈 설치/빌드/실행 중 하나라도 실패하면 GUI PASS로 기록하지 않는다. 전체 `npm run build`(Tauri root)나 전체 Windows GUI suite로 범위를 확대하지 않는다. 준비된 E2E는 로컬 합성 입고 저장·동일 UUID 재실행과 Preview/640×720/입고 대화상자/로컬 JSON 미생성을 확인한다. **6개 대화상자 전체와 직접 IPC 관측까지 자동 검증하는 테스트는 아니다.** 결과·trace·스크린샷은 `artifacts/electron-p0-e2e/`에서 확인한다.

독립 수동 확인은 같은 폴더에서 다음처럼 실행한다. 매번 기본 PoC 프로필을 쓰지 않도록 UUID를 반드시 설정한다.

```powershell
$env:ELECTRON_P0_TEST_RUN = [guid]::NewGuid().ToString()
$env:ELECTRON_P0_TEST_RUN
npm run electron:p0:start
```

같은 합성 프로필의 재실행은 UUID를 새로 만들지 않고 `npm run electron:p0:start`만 다시 실행한다. 실행 중이거나 기존에 설치된 운영 앱을 종료하지 않는다. 새 NSIS 설치/제거는 이번 Preview GUI 절차에 없다.

### 3. 실제 GUI 체크리스트

| 확인 | 합성 자료로 수행할 조작 / 기대값 |
| --- | --- |
| 실행·메뉴 | Dock 업무 도구에서 **물품관리 — 로컬 저장 / 물품관리 — 미리보기**를 구별한다. Preview를 열면 합성 데이터 배너와 `preview_only`, `persisted:false`, 실제 저장/DB 없음 표시가 보인다. |
| 목록·상세·필터 | 요약·목록·로트 잔량/유효기간을 확인한다. ‘탄력’ 검색, 없는 검색어, 전체/만료 필터를 차례로 확인한다. 기준일 2026-11-02의 고정 합성 자료이며 실제 재고 현황이 아니다. |
| 6개 대화상자 | 물품 등록·입고 등록·재고 사용 기록·폐기 기록·재고 정정·구매 후보 확인을 각각 연다. 합성 값 입력/입력 내용 확인/취소/Escape를 확인한다. 등록은 규격·구매단위도 채우고, 입고일은 2026-11-02, 수량/변환비는 1 등 합성 값을 쓴다. 결과는 미리보기 검증이며 저장 완료·입고 완료가 아니고 목록 수량도 바뀌지 않아야 한다. |
| 검증 오류 | 빈 필수값/초과 폐기량/누락 사유를 확인한다. 실패를 서버 저장 결과로 표시하지 않는다. 오류 후 닫기·다시 열기가 가능해야 한다. |
| 모드 격리 | 아래 합성 JSON 해시 절차를 수행하고 로컬↔Preview를 왕복한다. Preview 입력/검색값이 로컬 물품에 들어가지 않고 다시 연 Preview의 임시 검색/대화상자 상태도 남지 않아야 한다. |
| 작은 창 | 약 1280×900과 640×720에서 헤더·전환/닫기·검색/필터·상세·대화상자 입력/취소가 접근 가능한지 확인한다. 표 내부 스크롤과 화면 전체 잘림을 구분한다. |
| 화면 캡처 | 로컬 메뉴/화면, Preview 메인·상세·검색/필터, 6개 대화상자와 좁은 창을 캡처한다. 합성 화면만 보존하고 개인 바탕화면/계정·실제 학교 자료는 포함하지 않는다. |

### 4. JSON 원본·백업 보존 확인

운영/기존 기본 PoC 프로필은 열거나 복사하지 않는다. **위 수동 실행의 UUID 아래에서 새로 생성한 합성 JSON만** 검사한다. 먼저 로컬 저장 화면에서 합성 입고 1건을 저장하고 완료 안내를 기다려 원본·backup을 만든다.

```powershell
$qaInventory = Join-Path $env:APPDATA "BOGUNON-DESK-ELECTRON-P0\test-runs\$($env:ELECTRON_P0_TEST_RUN)\work-data\inventory"
$before = Get-ChildItem -LiteralPath $qaInventory -Filter '*.json' | Sort-Object Name | ForEach-Object {
  [pscustomobject]@{File=$_.Name;Hash=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
}
$before
# 앱에서 Preview만 조작한 후, 로컬 저장 조작을 추가하지 않은 상태에서:
$after = Get-ChildItem -LiteralPath $qaInventory -Filter '*.json' | Sort-Object Name | ForEach-Object {
  [pscustomobject]@{File=$_.Name;Hash=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
}
Compare-Object $before $after -Property File,Hash
```

`inventory.json`·`inventory.backup.json` 존재와 비교 출력 없음이 기대값이다. 같은 UUID로 재실행해 저장된 합성 입고가 복원되는지도 확인한다. 경로에 현재 UUID가 없거나 기존 운영 경로이면 검사하지 말고 중단한다. 파일이 변경됐다면 초기화/삭제로 맞추지 말고 단계·해시 차이만 기록한다.

### 5. 네트워크·저장 IPC 증거 구분

- UI 배너나 JSON 미생성만으로 실제 호출 0회를 확정하지 않는다. DevTools Network의 Fetch/XHR/WS 관측이 가능한 승인된 환경에서는 Preview 진입/6개 대화상자 조작 중 backend 요청 유무를 기록한다. 로컬 번들·폰트 로딩과 DB/API 요청을 구분한다. 관측 도구가 없으면 네트워크 GUI 관측은 NOT RUN이다.
- 제품 코드를 바꾸지 않고 독립 회귀 증거를 확인하려면 다음 테스트를 실행한다. 합성 화면의 fetch/XHR/저장·로드 IPC 무호출, B transport 미포함, 실제 임시 JSON/backup 바이트 보존을 검증한다.

```powershell
npx vitest run electron-p0/tests/inventory-preview-isolation.test.tsx electron-p0/tests/inventory-preview-boundary.test.ts
```

- 위 결과는 컴포넌트/정적 경계 증거이며 **실행 중 Electron IPC 계측 결과는 아니다**. 실제 IPC 계측이 없다면 해당 GUI 관측은 NOT RUN으로 남긴다. 관측을 위해 Host/IPC를 임의 수정하거나 봉인된 API를 우회하지 않는다. Local Supabase·RPC·운영 DB에 연결해 테스트하지 않는다.
- 최종 기록에 최종 Git SHA, Windows/Node/Electron 버전, 수행 항목별 PASS/FAIL/NOT RUN, 캡처 경로, 네트워크/IPC 관측 방식과 한계를 적는다. GUI 실패 시 마지막 오류를 보존하고 반복 실행·no-sandbox·보안 우회로 통과시키지 않는다.

이 절차는 Windows 담당자의 후속 QA 인계이며 **현재 실제 GUI 미검증 상태(CONDITIONAL)는 유지한다.** 이번 Cloud 작업은 문서 갱신·안전 검사·승인된 일반 push까지만 진행하고 종료한다.
