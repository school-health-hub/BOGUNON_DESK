# S-2H-19 종료 / S-2H-20 학교 PC 인계

작성: 2026-10-28 KST. 추가 개발·GUI 실행·CI 재실행 없이 종료한다.

## 기준과 상태

- Repository: `school-health-hub/BOGUNON_DESK` (공개 저장소).
- Branch: `integration/desktop-surface-s2`.
- 검증된 구현 및 **artifact source SHA**:
  `c9f558888f27ca5e3fa094db389f76bd7fe74766`.
- 이 문서를 보존하는 후속 HEAD는 문서 전용 체크포인트다. 그 HEAD에 대해
  새 Windows 빌드가 통과했다고 해석하지 않는다. 원격 HEAD는 재개 시 재조회한다.
- [Windows CI 40544069919](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/40544069919):
  `completed/success`, attempt `1`, 위 source SHA.
- Artifact ID: `12754391820`, 17,196,616 bytes.
- Artifact name:
  `desktop-surface-s2f1-portable-qa-c9f558888f27ca5e3fa094db389f76bd7fe74766-40544069919`.
- API 만료 예정: `2026-11-03T17:17:18Z` = **2026-11-04 02:17:18 KST**.
  만료·삭제·접근 불가이면 자동 재빌드하지 않고 중단한다.

## 구현과 실제 관측 구분

| 단계 | 상태 및 근거 |
| --- | --- |
| S-2H-17 | 초기 navigation 성공/ID 확인 후 URL·resource identity 재검증, Lifetime → MainEvents → Host 순서 구현. Windows CI PASS |
| S-2H-18 | 일반 사용자 세션에서 `initial_navigation`, Lifetime, MainEvents 통과. Host environment/controller 생성까지 실제 관측 |
| S-2H-18 실패 | Host `currentStage=udf_verification`, `failureCode=invalid_path`, `outcome=failed`, `cleanupStatus=not_evaluated` |
| S-2H-18 Main 진단 | `mainOriginState=expected_origin`, `failureCode=null`, `outcome=running`; `childStatus=not_started`는 실제 Host 진단과 불일치하므로 단독 실행 증거로 사용하지 않음 |
| S-2H-19 | Windows canonical UDF와 일반 profile 경로 혼용 결함을 합성 파일시스템 테스트로 RED→GREEN 재현·수정. 이전 축약 오류의 정확한 분기까지 확정한 것은 아님 |
| S-2H-19 cleanup | UDF 거부 시 소유한 자원만 순서대로 정리 시도. 원래 실패 유지, 거부 UDF는 보존하며 `CleanupUnknown`. 정상 경로 삭제는 saved identity·TEMP 직접 자식·reparse 검사 강화 |
| 신규 GUI/cleanup | **NOT_VERIFIED**. S-2H-19 패키지의 UDF admission, 여섯 위젯, Quick Launcher, 실제 browser 종료·cleanup은 아직 실행하지 않음 |

Main 초기화, 운영 identifier·설정, Finance·암호화·인증·ACL·workflow는 S-2H-19에서
변경하지 않았다. WorkerW/Explorer 부착은 이번 재개 범위가 아니다.

## 검증 결과와 파일

- Windows Main Rust: **468 PASS / 1 ignored**.
- Windows Surface Host: **87 PASS** (library 63, integration 22, doctest 2).
- Node isolation/portable/frontend 계약: **17 PASS**.
- 패키징 테스트: **37 PASS**.
- TypeScript, synthetic frontend build, Native compile/release, package verification PASS.
- 로컬 Host all-target check, library/binary Clippy `-D warnings`, rustfmt,
  diff 검사 PASS. Miri/sanitizer는 도구 부재로 **NOT_VERIFIED**.
- 소스·계약·lockfile·빌드 workflow는 이 브랜치에 tracked/pushed.
- 구현 설명: `docs/DESKTOP_SURFACE_S2H17_NAVIGATION_BOOTSTRAP.md`,
  `docs/DESKTOP_SURFACE_S2H19_UDF_VERIFICATION.md`.
- verifier: `scripts/package-surface-qa-portable.mjs` (Node built-in만 사용;
  재개 시 `npm install`, Rust 빌드 필요 없음).

재현 명령(이 종료 작업에서는 재실행하지 않음):

```powershell
node --test src-tauri/tests/desktop-surface-qa-contract.test.mjs scripts/desktop-surface-s2f1-portable-qa-contract.test.mjs scripts/surface-qa-frontend-contract.test.mjs
cargo test --locked --manifest-path src-surface-host/Cargo.toml
cargo check --locked --manifest-path src-surface-host/Cargo.toml --all-targets
cargo clippy --locked --manifest-path src-surface-host/Cargo.toml --lib --bins -- -D warnings
```

