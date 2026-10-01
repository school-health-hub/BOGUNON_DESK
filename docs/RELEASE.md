# Windows 공유 베타 release

## Prerequisites

- Windows 10/11 x64
- Node.js와 npm
- Rust stable MSVC toolchain과 Cargo
- Tauri 2가 요구하는 Microsoft C++ build tools와 WebView2 build 환경
- NSIS bundle을 만들 수 있는 network/build 환경

최종 사용자는 위 개발 도구가 필요하지 않습니다.

## 공개 환경 설정

`.env.local` 또는 process environment에 아래 공개 client 설정이 필요합니다.

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

URL은 `https`만 허용합니다. key는 `sb_publishable_` 또는 legacy `anon` JWT만 허용하며, secret/service-role key는 절대 사용하지 않습니다. `.env.local`과 실제 값은 commit하거나 release 문서에 기록하지 않습니다.

## Build

### 일반 QA build

```bash
npm run release:check
npm run release:windows
```

`release:check`는 `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`의 version 일치와 공개 Supabase 설정을 검사합니다.

`release:windows`는 preflight, TS/Rust tests, typecheck, frontend build, cargo check, whitespace check, `x86_64-pc-windows-msvc` Tauri NSIS build, artifact 수집을 순서대로 실행합니다. 어느 단계든 실패하면 성공 artifact로 보고하지 않습니다.

이 경로는 clean-install QA용이며 updater signing key를 요구하지 않습니다.

### Signed updater release build

Updater release는 별도 경로를 사용합니다.

```bash
npm run release:updater
```

다음 environment variable 이름이 필요합니다. 실제 값은 source, 문서, 로그에 기록하지 않습니다.

- `TAURI_SIGNING_PRIVATE_KEY` 또는 `TAURI_SIGNING_PRIVATE_KEY_PATH`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `RELEASE_PUBLISHED_AT` — UTC RFC3339, 예: `YYYY-MM-DDTHH:mm:ss.sssZ`

`TAURI_SIGNING_PRIVATE_KEY`는 Tauri가 지원하는 key 내용 또는 key 파일 경로를 받을 수 있습니다. `TAURI_SIGNING_PRIVATE_KEY_PATH`를 사용하면 build wrapper가 파일을 읽지 않고 그 경로를 공식 variable로 전달합니다. Release-only config overlay만 `bundle.createUpdaterArtifacts`를 활성화하며 일반 QA build는 영향을 받지 않습니다.

Release notes는 version control에서 검토 가능한 `release/release-notes.json`의 `notes` 배열을 사용합니다. Version은 `package.json`에서 읽고, publish 시각은 release 실행자가 명시합니다.

## Output

Tauri 원본 bundle은 `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`에 유지됩니다. 공유 파일은 다음 구조로 복사됩니다.

```text
release-output/
  BOGUNON-DESK-<version>-Windows-x64-Setup.exe
  SHA256SUMS.txt
  README-FIRST.txt
```

NSIS 후보가 정확히 하나가 아니거나 `release-output/`에 현재 공유본 외 파일이 남아 있으면 수집 script는 실패합니다.

Signed updater release의 output contract는 정확히 다음 여섯 파일입니다.

```text
release-output/
  BOGUNON-DESK-<version>-Windows-x64-Setup.exe
  BOGUNON-DESK-<version>-Windows-x64-Setup.exe.sig
  SHA256SUMS.txt
  README-FIRST.txt
  latest.json
  release-metadata.json
```

`latest.json`의 `signature`에는 `.sig` URL이 아니라 `.sig` 파일 내용이 들어갑니다. `release-metadata.json`은 향후 `/desk` 공개 페이지가 installer URL, version, release notes, SHA256, byte size를 같은 canonical release 정보에서 읽기 위한 파일입니다. 현재 updater channel의 실제 사용 가능 여부는 public hosting 단계가 완료되어야 확정됩니다.

Publish 순서는 다음과 같습니다.

1. Version directory에 installer, `.sig`, checksum, 안내 및 metadata를 먼저 업로드
2. Remote bytes, URL, checksum을 검증
3. 모든 검증 후 `latest.json`을 마지막으로 교체

