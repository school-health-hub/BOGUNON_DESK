# Purchase Helper — 2026-11-01 학교 PC 인계

## 판정과 승인 범위

이 문서는 Phase 2B-2의 템플릿 보존 및 Playwright 실패 수정과 학교 PC 인계만 기록한다. 신규 기능, main 병합, PR, 배포 승인이 아니다. 오늘은 인계 후 종료하며 Phase 2B-3 구현을 시작하지 않는다.

**오늘 개발 판정: CONDITIONAL / 학교 PC 인계 판정: PARTIAL.** 종료 시점 2026-11-01T15:08:32Z 기준 Windows run `41317332718`은 **COMPLETED / SUCCESS**이다. 오늘 두 차단 수정의 Windows 자동 검증은 완료됐으며, 독립 화면 검토와 네이티브 통합은 완료로 판정하지 않는다. 원격 실행을 취소하거나 재시도하지 않았다. 이 채팅이 종료 후 자동 추적하거나 결과를 갱신한다고 약속하지 않는다. 학교 PC에서 아래 exact run의 결과·Artifact를 먼저 확인한다. 과거 결과를 신규 수정 PASS로 사용하지 않는다. 문서 자체를 포함하는 최종 원격 HEAD는 별도 종료 보고와 `git ls-remote`로 확인한다. 자기 자신을 포함한 commit SHA는 본문에 고정할 수 없다.

## A. 프로젝트 위치와 안전한 복원

- 저장소: https://github.com/school-health-hub/BOGUNON_DESK.git
- 작업 브랜치: `feature/purchase-helper-enhancement`
- 집 PC 전용 worktree: `C:\Users\Public\Documents\BOGUNON-purchase-helper`
- 오늘 시작 제품: `b679393b3dcec1affdbda13fb4b20a6e4bbca69e`
- 오늘 시작 로컬·원격 controller: `b2f208714eaf93c2d5e63dde227e9b722fb3e046` (clean, 0/0 확인)
- 최종 제품 SHA: `782134bff8368e6b0dba290ddc80aca4f1a760fc` (Windows 자동 검증 SUCCESS)
- 최종 QA controller SHA: `03d61daf4605e2fc07c5ecd3f20cd8e30153df7b`
- 최종 원격 SHA: **별도 종료 보고의 전체 SHA를 기준으로 복원 후 원격 조회와 대조한다.**

학교 PC를 실제로 조작하거나 복원 검증한 것은 아니다. 기존 작업이 있다면 먼저 읽기 전용으로 확인한다.

```powershell
$env:GIT_OPTIONAL_LOCKS = '0'
git -C '<기존 저장소 경로>' status --short
git -C '<기존 저장소 경로>' worktree list --porcelain
git -C '<기존 저장소 경로>' branch -vv
git -C '<기존 저장소 경로>' rev-parse HEAD
git -C '<기존 저장소 경로>' ls-remote origin refs/heads/feature/purchase-helper-enhancement
```

미커밋 변경, 진행 중 Git 작업, 예상 SHA 불일치가 있으면 기존 폴더를 변경하지 않는다. 가장 단순한 격리 복원은 **존재하지 않는 새 ASCII 경로**에 새 clone을 만드는 것이다. 대상 드라이브의 여유 공간과 네트워크 승인을 먼저 확인한다.

```powershell
$restore = 'D:\BOGUNON_DEV\BOGUNON-purchase-school-20261101'
if (Test-Path -LiteralPath $restore) { throw '새 경로가 필요합니다. 기존 폴더를 덮어쓰지 마세요.' }
git clone --single-branch --branch feature/purchase-helper-enhancement https://github.com/school-health-hub/BOGUNON_DESK.git $restore
if ($LASTEXITCODE -ne 0) { throw 'clone 실패' }
git -C $restore rev-parse HEAD
git -C $restore ls-remote origin refs/heads/feature/purchase-helper-enhancement
git -C $restore rev-list --left-right --count 'HEAD...@{upstream}'
git -C $restore status --short
```

