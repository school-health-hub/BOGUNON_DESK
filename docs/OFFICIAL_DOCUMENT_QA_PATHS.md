# 공문작업실 QA 출력 경로

공문 QA 전용 스크립트에만 `BOGUNON_OFFICIAL_DOCUMENT_QA_OUTPUT_ROOT`를 적용한다.
운영 앱 설정, Windows Known Folder, QA identifier 및 런타임 저장 경로는 바꾸지 않는다.

## 경로 계약

| 용도 | 환경변수 미지정 | 외부 출력 루트 지정 |
|---|---|---|
| Frontend 및 qa-build.json | worktree/dist-official-document-qa | ROOT/dist-official-document-qa |
| Cargo target 및 QA EXE | worktree/src-tauri/target-official-document-qa | ROOT/target |
| Vite cache | 기존 Vite 기본값 | ROOT/vite-cache |
| 합성 fixture | worktree/qa/official-document/fixtures | ROOT/fixtures |
| TEMP/TMP | 기존 프로세스 값 | ROOT/temp |
| PowerShell 분석 캐시 | 기존 프로세스 값 | ROOT/powershell/ModuleAnalysisCache |
| QA 로그용 디렉터리 | 기존 호출자 지정 | ROOT/logs |

로그는 자동 수집하지 않는다. 호출자가 stdout/stderr를 ROOT/logs의 새 파일로 리디렉션한다.
환경변수는 QA 프로세스 및 자식에만 전달하며 시스템/사용자 환경 설정을 변경하지 않는다.
기존 Cargo registry/toolchain은 읽어서 사용한다. 다운로드나 registry 이동을 수행하지 않는다.

외부 frontend 경로는 Vite inline build 옵션, 번들 검사, stamp, Tauri JSON overlay,
QA feature의 build.rs 검사에서 같은 resolver 계약을 따른다.
Tauri의 beforeBuildCommand는 외부 루트 사용 시에만 비활성화한다. 먼저 만들어 검사한
frontend를 다시 생성하거나 비우지 않고 사용하기 위해서다. 기본 모드의 command는 유지한다.
Vite 외부 모드에서는 configLoader=runner를 사용해 C: node_modules/.vite-temp 설정 번들을 피한다.
운영 Vite 및 Tauri 설정은 변경하지 않는다.

## 빌드 없이 확인

저장소 루트의 PowerShell에서 실행한다. 아래 예시는 빌드/앱 실행을 하지 않는다.

```powershell
# 현재 셸을 닫으면 사라지는 프로세스 환경변수. setx를 사용하지 않는다.
$env:BOGUNON_OFFICIAL_DOCUMENT_QA_OUTPUT_ROOT = 'E:\BOGUNON_DESK_QA\official-document\run-YYYYMMDD-HHMMSS'
node scripts/build-official-document-qa-frontend.mjs --print-paths
node scripts/build-official-document-qa.mjs --print-paths
# 작은 소유권 표식·쓰기 probe·빈 temp/cache/log 디렉터리만 생성한다.
node scripts/build-official-document-qa.mjs --check-paths
```

`--print-paths`는 경로를 계산해 출력할 뿐 드라이브 쓰기 가능성을 증명하지 않는다.
`--check-paths`가 실제 연결·쓰기 가능성과 용도 표식을 검사한다.
상대 경로, 드라이브 루트, worktree 및 상위 디렉터리, symlink/junction을 거부한다.
드라이브 분리·권한 오류는 경로와 확인할 항목을 포함한 오류로 중단한다.

비어 있는 전용 경로만 처음 사용할 수 있다. `.official-document-qa-output.json`에
QA identifier와 해당 worktree를 기록한다. 용도 표식이 없는 기존 E: target/evidence 경로는
반입·덮어쓰기하지 않는다. 이 표식은 라이선스/서명이나 악의적 변경 방지 기능이 아니다.
외부 frontend가 이미 비어 있지 않으면 삭제하지 않고 중단하므로 새 run 디렉터리를 사용한다.
기존 QA EXE 덮어쓰기 거부와 locked/offline Cargo 계약도 유지한다.

## 이후 빌드 순서 (별도 승인 및 자원 점검 후에만)

1. C: 보호 하한 5GiB, 시스템 커밋 여유, E: 연결 및 output-root 쓰기 검사를 확인한다.
2. 기존 MSVC 환경, CL=/utf-8, Strawberry Perl을 QA 프로세스에만 구성한다.
3. 같은 외부 루트 환경에서 `node scripts/build-official-document-qa-frontend.mjs`를 실행한다.
4. 같은 루트로 `node scripts/build-official-document-qa.mjs`를 실행한다.
5. QA EXE 예상 위치: ROOT/target/x86_64-pc-windows-msvc/release/bogunon-desk-official-document-qa.exe.
6. HEAD뿐 아니라 미커밋 UI 파일의 해시를 따로 기록한다. sourceSha stamp만으로 미커밋 내용은 식별되지 않는다.

이번 경로 지원의 정적 검증은 위 빌드 명령 실행이나 네이티브 컴파일 성공을 의미하지 않는다.
외장 HDD의 작은 파일 I/O는 느릴 수 있고 새 target은 전체 재컴파일할 수 있다.
기존 C:/E: target 및 evidence를 복사·삭제하지 않는다.

## 실제 앱 실행 전 별도 확인

QA identifier: `kr.sungandi.schoolhealthdesk.officialdocumentqa`.

- 패키지 저장: Windows LocalAppData Known Folder 아래
  `kr.sungandi.schoolhealthdesk.officialdocumentqa/official-document-references`.
- QA Rust 격리 검사는 identifier 디렉터리의 `EBWebView`를 기대한다.
- 현재 Tauri 설정의 상대 `dataDirectory`는 `official-document-qa-webview`다.
  lockfile의 Tauri 2.11.5 from_config 구현은 이를 LocalAppData 아래
  `main/official-document-qa-webview`로 해석한다. WebView2가 그 안에 추가 데이터를 만들 수 있다.
  따라서 실제 WebView2 경로와 Rust 격리 검사 기대값의 일치는 실행 전에 다시 확인해야 한다.
  이번 변경은 이 기존 경로 차이를 수정하거나 안전하다고 선언하지 않는다.
- LOCALAPPDATA/USERPROFILE 변경만으로 Known Folder를 E:로 옮길 수 있다고 가정하지 않는다.
- C:에 WebView2 cache·프로필·crash/log 파일, QA 패키지 데이터, OS/도구 진단 자료 및
  시스템 관리 pagefile 증가가 남을 수 있다. 외부 build target만으로 이를 막을 수 없다.
- WebView2 강제 리디렉션, 프로필 이동, 레지스트리 변경은 하지 않는다.
- C:가 5GiB 미만인 현재 상태에서는 빌드/실행 READY가 아니다. C: 용량 확보와
  실행 격리 경로 재검증 후 별도 승인을 받아야 한다.

E:에 보존할 항목은 소유권 표식, frontend/stamp, target/EXE, 합성 fixture,
검증 로그와 소스 해시 기록이다. temp/cache도 임의 정리하지 않는다.
