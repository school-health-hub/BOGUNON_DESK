# Purchase Helper Phase 1 QA 및 PC 인계

작성일: 2026-10-23
저장소: `school-health-hub/BOGUNON_DESK`
브랜치: `feature/purchase-helper-enhancement`
구현 체크포인트: `888917b8b35b679ac7e406a0b89c9b0425282ce9`

이 문서는 Phase 1 구현과 자동 검증 상태를 학교 PC에서 집 PC로 인계하기 위한 기록이다. Phase 1 최종 병합 또는 배포 승인 문서가 아니며, 실제 Windows Tauri 화면 QA는 별도 승인 후 수행한다.

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
| 실제 Windows Tauri 화면 QA | 미실행 |

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

## 5. 다음 승인 단계: Windows Tauri 화면 QA

실제 앱 실행은 이 인계 단계에서 수행하지 않았다. 별도 승인을 받은 뒤 다음 항목을 Windows Tauri 화면에서 확인한다.

- 품목별 수량 × 단가 계산
- 배송비와 할인 반영
- `unspecified`, `included`, `excluded`, `exempt` 부가세 모드
- 원본 금액과 계산 금액의 불일치 원인, 차액 및 확인 상태
- 화면 최종 결제금액과 기존 출력 기준 금액의 구분
- CSV/XLSX 출력
- 에듀파인 4열 XLSX 출력 계약
- 클립보드 복사
- 세액 차이 또는 품목 오류가 있을 때 출력 준비 상태와 안전 차단
- 기존 데이터 및 설정을 불러왔을 때의 호환성

화면 QA 중 실제 학생, 환자 또는 구매 개인정보를 사용하지 않는다. 합성 fixture만 사용하고 외부 AI 또는 OCR API로 구매자료를 전송하지 않는다.

## 6. 현재 인계 판정

소스와 자동 검증 결과는 원격 브랜치로 복원할 수 있다. 다만 집 PC 네이티브 도구 준비 상태와 실제 Windows Tauri 화면 동작은 아직 검증되지 않았다. 이 문서가 원격에 저장된 뒤 인계 상태는 **READY for resume**이며, Phase 1 최종 승인 상태는 화면 QA 완료 전까지 **PARTIAL**이다.