종료 보고의 SHA와 clone HEAD가 다르면 원격이 이동했을 수 있다. 임의 reset/switch하지 말고 두 SHA와 차이를 보고한다. 이미 있는 저장소를 재사용할 때는 clean·작업 중단 여부를 확인하고 승인된 fetch 후 별도 신규 worktree를 사용한다. 같은 브랜치가 다른 worktree에 연결되어 있으면 강제로 가져오지 않는다. 검토용이면 `git worktree add --detach '<새 경로>' '<종료 보고 SHA>'`를 사용하고, 개발 재개에는 충돌 없는 별도 로컬 브랜치 이름을 명시적으로 정한다. 해당 복원 작업은 학교 PC에서 상태 확인 후 수행한다.

## B. 단계별 구현과 검증 상태

| 단계 | 실제 구현 | 검증된 범위 | 남은 검증 |
| --- | --- | --- | --- |
| Phase 1 | 파일 분석·계산·검산·차액/세액 안내·기존 출력 계약 | 기존 `purchase-helper-phase1.md`에 프런트·Rust 및 2026-10-26 실제 Windows Tauri PASS 기록 | 해당 과거 판정이 후속 UI 전체의 네이티브 PASS를 의미하지 않음 |
| Phase 2A-1 | 검토 필터·숨겨진 선택 안내 | 기존 2A 자동/브라우저 QA PASS 인정, 불필요한 재실행 없음 | 후속 통합 네이티브 확인 |
| Phase 2A-2 | Enter/Tab/Shift+Tab 확정, Escape 취소, 긴 품목명 dialog | 기존 자동/브라우저 QA PASS 인정 | 실제 한글 IME 및 OS 배율 |
| Phase 2A-3 | 선택 품목 일괄 편집·마지막 성공 1회 Undo·경합 방어 | 제품 `d12d76107e1166f0f6eb146a634a8f9d2eed3e67`, Windows CI 41276236590 PASS 및 기존 브라우저 QA PASS 인정 | Tauri/WebView2 및 실제 파일 경계 |
| Phase 2B-1 | 출력 전 미리보기·금액 기준 안내·한국어 표시 | 기존 Windows Actions 41289375307 SUCCESS 및 후속 UI QA 결과 인정. 당시 제품 `a43c028fd731ceae77e0105cea7dfe38359dad1d` | 실제 에듀파인 반입 성공은 미검증 |
| Phase 2B-2 | Rust 열 추천/근거/3상태·수동 매핑 우선·최신 응답 방어 | 과거 run 41295137228: TypeScript, Vitest 173, Rust 83, Cargo check, build PASS; GUI 68/69 | 새 run 41317332718 COMPLETED/SUCCESS. 상세 계수 아래 참조; 독립 화면 검토·네이티브 통합 NOT RUN |

저장 키·기존 `PurchaseItem`·CSV BOM/수식 방어·XLSX 숫자 셀·에듀파인 `내용/규격/수량/예상단가` 4열·기존 금액 계산은 유지 대상이다. OCR, 세션 영구 저장, 신규 출력, 물품관리/공문작업실 연계는 추가하지 않았다.

## C. 오늘 처리한 두 문제

### 템플릿 보존

기존의 엄격한 `normalizePurchaseImportTemplates`가 원격 설정 읽기·자동 동기화·계정별 scope 저장에도 쓰여 유효하지 않은 과거 기록을 제거할 수 있었다. 수정 목표는 **기존 형식의 원본 보존용 파싱/저장·전송**과 **분석에 실제 적용할 수 있는 템플릿 선별**을 분리하는 것이다. 기존 형식 변경, 사용자 데이터 마이그레이션, 자동 삭제·정리·재저장은 허용하지 않는다. 표현할 수 없는 손상 데이터는 안전하게 실패시켜 원본을 덮어쓰지 않아야 한다.

