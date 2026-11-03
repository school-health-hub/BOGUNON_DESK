# 학교 PC 재개 — Soft Rose OPTION C

이 문서는 이 PC와 외장하드 없이 공개 GitHub에서 복원하는 단일 진입점이다. 현재 범위는 최신 Soft Rose UI 소스·설계 검토·집중 검증 근거의 인계이며, 별도 Finance WIP/운영 데이터 이전은 포함하지 않는다.

## 정확한 기준과 다음 작업

- 저장소: https://github.com/school-health-hub/BOGUNON_DESK (PUBLIC)
- 제품 UI 브랜치: `codex/option-c-soft-rose-usability`
- 제품 SHA: `5ae2ae3e7534b68b015c34fc77c17e862d820f1c`
- 통합 기준: `integration/electron-feature-baseline` @ `195f3375e91348d2bbc7145b0e3743ca5f54385f`
- 이 인계 브랜치: `codex/school-handoff-soft-rose-20261104`. 제품 SHA 위에 문서·합성 증거만 추가한다. 인계 HEAD와 제품 SHA를 혼동하지 않는다.
- **다음 승인된 단계:** 학교 PC에서 이 문서와 증거를 읽고 HEAD/도구/공간을 비파괴 확인한 후 작업을 재개한다. UI 소스의 통합 반영, 새 Portable 생성 및 실제 OS DPI 검증은 별도 요청/승인 단계로 남긴다. 자동으로 병합·빌드·전체 회귀·배포하지 않는다.
- Native WorkerW는 대상에서 제외한다. 일반 Electron Renderer/창의 OPTION C를 유지한다.

## 학교에서 시작하기

기존 학교 작업 폴더를 덮어쓰지 말고 새 경로에서 실행한다. 이 PC의 C:/E: 경로는 필요 없다.

```powershell
git clone --branch codex/school-handoff-soft-rose-20261104 --single-branch https://github.com/school-health-hub/BOGUNON_DESK.git BOGUNON-School-Resume
Set-Location BOGUNON-School-Resume
git status --short
git remote -v
git log -2 --oneline
git rev-parse HEAD
git rev-list --left-right --count 'HEAD...@{upstream}'
git merge-base --is-ancestor 5ae2ae3e7534b68b015c34fc77c17e862d820f1c HEAD
node --version
npm --version
```

status는 빈 출력, ahead/behind는 `0 0`, merge-base 명령은 exit0을 기대한다. 이후 아래 해시 검증을 실행한다. 학교 PC 자체에서 아직 실행한 결과는 아니다.

```powershell
$handoffRoot = Join-Path $PWD 'docs/handoff/soft-rose-20261104'
foreach ($line in Get-Content (Join-Path $handoffRoot 'SHA256SUMS.txt')) {
  $parts = $line -split '  ', 2
  $actual = (Get-FileHash -LiteralPath (Join-Path $handoffRoot $parts[1]) -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $parts[0]) { throw "해시 불일치: $($parts[1])" }
}
```

처음 Codex에 다음을 전달하면 된다.

> docs/handoff/soft-rose-20261104/README.md를 읽고 제품SHA와 인계HEAD를 구분해줘. 소스·증거 해시와 학교 PC 도구·디스크 상태부터 확인해줘. UI 통합/Portable/실제 DPI 검증은 승인된 범위를 확인한 뒤 이어가고, 기존 학교 저장소·앱 데이터·Finance 키는 변경하지 마.

## 완료 상태와 제한

| 항목 | 실제 상태 |
|---|---|
| 상단 빈 공간 축소, 카드 내부 스크롤·긴 한글, Dock 분리 | 구현 완료 |
| 반투명/표준 backdrop-filter와 유리 효과 줄이기 | 구현 완료; 사용자 옵션은 이번 실행에만 적용 |
| 중첩 모달 Escape·탭 순서·포커스 복원 | 구현 완료 |
| P0 날씨/급식 signedOut 수정 | 보존 |
| 13개 위젯·사용자 저장 배치·12개 업무 데이터 계약 | 변경 없음; 브라우저 메모리 설정에서 13개 배치 동일성 확인 |
| 관련 집중 테스트 | 2파일21 PASS; 독립 실행도21 PASS |
| Electron Main/Preload·Renderer·테스트 TypeScript | PASS |
| 프로덕션 Renderer 빌드 | PASS; 기존 chunk-size 경고 존재 |
| 브라우저 화면 검사 | 6경우 PASS,30 PNG; 독립 시각 최종 PASS |
| 실제 Windows OS125%/150%·최신 Portable | NOT RUN; Chrome 배율 모사를 실제 OS/Electron GUI로 표기하지 않음 |
| UI 통합 브랜치 반영·main 병합·배포 | NOT RUN; 별도 승인 필요 |

브라우저 증거는 Windows Chrome의 production Renderer와 **메모리 전용 Electron 브리지·합성 업무/메모**를 사용했다. 실제 사용자 JSON/Finance DB/키를 읽거나 쓰지 않았다. 980x700,1440x900 및125%/150% 장치 배율 모사와 유효소형창784x560/653x467를 확인했다. 최종 캡처에서 편집 도구막대가 위젯을 덮지 않고 Dock 간격8px, 전체/내부 스크롤, 설정 키보드 접근, 효과축소 및 오류없음을 확인했다.

## 버전과 검증 명령

Node24.15.0/npm11.12.1, Electron45.2.1, TypeScript6.0.3, React19.3.0, Vite8.3.0, Vitest5.0.1 기준이며 정확한 패키지 의존성은 저장소의 package-lock.json이 보존한다. Rust1.98.1 MSVC/VS2022 BuildTools는 향후 native 패키징 때 별도 확인한다. 현재 문서/증거 확인에는 설치가 필요 없다.

