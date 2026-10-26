# Purchase Helper Phase 1 QA 및 PC 인계

작성일: 2026-10-23
최종 갱신일: 2026-10-26
저장소: `school-health-hub/BOGUNON_DESK`
브랜치: `feature/purchase-helper-enhancement`
구현 체크포인트: `888917b8b35b679ac7e406a0b89c9b0425282ce9`
Phase 1 완료 기록 기준: `393f9cbc9e0b777c5e90454436bafcf013591915`

이 문서는 Phase 1 구현, 자동 검증, 실제 Windows Tauri 화면 QA와 후속 Phase 2 설계 준비를 인계하기 위한 기록이다. Phase 1은 승인된 범위에서 최종 PASS했지만, 이 문서는 병합 또는 배포 승인 문서가 아니다.

## 1. Phase 1 구현 범위

- 기존 `PurchaseItem` 및 Purchase 출력 계약을 유지하면서 수량, 단가, 원본 금액의 계산과 검산 정보를 보강했다.
- 금액 불일치 원인, 차액, 확인 상태를 사용자가 확인할 수 있도록 했다.
- 기존 정산 모델과 호환되는 선택적 부가세 모드를 추가했다.
  - `unspecified`: 세액 미지정
  - `included`: 세액 포함, 총액에 추가하지 않음
  - `excluded`: 사용자가 명시한 세액만 최종 결제금액에 추가
  - `exempt`: 면세, 추가 세액 없음
- 세액 자동 10% 계산, 공급가액 역산, 배송비 과세 추정은 하지 않는다.
- 기존 배송비 및 할인 계산 방식을 유지했다.
- 기존 CSV, XLSX, 클립보드 및 에듀파인 4열 XLSX 출력 계약을 변경하지 않았다.
- 별도 세액 때문에 화면 최종 결제금액과 기존 출력 기준 금액이 달라질 때 차이를 알리고 오해 가능성이 있는 출력을 차단하도록 했다.
- OCR, 신규 K-에듀파인 복사 형식, PDF 생성 및 영구 저장은 Phase 1 범위에 포함하지 않았다.

## 2. 검증 결과

### 2.1 이전 프런트 검증 기록

다음 결과는 Phase 1 구현 직후 학교 PC의 Purchase 전용 worktree에서 실행해 확인한 기록이다. 이번 인계 문서 작성 시 다시 실행하지 않았다.

| 검증 | 결과 |
| --- | --- |
| Purchase 프런트 대상 테스트 | 56 PASS |
| 전체 프런트 테스트 | 1,204 PASS |
| TypeScript 검사 | PASS |
| Vite build | PASS |

### 2.2 2026-10-23 Windows Rust 검증

학교 PC의 Windows 네이티브 환경에서 아래 명령을 `--offline --locked` 조건으로 직접 실행했다.

| 검증 | 관측 결과 |
| --- | --- |
| Purchase Rust 대상 테스트 | 64 passed, 0 failed, 240 filtered out |
| 전체 Rust 테스트 | 303 passed, 0 failed, 1 ignored |
| Cargo check | PASS |
| 실제 Windows Tauri 화면 QA | 2026-10-26 PASS |

전체 Rust 테스트의 ignored 항목은 명시적인 GitHub-hosted Windows 격리 fixture이다. SQLCipher의 잘못된 키 및 손상 데이터 거부 테스트가 예상 오류 로그를 출력했지만 관련 테스트는 PASS했다.

비차단 경고는 다음과 같았다.

- OpenSSL 정적 라이브러리의 `ossl_static.pdb` 부재에 따른 MSVC `LNK4099` 경고
- MY FINANCE 모듈의 기존 미사용 메서드 경고 2건

## 3. Windows 빌드 환경

학교 PC에서 성공한 도구 조합은 다음과 같다.

- Strawberry Perl 5.42.3 portable
- NASM 2.16.01
- MSVC linker 14.51.36260.0
- Windows SDK 10.0.26100
- Rust/Cargo 1.98.1