수정은 `preservePurchaseImportTemplates`로 기존 형식의 원본 값을 보존한다. 저장용 파싱에서는 trim·중복 제거·개수 제한을 하지 않으며, 값이 같은 저장 요청은 `setItem`을 하지 않아 기존 저장 문자열도 그대로 둔다. 표현할 수 없는 손상/추가 속성은 typed error로 store·scope·동기화 및 이후 자동 저장을 차단한다. 사용자 데이터 마이그레이션은 하지 않는다. `purchaseAnalysisTemplates`는 개별 안전 기록만 분석에 전달하고, 중복 및 20개 초과 기록은 Rust 충돌 검사가 가능하도록 보존한다. Dashboard는 해당 오류를 안내하면서 앱을 계속 사용할 수 있게 하며 숨은 정리는 하지 않는다.

회귀 테스트는 좁은 원격 adapter만 합성 대체하며 실제 계정 데이터에 접근하지 않는다. 기존의 일반적인 지원 불가 원격 envelope/version 처리 정책은 이번 변경 범위 밖이므로 보존 전체를 새 정책으로 확장했다고 주장하지 않는다. 제품 checkpoint는 `782134bff8368e6b0dba290ddc80aca4f1a760fc`이며 승인 범위의 제품·회귀 테스트 14개 파일만 포함한다. 정적 검사와 저장/전송/재조회·계정 sync 회귀를 포함한 새 Windows 실행은 **SUCCESS**이다. 학교 PC에서는 exact run의 JUnit·로그 및 Artifact를 확인해야 한다.

제품 checkpoint 수정 파일:

- `src/components/dashboard/DashboardCanvas.tsx`, `src/components/desktop/PurchaseHelperPanel.tsx`
- `src/purchase/purchaseImportSettings.ts`, `purchaseImportSettings.test.ts`, `purchaseRepository.ts`, `purchaseRepository.test.ts`
- `src/settings/accountSettings.ts`, `accountSettingsScope.ts`, `accountSettingsScope.test.ts`, `accountSyncService.ts`, `accountSyncService.test.ts`, `remoteAccountSettings.ts`, `remoteAccountSettings.test.ts`, `purchaseTemplateRemoteBoundary.test.ts`

QA 수정 파일은 `.github/workflows/purchase-phase2b2-windows.yml`, `qa/purchase-phase2b2/runner.ps1`, `qa/purchase-phase2b2/tests/mapping.spec.ts`에 한정한다. 기존 dependency lockfile·Rust·출력/계산 코드는 오늘 변경하지 않았다.
### Playwright 실패

기존 실패는 중복 열의 `<option disabled>`에 `toBeDisabled()`를 사용한 부분이었다. Playwright 1.56.1의 상태 검사 retarget이 implicit label의 control인 활성 `<select>`를 검사하는 소스 경로가 확인됐다. QA 수정은 native `option.disabled` 속성을 단언하고, 중복 index를 합성 주입해 경고·적용 버튼 차단·전송 0회를 함께 검증한다. 테스트 skip·삭제 없이 수동 수정/추천 재적용 검증을 유지한다. 제품 UI 수정은 이 진단만으로 필요하다고 판정하지 않았다.

소스 근거: https://github.com/microsoft/playwright/blob/v1.56.1/packages/injected/src/injectedScript.ts#L549-L568 및 #L642-L661. 새 Windows 실행 전에는 수정 GUI PASS를 주장하지 않는다.

## D. QA 실행과 증거

### 과거 실패 원본 — 보존