학교 PC의 디스크·메모리·Node 버전부터 확인한다. node_modules와 빌드/브라우저 캐시는 재생성 가능한 상태라 전송하지 않았다. 필요할 때만 `npm ci`를 실행하고, Renderer 검증만 필요하면 그 설치 프로세스에 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`을 적용할 수 있다. TEMP/TMP·npm 캐시는 충분한 용량이 있는 로컬 경로를 선택해 해당 프로세스에서만 설정한다. Windows 전체 설정은 바꾸지 않는다.

이미 끝난 테스트를 인계 때문에 반복하지 않는다. 이후 관련 코드가 바뀔 때만 다음 집중 명령을 사용한다.

```powershell
node node_modules/vitest/vitest.mjs run electron-p0/tests/soft-rose-surface.test.tsx electron-p0/tests/widget-state-notices.test.tsx --maxWorkers=1
node scripts/electron-p0/build.mjs
```

선택적인 동일 브라우저 재현은 `evidence/surface-final/capture.mjs`를 읽고 검토 후 프로젝트 루트에서 실행한다. npm 의존성과 설치된 Chrome이 필요하다. 출력은 재생성용 `.omo/surface-final/`에 생성되며 게시된 원본 캡처를 덮어쓰지 않는다. 이는 Electron/Portable 실행 도구가 아니다.

## 의존성·증거 인벤토리

| 의존성 | 보존 방식 |
|---|---|
| 제품 소스·테스트·스크립트·lockfile·설정·migrations | tracked and pushed; 제품SHA 및 이 인계 브랜치로 복원 |
| [최종 UI 증거](evidence/surface-final/) | 합성 캡처30개+RED/GREEN/build/browser 결과/재현스크립트36개, tracked and pushed |
| [P0 기준 증거](evidence/p0-notices/) | 합성 캡처6개+로그/결과/스크립트12개, tracked and pushed |
| [증거 인벤토리](evidence-inventory.json) | 48개 원본 논리상대경로,원본/공개본 SHA-256,크기,원본수정시각,편집여부 |
| [SHA256SUMS.txt](SHA256SUMS.txt) | 게시된 인계 파일의 해시; SHA 파일 자체 제외 |
| [독립 검토 기록](REVIEW_RECORDS.md) | 대화상 검토 응답 발췌·요약 및 근거 링크. 원본 transcript 파일로 주장하지 않음 |
| [전역 인계 지침 v1.1](PC_HANDOFF_POLICY-v1.1.md) | 버전 백업. 학교 PC의 기존 AGENTS.md/AGENTS.override.md 확인 후 충돌 없이 적용 |
| Node/npm/빌드/임시브라우저 상태 | reproducible with instructions; receiving-PC 설치 상태는 별도 확인 |
| 실제 사용자 데이터·Finance DB/DPAPI·운영 인증 | 이 UI 재개에 불필요하며 전송하지 않음 |

원본 증거는 최초 PC에 그대로 보존했다. **PNG36개는 바이트 무변경**이다. 로컬 경로가 있던 텍스트4개만 `<SOURCE_CHECKOUT>` 등으로 가렸으며 인벤토리의 `Redacted:true`로 명시했다. 편집본을 원본으로 취급하지 않는다. Git checkout은 수정시간을 재현하지 않으므로 원본 UTC시각을 인벤토리에 보존한다. capture.mjs의 상대 출력 경로는 재현에 사용할 수 있다. 원본 파일의 로컬 절대경로는 재개에 필요 없다.

## 안전·프로세스·이전 WIP

사용자는 공개 GitHub에 인계문서와 합성 캡처·검증로그 보존을 명시적으로 승인했다. 브라우저 프로필/쿠키·환경파일·실제 업무/개인/학생/환자/Finance 자료는 패키지에서 제외했다. 전용 secret scanner 미설치로 전체 텍스트 패턴 검사와 합성 캡처 수동 검토를 수행하며 잔여위험을 명시한다. 세부 최종 검사는 [RESTORE_CHECK.md](RESTORE_CHECK.md)에 기록한다.

최종 캡처 실행은 browser.close 및 previewHTTPserver.close 후 exit0이었다. 다른 세션/프로세스/Docker를 종료하거나 정리하지 않았다. 검증용 원격 복원에서는 설치/빌드/앱 실행을 하지 않고 Git 및 파일/해시 인벤토리만 검사한다.

기존 다른 Finance 후보 폴더는 별도 미완료 MERGE_HEAD·staged/unstaged/미추적 검증자료를 갖고 최초 PC에 남아 있다. 승인 범위가 아니므로 업로드하지 않았다. **그 WIP는 이 인계로 재개할 수 없다.** 현재 Soft Rose UI 작업의 다음 단계에는 필요하지 않다. 기존 main의 독립 변경이나 Native WorkerW를 이 UI에 섞지 않는다.

기존 외장 Portable은 제품9e22f7e...이며 새 UI를 포함하지 않는다. 해당 EXE/프로필/DPAPI를 이 문서의 필수 의존성으로 삼지 않는다. 이 PC의 낮은 C: 여유 공간은 학교 PC에 전파되는 조건이 아니며 학교 환경을 독립 확인한다.

## 인계 규칙

앞으로 “학교/다른 PC에서 이어서”는 기본적으로 원래 PC와 외장하드 없이 승인된 온라인 경로만으로 재개 가능해야 한다. 학교의 `$CODEX_HOME`을 별도 확인하고 기존 전역 지침을 덮어쓰지 말고 병합한다. 전역 지침 변경 후 새 Codex 세션에서 로드된 지침과 이 규칙을 확인한다.