집 PC에서는 같은 도구의 설치 및 동작 여부가 아직 검증되지 않았다. 프로젝트에는 `rust-toolchain` 고정 파일이 없으므로, 재검증 전에 `rustc -Vv`와 `cargo -V`를 기록한다.

### 3.1 프로세스 한정 환경 구성 원칙

1. Strawberry Perl의 `perl\\bin`과 `c\\bin`을 현재 PowerShell 하위 프로세스의 `PATH` 앞에만 배치한다.
2. `LC_ALL`과 `LANG`은 해당 하위 프로세스에서만 제거한다.
3. `vcvars64.bat`가 출력하는 환경 중 MSVC 빌드에 필요한 항목만 현재 프로세스에 적용한다.
4. 시스템 또는 사용자 환경 변수는 영구 변경하지 않는다.
5. Cargo는 기존 lockfile과 캐시를 사용해 `--offline --locked`로 실행한다.

다음 예시는 개인 경로를 포함하지 않는다. 자리표시자를 집 PC의 실제 설치 위치로 바꾼다.

```powershell
$strawberryRoot = '<STRAWBERRY_ROOT>'
$vcvars64 = '<VCVARS64_PATH>'

$vcEnvironment = & cmd.exe /d /c ('call "' + $vcvars64 + '" >nul && set')
if ($LASTEXITCODE -ne 0) {
    throw 'vcvars64.bat environment export failed'
}

$buildEnvironmentNames = @(
    'PATH', 'INCLUDE', 'LIB', 'LIBPATH',
    'VCToolsInstallDir', 'VCINSTALLDIR',
    'WindowsSdkDir', 'WindowsSDKVersion', 'WindowsSDKLibVersion',
    'WindowsLibPath', 'UCRTVersion', 'UniversalCRTSdkDir',
    'ExtensionSdkDir', 'FrameworkDir', 'FrameworkVersion', 'FrameworkVersion64'
)

foreach ($line in $vcEnvironment) {
    $separator = $line.IndexOf('=')
    if ($separator -le 0) {
        continue
    }

    $name = $line.Substring(0, $separator)
    if ($buildEnvironmentNames -contains $name) {
        [Environment]::SetEnvironmentVariable(
            $name,
            $line.Substring($separator + 1),
            'Process'
        )
    }
}

$env:PATH = "$strawberryRoot\\perl\\bin;$strawberryRoot\\c\\bin;$env:PATH"
Remove-Item Env:LC_ALL -ErrorAction SilentlyContinue
Remove-Item Env:LANG -ErrorAction SilentlyContinue
```

사전 도구 확인:

```powershell
perl -MLocale::Maketext::Simple -MCwd -MDigest::SHA -MIPC::Cmd -e "print qq(PASS\\n)"
nasm -v
Get-Command cl.exe, link.exe, nmake.exe, rc.exe, rustc.exe, cargo.exe
rustc -Vv
cargo -V
```

Rust 검증 순서:

```powershell
cargo test --offline --locked --manifest-path src-tauri/Cargo.toml purchase_helper
cargo test --offline --locked --manifest-path src-tauri/Cargo.toml
cargo check --offline --locked --manifest-path src-tauri/Cargo.toml
```

첫 명령이 실패하면 뒤 명령을 실행하지 않고 환경, 의존성 또는 코드 실패로 분류한다. 긴 `cmd.exe` 결합 명령으로 모든 확인과 Cargo 실행을 한 번에 연결하지 않는다.

## 4. 집 PC 복원 절차

집 PC에서는 아래 항목을 아직 실행하거나 검증하지 않았다.

### 4.1 기존 작업 보호 및 원격 확인

```powershell
git status --short
git remote -v
git fetch origin
git ls-remote origin refs/heads/feature/purchase-helper-enhancement
```