빌드 환경 provenance: Windows-2022 x64 runner, Node `v22.23.4`, Rust
`1.99.1 (58cf8f9c3 2026-10-13)`, Tauri 2.11.5, webview2-com 0.38.2.
학교 PC에는 Git, 인증된 GitHub 접근, Node 22, PowerShell 및 Windows WebView2
Runtime이 필요하다. 실제 학교 PC 환경·전역 AGENTS/override 적용은 재확인한다.
토큰·비밀번호·프로필·사용자 데이터는 가져오지 않는다.

## Artifact identity / 무결성

| 파일/대상 | SHA-256 |
| --- | --- |
| GitHub ZIP 실제 바이트 및 API digest | `c5a3fb2eb6150be09ad3dcc613d8fb22f01bc802004e52d3261c5e2efbf0a8e3` |
| `bogunon-desk-surface-qa.exe` | `cbe4195b0983466ce1dc2fa7c0e489af8ddd8d1a59b68968701f4c6a3b2b6d15` |
| `bogunon-desktop-surface-host.exe` | `c325112db997279a8df01c09549052eb1370e49dcdd4998894eb2e31ce1d7372` |

ZIP 19개 파일: 두 EXE, `ARTIFACT-MANIFEST.json`, `SHA256SUMS.txt`, `README.txt`,
`surface/`의 허용된 14개 파일. 정확한 개별 파일·크기·해시는 manifest와 verifier로
확인한다. QA identifier는 `kr.sungandi.schoolhealthdesk.surfaceqa`,
`syntheticDataOnly=true`, `operatingDataAccess=false`, `externalNetworkAllowed=false`.
unsigned portable QA이며 운영 설치본·배포 승인이 아니다.

## 비Git 기록 / 접근성 / 보존

| 의존성 | 보존 및 학교 PC 접근 상태 |
| --- | --- |
| 구현·테스트·설계·lockfile·verifier | tracked/pushed; 원격 fresh sparse clone에서 핵심 파일 복원 확인 |
| Windows CI 로그·실행 provenance | 위 run에서 접근 가능. 만료 정책과 접근 권한은 학교에서 재확인 |
| EXE·bundle·manifest·SHA256SUMS | 위 artifact에 함께 보존. 집 PC fresh remote checkout의 verifier로 다운로드 패키지 전체 검증 PASS |
| 로컬 `.omo/evidence/s2h19/` | RED/GREEN, Host/Node 로그, journal, 테스트 EXE/PDB/target, 종료 시 fresh sparse restore 확인용 clone. **ignored, 집 PC 보존 / 원격 미전송** |
| S-2H-18 원본 진단·스크린샷·inventory | 집 PC 별도 Evidence 폴더에 원본 그대로 보존. **학교 PC 미전송**. 문서에는 고정 코드 요약만 수록 |
| S-2H-19 다운로드 ZIP·검증 JSON | 집 PC 별도 QA 폴더에 보존. ZIP은 원격 artifact로 동일 바이트 재취득 가능. 로컬 verification JSON은 미전송 |
| S-2H-18 잔여 임시 QA UDF | 집 PC에 보존. 전송·복사·삭제 대상 아님. 학교에서 재사용 금지 |

S-2H-20의 **복원·artifact 검증·단일 실행 사전 준비**에 필요한 원격 의존성은
확인됐다. 단, 과거 로컬 원본 증거까지 학교에서 열 수 있는 완전 증거 인계는
**PARTIAL**이다. 원본 자료가 필요한 추가 포렌식은 집 PC에서 보거나,
별도로 승인된 안전한 전송을 받아야 한다. 공개 Git에 강제 추가하지 않는다.

원본 참조 해시(내용/사용자 경로를 업로드하지 않음):

- S-2H-18 최종 Main diagnostic: `ec494d5bf0aeb0173eb5021270d428796384b5d19b2ee950bfe11eccfbd7e0d0`.
- S-2H-18 최종 Host diagnostic: `176da0e01bf652ebf9b9f35fa6510b05be2e3d0e2f2245ecf7152b901cdc2600`.
- S-2H-18 실제 QA Main 화면: `4312bb5d0f05f220cac7f6c6872957f4dd2af8babd6e7bd13bd9a6c24afa413e`.
- 같은 폴더의 최초 occluded 캡처는 QA 렌더링 증거가 아니다. 다른 화면/경로가
  포함될 수 있어 원본 폴더 전체를 공개 업로드하지 않는다.