- 실행: https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41295137228
- 제품: `b679393b3dcec1affdbda13fb4b20a6e4bbca69e`
- Controller: `b2f208714eaf93c2d5e63dde227e9b722fb3e046`
- Artifact: `13079571316`, `purchase-phase2b2-windows-41295137228-1`
- 만료: **2026-11-15 10:12:34 UTC / 19:12:34 KST**
- Artifact API archive digest: `sha256:2811c9f17774672fb748229d8ab4a90dc02589adb4930789055adfce1b86d8b4` (원격 메타데이터이며 외부 ZIP 전체의 독립 다운로드 해시와 구분)
- 내부 manifest SHA-256 269건 일치, 제품 tracked 파일 654개 전후 동일, PNG 81개 원본 바이트로 보존
- GUI: 68 PASS / 1 FAIL. 실패한 테스트의 뒤쪽 단언은 실행되지 않았으며 skip으로 변경하지 않음

집 PC 원본 증거: `E:\BOGUNON_DEV\qa-output\purchase-phase2a3-20261101\evidence\phase2b2\run-41295137228`.
`artifact/evidence-sha256.json`, `artifact/workflow-evidence-sha256.json`이 참조하는 전체 로그·JUnit·Playwright JSON/HTML·스크린샷·trace·Rust fixture·before/after hash와 `derived-screens-inventory.json`, `local-preservation-sha256.json`이 연결된 원본을 보존한다. 개별 요약만으로 원본 증거가 모두 전달됐다고 간주하지 않는다.

### 오늘 Windows 검증

- 새 실행: https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41317332718 (**COMPLETED / SUCCESS**, 위 종료 시점 기준)
- 제품: `782134bff8368e6b0dba290ddc80aca4f1a760fc`
- QA controller: `03d61daf4605e2fc07c5ecd3f20cd8e30153df7b`
- Artifact: **13088327880**, `purchase-phase2b2-windows-41317332718-1`, **17,957,844바이트**
- 만료: **2026-11-15 14:58:01 UTC / 23:58:01 KST**
- 원격 archive digest: `sha256:1f4a62866b0d03f49a1c88cd07f0a697cad0021d4e8b8592da61d239ca7360b0` (API 메타데이터; 외부 ZIP 전체 독립 검증과 구분)
| 새 실행 검증 | 실제 결과 |
| --- | --- |
| 제품·QA TypeScript | PASS |
| Purchase Vitest | 182 PASS |
| 계정 settings/sync 회귀 Vitest | 63 PASS |
| Rust Purchase | 83 PASS |
| Cargo check | PASS |
| Production build | PASS |
| Playwright 브라우저 GUI | 69 PASS / 0 FAIL / 0 SKIP / 0 RETRY |

내부 manifest SHA-256 **115 + 118 = 233건 PASS**, 제품 tracked **668개** before/after 동일, PNG **81개** 원본 바이트 추출·보존. 새 E: 증거 경로는 `E:\BOGUNON_DEV\qa-output\purchase-phase2a3-20261101\evidence\phase2b2\closure-20261101\run-41317332718`이다. UI 기능 단언이 통과한 것과 별도 독립 육안 검토는 구분한다.
- 새 GUI 독립 화면 검토: **NOT RUN**. 원격 Playwright 완료 여부와 화면 증거를 학교에서 확인해야 한다.

Workflow: `.github/workflows/purchase-phase2b2-windows.yml`.
Runner: `qa/purchase-phase2b2/runner.ps1`.
제품을 실제 새 SHA로 고정 checkout한 뒤 TypeScript, Purchase Vitest, `src/settings` 계정 회귀, build, Rust purchase, cargo check, QA TypeScript, headed Chromium을 실행한다. controller gate·product hash·최소 contents:read·14일 Artifact·retries 0을 유지한다. 이전 SHA workflow를 신규 코드 PASS로 재사용하지 않는다.