이 순서를 지켜 updater가 아직 업로드되지 않았거나 검증되지 않은 installer를 가리키지 않게 합니다.

## Protected production updater workflow

`.github/workflows/windows-updater-release.yml`의 **Windows updater production release** workflow는 `workflow_dispatch`로만 실행하며, `main` ref가 아니면 즉시 중단합니다. 실행 전에 version bump와 `release/release-notes.json` 변경이 review를 거쳐 `main`에 merge되어 있어야 합니다. Dispatch의 `version`은 새 값을 만드는 입력이 아니라, `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`에 이미 기록된 동일 version을 확인하는 guard입니다.

Workflow job은 GitHub Environment `desktop-production-release`를 사용합니다. 이 Environment의 **Deployment branches and tags**는 반드시 **Selected branches and tags**로 설정하고, 허용 branch는 `main` 하나로 제한합니다. 이는 `workflow_dispatch` 전용 trigger와 workflow 내부 `refs/heads/main` runtime guard에 더하는 필수 defense-in-depth 통제입니다.

Repository의 GitHub plan/UI가 **Required reviewers**를 지원하면 **Settings → Environments → desktop-production-release → Required reviewers**에서 release 승인자 한 명 이상을 추가 manual confirmation으로 설정합니다. Private repository에서 이 기능이 제공되지 않는 경우 release blocker로 간주하지 않습니다. 필수 통제는 `workflow_dispatch` only, Environment의 `main` branch 제한, runtime `refs/heads/main` guard입니다. GitHub 권한은 `contents: read`만 사용하며 tag, GitHub Release, source commit을 만들지 않습니다.

Actions repository variables에는 기존 공개 client 설정만 둡니다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Protected environment에는 다음 secret 이름이 필요합니다. 실제 값, key path, password는 source나 문서에 기록하지 않습니다.

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `SUPABASE_RELEASE_STORAGE_KEY`

`SUPABASE_RELEASE_STORAGE_KEY`는 privileged **server-side Storage publishing credential**이며 GitHub Environment의 secret store에만 둡니다. 이는 `VITE_SUPABASE_PUBLISHABLE_KEY`나 anon key가 아니며 desktop app credential로 사용하면 안 됩니다. Protected publisher step의 request header 외에는 전달하지 않고 Desktop bundle, Vite variable, artifact, log, manifest에 포함하면 안 됩니다. 이 workflow를 위해 public/anon/authenticated Storage write policy를 추가하지 않습니다. Local PC의 signing key 경로도 CI 설정에 사용하지 않습니다. Publish timestamp는 trusted job의 실제 UTC 실행 시각으로 생성합니다.

Workflow는 `npm run release:updater`가 여섯 local artifact를 모두 검증한 뒤 `npm run release:publish`를 실행합니다. Publisher 대상은 project `xxownwxxajzrviuvvfiu`의 public bucket `desktop-releases`로 고정되어 있으며 workflow input으로 바꿀 수 없습니다.

게시 순서와 복구 계약은 다음과 같습니다.

1. `<version>/`의 installer, signature, checksum, README를 overwrite 없이 게시
2. 모든 versioned public object를 다시 내려받아 local bytes와 비교
3. `release-metadata.json`을 갱신하고 검증
4. updater를 활성화하는 `latest.json`을 **마지막으로** 갱신하고 검증

Versioned path는 1년 `max-age`를 사용하고 경로 자체를 immutable로 취급합니다. Supabase Storage upload metadata가 별도 `immutable` directive를 제공하지 않으므로 overwrite 금지와 content 검증으로 불변성을 보장합니다. Mutable pointer는 5분 `max-age`를 사용합니다.

Workflow rerun 시 이미 존재하는 versioned object가 local bytes와 정확히 같으면 성공한 이전 단계로 인정합니다. 내용이 다르면 overwrite하지 않고 hard fail합니다. 따라서 일부 artifact만 올라간 뒤 실패해도 같은 commit/version으로 안전하게 재실행할 수 있습니다. Artifact 검증이나 metadata 게시가 실패하면 `latest.json`은 변경하지 않습니다. `latest.json` 게시 자체가 실패하면 versioned files는 남지만 기존 updater pointer는 유지됩니다.