- 전용 secret scanner는 미설치. 문서와 staged 전체를 토큰·키·절대 사용자 경로
  패턴 및 수동 검토로 검사하는 best-effort 수준이며 완전한 DLP 증명은 아니다.

## S-2H-20 시작 절차 — 실행은 아직 금지

1. 학교 PC의 실제 저장소 경로를 먼저 찾는다. 원격 URL을 확인하고 각 worktree의
   branch/HEAD/upstream/status와 미커밋·미추적·로컬 전용 커밋을 보존한다.
   다른 기능 작업의 dirty 상태를 정리하지 않는다.
2. 확인한 저장소에서 일반 fetch 후 원격 SHA를 기록한다. 이 인계 문서 이후
   예상 외 변경이 있으면 임의로 진행하지 않는다. 기존 branch를 reset하지 않는다.

   ```powershell
   git remote -v
   git worktree list --porcelain
   git status --short --untracked-files=all
   git branch -vv
   git fetch origin
   git ls-remote origin refs/heads/integration/desktop-surface-s2
   git rev-parse origin/integration/desktop-surface-s2
   ```

3. 안전한 기존 동일 작업 worktree가 clean이고 로컬 고유 커밋이 없으면 fast-forward
   가능 여부를 확인한다. 그렇지 않으면 **비어 있고 존재하지 않는 학교 PC 전용 경로**에
   detached worktree를 만든다. 아래 인자는 직접 확인한 새 경로로 바꾼다.

   ```powershell
   git worktree add --detach '<확인한 새 학교 PC 작업 경로>' origin/integration/desktop-surface-s2
   # 새 worktree에서만:
   git rev-parse HEAD
   git status --short
   git merge-base --is-ancestor c9f558888f27ca5e3fa094db389f76bd7fe74766 HEAD
   git diff --name-only c9f558888f27ca5e3fa094db389f76bd7fe74766 HEAD
   ```

   최종 인계 SHA와 일치하고, source 이후 차이가 이 인계 문서 하나인지 확인한다.
   detached에는 upstream divergence가 적용되지 않는다. 기존 branch를 재사용할 때는
   upstream 및 ahead/behind 0/0을 별도로 확인한다.
4. Actions run의 `completed/success`, attempt 1, source SHA와 artifact ID/digest/
   만료 상태를 재확인한다. 정확한 ZIP 바이트를 보존하려면 UI에서 해당 artifact를
   받거나 GitHub API로 ZIP을 받는다. `gh run download`로 풀기만 하면 원본 ZIP 해시를
   검사할 수 없으므로 ZIP SHA-256 검증을 생략하지 않는다.

   ```powershell
   gh run view 40544069919 --repo school-health-hub/BOGUNON_DESK --json status,conclusion,attempt,headSha,url
   gh api repos/school-health-hub/BOGUNON_DESK/actions/artifacts/12754391820
   Get-FileHash -LiteralPath '<다운로드한 artifact.zip>' -Algorithm SHA256
   ```

5. ZIP 목록에서 경로 traversal·symlink·예상 외 파일이 없는지 확인한 뒤 **새 빈 QA 폴더**에
   해제한다. 소스 worktree에서 다음 검증을 실행한다. Node built-in만 사용한다.

   ```powershell
   $qaPackage = '<새 QA 폴더의 package 경로>'
   node --input-type=module -e 'import {verifyPortablePackage} from "./scripts/package-surface-qa-portable.mjs"; const m=await verifyPortablePackage(process.argv[1]); if(m.sourceSha!=="c9f558888f27ca5e3fa094db389f76bd7fe74766"||m.runner.runId!=="40544069919"||m.runner.runAttempt!=="1")throw Error("provenance mismatch"); console.log(JSON.stringify({sourceSha:m.sourceSha,identifier:m.identifier,files:m.files.length}));' $qaPackage
   ```

6. **여기서 멈춘다.** 기존 QA 프로세스·진단 보존·QA 격리·WebView2 준비 상태를
   확인하고 별도 GUI 1회 승인 자료를 보고한다. EXE 실행·Host 직접 실행·자동 재시도·
   보안 경고 우회는 하지 않는다. 실제 사용자 세션과 자동화 세션 TEMP/AppData가
   다를 수 있으므로 관측 경로를 구분한다.

집 PC 종료 관측: 식별된 QA Main/Host/QA WebView2 프로세스 없음. 잔여 QA UDF는
보존했다. 운영 AppData는 검사하거나 변경하지 않았으므로 포괄적 비간섭은
NOT_VERIFIED다. PC 종료 명령, 앱 실행, CI 재실행, 다른 worktree 수정은 하지 않는다.