**실행 게이트 제한:** 종료 인계서만 추가하는 마지막 commit은 QA 경로 trigger를 충족하지 않아 새 QA를 시작하지 않는다. 기존 workflow는 현재 feature HEAD와 QA-only controller delta를 검사하므로, 문서가 추가된 최종 HEAD에서 단순 dispatch/rerun하면 문서 경로 gate에 막힐 수 있다. gate를 임의 우회하거나 허용 경로를 조용히 넓히지 않았다. 검증 대상은 위 제품 `782134bff8368e6b0dba290ddc80aca4f1a760fc`, controller `03d61daf4605e2fc07c5ecd3f20cd8e30153df7b`, run `41317332718`의 정확한 조합이다. 학교에서는 먼저 이 결과와 복원을 확인하고 불필요하게 재실행하지 않는다. 향후 재실행이 필요하면 별도 승인으로 새 제품/controller pin을 갱신하거나 문서-only allowlist를 명시적으로 검토해야 한다. 읽기 전용 복원·코드/증거 inventory 확인에는 이 제한이 영향을 주지 않는다.
정확한 재현 명령은 runner에 보존돼 있다. 필요한 부분만 선택해 수행하며, 아래는 새 의존성 설치나 로컬 빌드에 대한 즉시 실행 지시가 아니다.

```text
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --no-cache src/purchase <Purchase*.test.tsx 명시 목록>
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --no-cache src/settings
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml purchase
cargo check --locked --manifest-path src-tauri/Cargo.toml
node <QA>/node_modules/@playwright/test/cli.js test --config playwright.config.ts --workers=1 --retries=0
```

전체 프런트 Vitest는 기존 PASS를 인정하며 이번 변경에 필요한 대상 회귀를 우선한다. 실제 새 실행이 더 넓게 수행했다면 최종 결과에 명시한다.

학교 PC에 기존 `gh`와 원격 접근 권한이 있을 때만, 만료 전 승인된 **새 경로**에 증거를 내려받을 수 있다. 이 명령은 기존 E: 원본을 학교에 복원했다는 증명이 아니다.

```powershell
$evidence = 'D:\BOGUNON_DEV\qa-evidence\purchase-41317332718'
if (Test-Path -LiteralPath $evidence) { throw '증거 대상은 존재하지 않는 새 경로여야 합니다.' }
# run 완료 및 아래 이름/ID 13088327880/만료일을 API 목록과 대조한다.
gh run view 41317332718 --repo school-health-hub/BOGUNON_DESK --json status,conclusion,headSha,url
gh api repos/school-health-hub/BOGUNON_DESK/actions/runs/41317332718/artifacts
gh run download 41317332718 --repo school-health-hub/BOGUNON_DESK --name 'purchase-phase2b2-windows-41317332718-1' --dir $evidence
```

다운로드 뒤 `evidence-sha256.json`과 `workflow-evidence-sha256.json`의 **모든 참조 파일** 존재·크기·SHA-256을 검증한다. HTML report의 참조 attachment/trace도 일부만 옮기지 말고 전체 상대 경로를 유지한다. manifest hash가 맞는 것과 원격 archive ZIP 해시를 독립 검증한 것은 구분한다.
### 버전과 독립 환경

- `package-lock.json`, `src-tauri/Cargo.lock`, 기존 QA `qa/purchase-phase2b1/package-lock.json`을 그대로 사용한다.
- 제품 lock 해석: TypeScript 6.0.3, Vitest 5.0.1, Vite 8.3.0, React/React DOM 19.3.0, Tauri API 2.11.1.
- QA: Playwright **1.56.1**, `@types/node` **22.18.6**. 과거 run은 Node **22.23.3**, Chromium **141.0.7390.37**을 기록했다. 새 실제 버전은 새 Artifact를 기준으로 한다.
- runner `windows-2022`, Node 22, 검증된 checksum의 NASM 3.02 및 Windows 네이티브 Perl. Rust toolchain 고정 파일은 없으므로 새 run의 `rust-version.txt`, `cargo-version.txt`, `native-prerequisites.json`을 보존한다.
- 로컬 node_modules/캐시/사용자 계정/인증/DB는 인계 의존성이 아니다. 학교 PC에서 도구 설치가 필요하면 별도 승인과 용량 확인 후 진행한다.