기존 로컬 변경이 있다면 reset, clean, checkout 또는 stash를 자동 실행하지 않는다. 먼저 변경 파일과 현재 브랜치를 기록하고 별도 보존 방법을 결정한다.

### 4.2 Purchase 전용 worktree 선택

```powershell
git worktree list --porcelain
git branch --list feature/purchase-helper-enhancement
```

이미 Purchase 전용 worktree가 있으면 그 경로와 상태를 확인해 재사용한다. 로컬 브랜치가 있지만 다른 worktree에서 사용 중이라면 새 checkout을 강제로 만들지 않는다.

전용 worktree와 로컬 브랜치가 모두 없을 때만 저장소 루트에서 다음과 같이 생성한다.

```powershell
git worktree add --track -b feature/purchase-helper-enhancement <PURCHASE_WORKTREE> origin/feature/purchase-helper-enhancement
```

### 4.3 의존성 및 네이티브 도구 확인

```powershell
Set-Location <PURCHASE_WORKTREE>
node --version
npm --version
Test-Path package-lock.json
Test-Path src-tauri/Cargo.lock
```

`node_modules`가 없고 lockfile과 디스크 공간이 정상이라면 프로젝트 정책에 따라 `npm ci`를 사용한다. 패키지 버전을 임의로 업그레이드하지 않는다.

Strawberry Perl, NASM, Visual Studio MSVC, Windows SDK 및 Rust/Cargo 준비 상태를 3절의 사전 도구 명령으로 확인한다. 새 설치 또는 시스템 PATH 변경이 필요하면 별도 승인을 받는다.

### 4.4 검증 재실행

1. Purchase 프런트 대상 테스트
2. 전체 프런트 테스트
3. TypeScript 검사
4. Vite build
5. Purchase Rust 대상 테스트
6. 전체 Rust 테스트
7. `cargo check --offline --locked`

정확한 npm script 이름은 집 PC에서 현재 `package.json`을 읽어 확인한다. 학교 PC의 성공 기록을 집 PC 성공으로 간주하지 않는다.

## 5. 2026-10-26 실제 Windows Tauri QA

Purchase 전용 worktree의 개발 바이너리를 실제 Windows Tauri 앱으로 실행해 합성 데이터만으로 검증했다. 기존 설치본과 단일 인스턴스 충돌 없이 개발 바이너리 경로와 PID를 확인했으며, QA 종료 후 앱과 개발 서버를 정상 종료하고 포트 해제 및 Git 보존을 확인했다.

### 5.1 기능 및 출력 결과

- 품목 입력과 수정, 수량 × 단가 계산, 원본 금액 불일치 표시가 정상 동작했다.
- 배송비, 할인, 실제 수량·단가와 정산 차액 표시가 정상 동작했다.
- `unspecified`, `included`, `excluded`, `exempt` 부가세 모드가 승인된 정책대로 동작했다.
- `excluded`에서 명시 세액이 있으면 기존 출력 기준액과 화면 최종금액을 구분하고, 기존 복사 및 XLSX 출력을 안전하게 차단했다.
- 합성 데이터 `3 × 12,500원 = 37,500원`, 배송비 `2,500원`, 할인 `500원`, 별도 세액 `1,000원`에서 기존 출력 기준액 `39,500원`, 화면 최종금액 `40,500원`을 확인했다.
- CSV, 기존 XLSX 및 에듀파인 4열 XLSX의 헤더와 셀 값을 확인해 기존 출력 계약이 유지됨을 확인했다.
- 품의문과 품목표 클립보드 복사 성공 알림을 확인했다.
- 일반 창과 약 1100×932 작은 창에서 경고, 입력 필드, 표, 출력 버튼이 잘림이나 겹침 없이 표시됐다.
- 실제 K-에듀파인 시스템 반입은 수행하지 않았다. 4열 XLSX 생성 계약 검증과 실제 시스템 반입 성공은 구분한다.