이미 활성화된 잘못된 release를 동일 version으로 덮어쓰는 rollback은 지원하지 않습니다. 새 수정 version을 만들어 정상 release 절차로 게시해야 합니다. Pointer의 수동 rollback은 별도의 incident 절차와 remote artifact 검증 없이 수행하지 않습니다.

## SHA256 확인

PowerShell에서 다음 명령의 hash를 `SHA256SUMS.txt`와 비교합니다.

```powershell
Get-FileHash .\release-output\BOGUNON-DESK-<version>-Windows-x64-Setup.exe -Algorithm SHA256
```

## Version bump

아래 세 곳을 같은 값으로 수정합니다.

1. `package.json`
2. `src-tauri/tauri.conf.json`
3. `src-tauri/Cargo.toml`

UI는 Tauri app version API를 읽으므로 version 숫자를 별도로 복제하지 않습니다. `공유 베타` label은 제품 단계 constant입니다.

## Release 전 확인

- `git status`의 tracked 변경이 의도한 release commit뿐인지 확인
- `.env.local`, token, credential, 실제 학교 문서와 학생정보가 tracked되지 않았는지 확인
- binary/repo에 실제 secret/service-role key, AI API Key, 개인 access token이 없는지 확인
  - guard와 테스트에 포함된 `sb_secret_` / `service_role` 문자열 자체는 실제 credential이 아니다.
- Tauri identifier `kr.sungandi.schoolhealthdesk`와 `school-health-desk://auth/callback` 유지 확인
- installer bytes와 SHA256 기록

## 설치 QA checklist

- 가능한 경우 이미 활성화된 Windows Sandbox 또는 기존 격리 환경에서 설치
- 첫 실행 3단계, `나중에 연결`, Workspace, 설정의 version/다시 보기 확인
- Quick Add, Toolbox, 품의 도우미, 공문 작업실 확인
- 완전 종료 후 재실행 시 onboarding 자동 재표시가 없는지 확인
- Tray와 완전 종료 확인
- uninstall 후 executable/shortcut 제거 및 오류 없음 확인

격리 환경이 없으면 현재 개발 PC에 installer를 설치하지 않습니다. 대신 NSIS 생성, checksum, 정적 localhost 의존성 검사, dev UI smoke 결과와 수행하지 못한 clean-machine QA를 release 기록에 명시합니다.

공유 베타는 아직 코드서명되지 않았으므로 Windows에서 게시자 확인 또는 SmartScreen 경고가 표시될 수 있습니다. 보안 기능 비활성화를 안내하지 않습니다.

## GitHub Actions clean-install QA

`.github/workflows/windows-clean-install-qa.yml`은 `windows-latest`의 깨끗한 사용자 환경에서 production NSIS를 빌드한 뒤 실제 silent install, 두 번의 앱 실행, silent uninstall을 검증합니다. installer와 설치 전후 snapshot, 실행 로그, 결과 요약은 `windows-clean-install-qa-<run id>-<attempt>` artifact로 남습니다.

workflow를 실행하려면 repository **Settings → Secrets and variables → Actions → Variables**에 아래 공개 client 설정을 등록한 뒤, **Actions → Windows clean-install QA → Run workflow**를 선택합니다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

동일한 script를 로컬에서 실행할 수도 있지만 `-AllowCleanup`은 identifier 기반 설치·AppData를 먼저 제거하므로 기존 사용자 PC가 아닌 Windows Sandbox 또는 별도 VM에서만 사용합니다.

```powershell
$installer = Get-ChildItem -Path .\release-output -Filter *.exe -File
if ($installer.Count -ne 1) { throw "Expected exactly one release installer." }
pwsh -File .\scripts\qa\windows-clean-install.ps1 `
  -InstallerPath $installer[0].FullName `
  -OutputDirectory .\artifacts\windows-clean-install-qa `
  -AllowCleanup
```