## E. 의존성 완결성·보안·저장 공간

| 필요한 항목 | 보존/접근 상태 | 학교 PC에서 확인할 것 |
| --- | --- | --- |
| 소스·테스트·QA controller·lockfile·설계·이 인계서 | 승인 feature 브랜치 checkpoint 대상; 실제 push·최종 원격 SHA는 종료 보고에서 확인 | clone HEAD/원격 SHA/clean/0:0, 필요한 파일 존재 |
| 실행 결과·RED/실패 및 새 GREEN 로그·trace·스크린샷·원본 hash/provenance | GitHub Actions Artifact와 집 PC E: 원본; Artifact는 표시된 보존기간 후 만료 예정 | 만료 전에 승인된 저장소에 내려받고 내부 manifest 전체 검증. 링크만으로 영구 보존이라 하지 않음 |
| `.omo/plans/purchase-phase2b2.md`, draft/evidence/실행 state | Git ignored, 집 PC에만 존재; 핵심 결정/차단/다음 단계는 본 문서에 재기록 | 이 ignored state 자체를 학교에서 있다고 가정하지 않음. 원본 복제가 꼭 필요하면 승인된 전송 필요 |
| E:의 과거 QA 복사본/의존성/개인 QA 기록 | 집 PC 전용, 삭제하지 않음; 학교로 자동 동기화 안 됨 | 다음 승인 단계는 tracked source+controller로 재현 가능하며 원본 증거는 Artifact에서 확보 |
| 계정 비밀값·사용자 DB·실제 파일 | 접근·전송하지 않음 | 합성 데이터만 사용; 비밀값은 변수 이름/재생성 절차만 기록 |
| 학교 PC runtime/복원 실행 | **NOT RUN** | 첫 단계는 read-only 상태·용량·도구 확인. 수신 PC 검증 전 HANDOFF READY로 단정하지 않음 |

보안 정적 검사에서 확인된 비밀값 문제는 없었다. 새 Artifact는 E:에 확보했고 내부 hash 233건을 검증했다. 새 증거의 빠른 텍스트 보안 검사 **57파일 PASS**(자격증명·개인정보 패턴 미검출)이며, 바이너리 152파일의 OCR 및 전체 육안 내용 검사는 **NOT RUN**이다. hash 일치나 패턴 미검출만으로 내용 안전성을 증명하지 않는다. 전용 gitleaks/trufflehog는 PATH에 없으며 .NET 정규식과 수동 텍스트/ZIP entry 검사를 사용한다. 바이너리 OCR 검사는 수행하지 않아 잔여 위험이 있다. tracked 파일만 검사하고 ignored 증거까지 안전하다고 추정하지 않는다. 증거는 합성 데이터만 사용하며 인증값·개인정보를 Git/Artifact에 추가하지 않는다. 원본 증거의 무분별한 force-add 금지.

집 PC C:는 이전 0바이트였고 오늘 시작 조회 약 1GiB였지만, 승인 제한을 유지해 C: 설치·빌드·GUI 및 임의 캐시/임시 파일 삭제를 하지 않는다. 기존 약 3.5KiB 합성 gate 임시 파일도 보존한다. E: 증거는 삭제하지 않는다. 저장 공간 복구는 별도 관리 작업이다. 최종 용량과 종료 프로세스 상태는 종료 보고에 기록한다.

## F. 학교 PC에서 이어 할 일과 금지사항