Phase 1 자동 검증과 실제 화면 QA의 최종 결과는 다음과 같다.

| 검증 | 최종 기록 |
| --- | --- |
| Purchase 프런트 대상 테스트 | 56 PASS |
| 전체 프런트 테스트 | 1,204 PASS |
| TypeScript 검사 / Vite build | PASS / PASS |
| Purchase Rust 대상 테스트 | 64 PASS |
| 전체 Rust 테스트 | 303 PASS / 1 ignored |
| `cargo check --offline --locked` | PASS |
| Windows Tauri 실제 화면 QA | PASS |

### 5.2 시각 증거와 보존 범위

2026-10-26 학교 PC의 별도 임시 QA 폴더에서 다음 캡처를 생성하고 원본 이미지를 직접 열어 확인했다.

| 증거 | SHA-256 | 상태 |
| --- | --- | --- |
| `01-tax-excluded-output-blocked.png` | `F79D6A21C0E6E289A5F589C5B9377095B46414FCAEADBFFAD5DD4BDB3EDFDE66` | 유효: 일반 창에서 부가세 별도, 두 합계, 경고, 비활성 출력 버튼 확인 |
| `02-tax-excluded-small-window.png` | `D0FF0690B59DFD2AD08DB99BBB27D9ED1C1B02C789F7FE78918C12E3BD379C5D` | 유효: 약 1100×932 작은 창에서 동일 상태 확인 |

이 이미지 파일은 학교 PC의 임시 폴더에만 있고 Git 또는 원격 저장소에 보존되지 않았다. 따라서 이 문서의 해시는 provenance 기록이며, 원격에서 이미지를 복원할 수 있다는 의미가 아니다. 기존 `04-tax-excluded-blocked.png`는 잘못된 화면이므로 유효 증거에서 제외한다.

독립 읽기 전용 시각 검토 두 건은 모두 높은 신뢰도로 PASS했으며 차단 항목은 없었다. 잔여 P3 개선 사항은 다음과 같다.

- 긴 품목명의 전체 값을 즉시 확인하는 방법
- disabled 버튼과 보조 문구의 대비
- 최대화 화면에서 품명 등 열 너비 활용
- 최소 창 크기와 Windows 125%·150% 배율 QA

## 6. Phase 2 설계 준비: 현행 업무 흐름

Phase 2 범위는 아직 승인 또는 확정되지 않았다. 아래 내용은 현재 구현을 기준으로 반복 작업과 개선 후보를 식별한 사전 조사다.

### 6.1 주요 코드 경계

- 화면 오케스트레이션: `src/components/desktop/PurchaseHelperPanel.tsx`
- 품의문 편집: `src/components/desktop/PurchaseDraftEditor.tsx`
- 구매결과·정산: `src/components/desktop/PurchaseSettlementEditor.tsx`
- 타입과 출력 계약: `src/purchase/types.ts`
- 품목 검산·출력 준비 상태: `src/purchase/purchaseDomain.ts`
- 품의문 생성: `src/purchase/purchaseDraft.ts`
- 정산 계산과 복사 데이터: `src/purchase/purchaseSettlement.ts`
- Tauri IPC 어댑터: `src/purchase/purchaseRepository.ts`
- 파일 분석 및 CSV/XLSX/에듀파인 출력: `src-tauri/src/purchase_helper.rs`
- 구매결과 XLSX 출력: `src-tauri/src/purchase_settlement.rs`

### 6.2 단계별 현행 분석