1. 학교 프로필의 실제 CODEX_HOME과 전역 `AGENTS.md`/`AGENTS.override.md` 및 로드된 지침 출처를 먼저 확인한다. 집 PC 정책이 자동 전파됐다고 가정하지 않으며, 이 작업에서는 전역 지침 설치·덮어쓰기를 하지 않는다. 이어 Git 원격 SHA와 학교의 기존 HEAD/upstream/status/worktree를 읽기 전용 확인한다.
2. 기존 변경·진행 중 Git 작업·브랜치 점유가 있으면 건드리지 말고 새 경로 복원 여부를 정한다.
3. `gh run view 41317332718 --repo school-health-hub/BOGUNON_DESK --json status,conclusion,headSha,url`로 **이 exact run**의 완료 여부를 확인한다. 실패/미완료이면 원인과 미완료 범위를 기록한다. 완료 후 Artifact API에서 실제 ID·만료일을 확인하고 전체 증거를 확보·해시 검증한다. 새 결과를 확인하기 전 Phase 2B-2 PASS로 판정하지 않는다.
4. 실패/NOT RUN/수신 PC 환경 차이에 필요한 테스트만 실행한다. 새 수정 없이 기존 PASS 전체를 반복하지 않는다.
5. 템플릿 보존과 GUI 차단 문제가 모두 검증됐는지, 네이티브 통합과 구분하여 Phase 2B-2 완료 여부를 판정한다.
6. 완료 판정 이후에만 기존 계획의 Phase 2B-3 후보를 검토한다. 이 인계는 신규 기능 구현 승인이 아니다.

손상된 템플릿이 차단된 경우의 수동 복구는 별도 승인 작업이다. 원본 백업·명시적 확인 없이 템플릿을 자동 변환하거나 마이그레이션하지 않는다.

남은 네이티브 통합 QA: Tauri/WebView2, 실제 파일 선택/가져오기/저장 및 mapping IPC, 실제 계정 동기화 경계의 비파괴 합성 검증, OS 클립보드, 실제 한글 IME, 125%·150% Windows 배율, 실제 에듀파인 반입. 브라우저 viewport 1440×900/1024×768/980×700은 OS 배율이나 WebView2 검증을 대신하지 않는다.

다른 worktree 덮어쓰기·정리·prune, reset/clean/stash/강제 switch, main 무단 병합, PR/배포/force push, 사용자 데이터 초기화, 기존 템플릿 자동 정리·마이그레이션, 실패 테스트 무시, 이전 SHA QA를 신규 PASS로 사용하는 행위를 금지한다. 활성 다른 세션은 중지/강제 종료하지 않는다. 전체 worktree 읽기 전용 감사의 확인 가능 범위와 경고는 최종 종료 보고에 남긴다.

## G. 다른 작업 보호 — 초기 읽기 전용 감사

28개 worktree가 등록되어 있고 27개 경로가 존재한다. 1개는 기존 경로 누락/prunable 표시지만 삭제·prune하지 않았다. 다른 작업에서 미커밋 변경이 관측됐다: 주 저장소 1개, newsletter 40개, documents 1개, update-candidate 3,717개 및 `MERGE_HEAD`. 이들은 기존 또는 동시 작업 상태이며 Purchase 정리 대상으로 삼지 않는다. 개인정보가 포함될 수 있는 구체 untracked 파일명은 이 문서에 옮기지 않는다. 정확한 초기/최종 inventory는 E: 종료 증거에서 확인한다.

Purchase 관련 열린 PR은 없었으며, 다른 열린 PR 30/29/26은 이 작업에서 변경하지 않았다. 등록 정보·작업 상태는 감사 중에도 다른 세션에 의해 바뀔 수 있으므로, 초기/최종 차이가 있으면 Purchase가 변경했다고 추정하거나 되돌리지 말고 확인 가능한 범위로 보고한다. 과거 run의 로컬 증거 240개, 43,157,257바이트는 inventory hash와 일치한다. 종료 읽기 전용 재확인에서 Purchase 외 27개 등록 항목의 경로 존재 여부·HEAD·브랜치·status 출력 SHA-256은 초기와 같았다. 이미 dirty인 파일 내용 자체의 해시는 수집하지 않았으므로 다른 세션의 동일-status 내용 변경까지 바이트 단위로 불변이라고 증명하지는 않는다. 위 dirty 상태와 MERGE_HEAD는 그대로 두었다.