| 단계 | 현재 기능과 사용자 조작 | 반복 입력·자동화 가능 부분 | 계약 의존성·UI 후보·데이터 주의점 |
| --- | --- | --- | --- |
| 1. 파일 가져오기 및 열 매핑 | 사용자가 파일을 선택한다. XLSX/XLS/CSV와 텍스트형 PDF를 로컬에서 분석하며, 헤더 자동 탐지가 실패하면 머리글 행과 `품명·규격·수량·단가·금액·구매처·비고·예산항목` 열을 지정한다. 같은 헤더 서명은 가져오기 템플릿으로 저장할 수 있다. PNG/JPG 및 스캔 PDF OCR은 미지원이다. | 유사 헤더 별칭 확장, 최근 성공 매핑 추천, 매핑 미리보기와 신뢰도 표시, 여러 시트 선택 보조가 후보이다. | `PurchaseColumnMapping`, 저장 키 `school-health-desk.purchase-import-templates.v1`, 기존 Tauri 명령 payload를 유지해야 한다. 파일은 로컬 분석만 하고 외부 AI/OCR로 전송하지 않는다. 파일당 15MB, 전체 30MB, 품목 500개 및 스프레드시트 자원 제한을 보존한다. |
| 2. 품목 검토·수정 | 사용자가 선택 여부와 품명, 규격, 수량, 단가, 구매처, 비고, 예산항목을 표에서 수정한다. 수량×단가와 원본 금액이 다르면 차액을 보고 확인 처리한다. 출력 열 순서도 직접 조정한다. | 빈 값·오류 행만 모아보기, 일괄 구매처/예산항목 적용, 긴 품목명 전체 보기, 키보드 중심 편집, 중복 품목 병합 제안이 후보이다. | `PurchaseItem`, `PurchaseAmountCheck`, `resolvePurchaseAmount`, `getPurchaseOutputReadiness`와 기본 7열 출력 계약을 변경하면 기존 CSV/XLSX/클립보드에 영향이 간다. 원본 금액은 자동 덮어쓰지 않고 사용자 확인 기록을 유지해야 한다. |
| 3. 구매 품의문 생성 | 선택 품목을 바탕으로 제목, 목적, 구매내용, 구매처, 예산항목, 추가 문구와 붙임 문구를 편집한다. 본문 항목 순서를 바꾸고 템플릿을 최대 10개까지 저장하며, 품의문 또는 품의문+품목표를 복사한다. | 가져온 품목의 공통 구매처·예산항목 자동 제안은 이미 있다. 학교별 자주 쓰는 문구 프리셋, 필수 항목 누락 안내, 복사 전 최종 미리보기 강화가 후보이다. | 저장 키 `school-health-desk.purchase-draft-templates.v1`, `PurchaseDraftTemplate` placeholder와 기존 클립보드 text/html 구조를 유지해야 한다. 초안과 품목은 현재 실행 메모리에만 있고 외부 전송하지 않는다. |
| 4. 실제 구매 결과 입력 | 검산을 통과한 품목만 구매결과 단계로 이동한다. 초기 실제 수량·단가는 품의 값에서 복사되고 사용자가 상태, 실제 수량, 실제 단가, 비고를 수정한다. | 품의 대비 변경된 셀 강조는 이미 있다. 전체 구매완료 처리, 선택 행 일괄 상태 변경, 실제 단가 일괄 반영, 영수증 값과의 로컬 대조가 후보이다. | `PurchaseSettlementItem`과 `reconcilePurchaseSettlement`이 품목 ID로 연결한다. 현재 실행 중 메모리 상태이며 영구 저장을 추가하려면 별도 데이터 보존·마이그레이션 승인이 필요하다. |
| 5. 정산·차액 확인 | 사용자가 배송비, 할인, 부가세 모드와 명시 세액, 조정 메모를 입력한다. 화면은 품의금액, 상품 실제금액, 기존 출력 기준액, 세액 포함 최종금액과 차액을 표시한다. | 배송비·할인 입력 중 즉시 설명, 차액 원인별 요약, 사용자 확인 체크리스트, 정산 항목 일괄 초기화가 후보이다. 세액 자동 10% 계산이나 공급가액 역산은 후보에서 제외한다. | `PurchaseSettlement.tax`는 선택 필드이고 없는 기존 데이터는 `unspecified`로 처리한다. `excluded` 세액으로 화면과 기존 출력 금액이 다르면 기존 복사/XLSX를 계속 차단해야 한다. 배송비 과세 여부를 자동 추정하지 않는다. |
| 6. CSV/XLSX/클립보드 출력 | 사용자가 출력 열을 선택·정렬하고 표 복사, CSV, XLSX를 실행한다. 구매결과에서는 표 복사, 정산 요약 복사, 별도 구매결과 XLSX를 실행한다. | 출력 전 포함 열·행·합계 미리보기, 파일명 제안, 최근 출력 설정 표시가 후보이다. | 기존 헤더, 열 순서 설정 키 `school-health-desk.purchase-output-columns`, Tauri 명령과 payload를 보존한다. CSV의 BOM·수식 주입 방어와 XLSX 숫자 셀을 유지한다. 별도 세액 포함 신규 출력은 별도 계약으로 설계해야 한다. |
| 7. K-에듀파인 4열 출력 | 선택 품목을 `내용·규격·수량·예상단가` 4열 XLSX로 저장한다. 수량과 단가를 숫자 셀로 기록한다. | 저장 전 정확한 4열 미리보기와 실제 반입 결과를 사용자가 기록하는 확인 절차가 후보이다. | `save_purchase_edufine_export`의 4열 순서와 의미를 변경하지 않는다. 실제 K-에듀파인 반입은 미검증이므로 “지원 확정”으로 표현하지 않으며, 신규 복사·자동 입력은 실제 테스트와 별도 승인이 필요하다. |

### 6.3 Phase 2 개선 후보 우선순위 제안

1. **P1 — 검토 효율**: 오류·불일치 행 필터, 긴 품목명 전체 보기, 키보드 편집과 일괄 구매처/예산항목 적용. 기존 모델과 출력 계약을 바꾸지 않고 반복 입력을 줄일 수 있다.
2. **P1 — 출력 안전성**: CSV/XLSX/클립보드/에듀파인 4열의 사전 미리보기와 계약별 금액 기준 설명. 별도 세액 차단 규칙을 한 화면에서 확인할 수 있어 오해를 줄인다.
3. **P2 — 가져오기 보조**: 매핑 신뢰도, 최근 성공 템플릿 추천, 여러 시트 선택 개선. 기존 로컬 파서와 템플릿 키를 재사용한다.
4. **P2 — 구매결과 입력 단축**: 일괄 상태 변경과 변경값 중심 정산 요약. `PurchaseSettlement` 호환성을 유지한다.
5. **P3 — 시각·접근성**: disabled/보조 문구 대비, 최대화 열 폭, 최소 창 및 고배율 대응.
6. **별도 승인 필요**: 로컬 OCR, 실제 K-에듀파인 반입·복사 자동화, 세액 포함 신규 출력, 영구 저장. 개인정보·구매자료 처리, 새 의존성, 데이터 마이그레이션 또는 외부 시스템 계약 검증이 선행돼야 한다.

## 7. 현재 인계 및 승인 상태

- Phase 1 구현과 자동 검증: **PASS**
- 실제 Windows Tauri 화면 QA: **PASS**
- 차단 결함: 없음
- 실제 K-에듀파인 시스템 반입: **NOT RUN**
- 학교 PC 임시 시각 증거의 원격 보존: **미수행**
- Phase 2: 현행 분석과 후보 제안만 완료했으며 범위는 미확정

소스, 테스트, 자동 검증 기록과 이 문서는 원격 feature 브랜치에서 복원할 수 있다. 임시 화면 캡처는 원격 복원 대상이 아니므로 별도 증거 보존이 필요할 경우 사용자 승인 하에 안전한 전달 방식을 정해야 한다. 다음 단계는 Phase 2 범위와 우선순위, 실제 K-에듀파인 반입 검증 여부, 로컬 OCR·영구 저장·신규 출력 중 별도 검토할 항목을 사용자가 승인하는 것이다.
