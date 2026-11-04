# PARITY-P1-1 — Electron 생기부 도우미

기준: `fb70d8ba7ce3054da733244e36db14d954bb4363`.
기능 브랜치: `feature/electron-record-helper`.
판정: **CONDITIONAL** — Cloud의 합성 문서/모의 AI 검증 완료, Windows 및 실제 ChatGPT 미실행.

## 원본 계약과 재사용

- 원본 `src/components/desktop/RecordHelperPanel.tsx`의 상태·가져오기·비식별 검토·전송 확인·폐기 흐름을 `RecordHelperWorkspacePanel.tsx`로 분리했다. Tauri 진입점은 기존 context/import service를 연결하는 얇은 wrapper로 유지한다.
- 기존 `RecordHelperWorkspaceView`, 보고서 목록/상세, `RecordHelperAiConfirmation`, `RecordHelperDiscardConfirmation`, workspace reducer, deidentification/privacy/prompt/send gate를 재사용한다. Electron에서만 AI 초안 편집과 Main 요청 취소를 연결한다.
- 기존 Rust `src-tauri/src/record_helper_import/{mod,pdf,zip_text,hwp,hwp_text,util}.rs`는 변경하지 않는다. 새 CLI build script가 pure extraction 부분을 OUT_DIR에 복사하고 Tauri picker/AppHandle/async adapter만 제외한다. 원본 순수 추출 테스트도 함께 실행한다.
- Main에서 필요한 순수 privacy/prompt/payload validator는 `.js` import 경계와 최소 타입 어댑터로 옮겼다. Main/Renderer 비식별·전송 검증의 원본 동등성 테스트를 둔다. Renderer에는 Tauri command, filesystem, 토큰 접근을 추가하지 않는다.

## 지원 형식과 제한

| 형식 | Cloud의 실제 native 실행 | 제한 |
| --- | --- | --- |
| PDF | 합성 text PDF 성공, 실제 암호화 PDF/손상 문서 거절 | 최대 50쪽, 스캔 OCR 미지원 |
| HWPX | 합성 ZIP/XML 문서 성공 | 압축/XML 한도, 손상·암호화 거절 |
| DOCX | 합성 ZIP/XML 문서 성공 | 압축/XML 한도, 손상·암호화 거절 |
| HWP | 합성 5.x 일반/압축 문서 성공 | 구형 HWP, 암호·배포·DRM·보안 문서 미지원 |

- 선택 50개, 파일당 15MiB, 선택 원본 합계 150MiB. 텍스트 파일당 2MiB/합계 20MiB. 작업실도 50개/20MiB를 유지한다.
- 원본 ZIP 제한은 1,024개 entry/XML 합계 8MiB, HWP는 64 section/100,000 record/해제 8MiB다.
- Main-owned picker만 경로를 얻는다. 절대경로·일반 파일·확장자·크기 검사, symlink/hardlink 거절, 추출 전후 파일 식별/크기/시간 변경 검사. Renderer는 임의 경로/실행파일/URL을 전달할 수 없다.
- 한 번에 한 child만 실행하며 파일당 30초, batch 180초, child memory 512MiB/CPU 30초, stdout 16MiB 제한을 둔다. 전체 시간 초과 시 앞선 성공 결과는 유지하고 남은 파일별 실패를 표시한다. 사용자 취소는 새 결과를 적용하지 않는다.
- 원본은 읽기 전용이다. CLI에 경로를 argv가 아닌 bounded stdin으로 전달한다. 문서 임시 복사/디스크 추출/세션 자동 저장을 만들지 않는다. 테스트 fixture와 빌드 산출물만 Git ignore 경로에 생성한다.

## 학생 자료와 AI 경계

- 학생별 자료/구분/학급/교사 메모/검토본/초안은 reducer의 세션 메모리에서만 관리한다. 기존 Tauri 저장소를 탐색하거나 이전하지 않는다.
- Electron에서는 미편집 보고서도 삭제 확인한다. 삭제·전체 비우기·닫기는 확인 후 실행하고, 취소하면 기존 작업을 유지한다. 종료 시 own request를 abort하고 추출 child close를 기다린다.
- 자동 비식별은 안전을 보장하지 않는다는 기존 안내를 유지한다. 사용자가 최종 report/memo를 수정·확인한 뒤에만 `generateReviewed` IPC를 호출한다.
- Main은 exact-key schema, 64KiB prompt 한도, identity hint/민감정보 검사, 승인 flag, 계정 ID·선택 모델·plan 권한·busy 상태를 다시 확인한다. Main에서 prompt를 재구성하며 임의 prompt 우회는 거절한다.
- 기존 `ChatGptService`의 권한·모델·Main consent·native runner/SSE 경로를 재사용한다. 새로운 OAuth/vault/DPAPI 구현은 없다. 공문/소식지/Finder/API Key의 기존 요청 계약은 유지한다.
- AI는 120초 제한, 학생별 scoped cancel, request ID 검증을 적용한다. 메모/신원 변경·삭제·전체 비우기·닫기 후 늦은 응답을 반영하지 않는다. 다른 모듈의 AI 요청은 취소하지 않는다.
- 승인 전 AI 호출 0회, 실제 전송 후 취소해도 이미 보낸 자료를 회수하지 못한다는 안내를 유지한다. 원문/학생 자료/교사 메모/초안을 로그 또는 일반 설정 JSON에 기록하지 않는다.
- 메모리 정리는 state/reference 해제와 owned process 종료를 의미한다. JavaScript/OS 메모리의 물리적 zeroization을 보장하지 않는다.

## UI 및 모달

업무 도구에 세션 전용 생기부 도우미 진입점만 추가했다. 기존 dashboard geometry, Dock, TD2 Glass CSS를 변경하지 않았다. 원본 Record Helper 레이아웃/스타일을 재사용한다. 포털 배경 inert, 최상단 확인창 focus 순환, Escape/폐기 확인, 호출자 focus 복귀를 연결했다. 기존 AI 설정 모달을 열고 돌아와도 학생 자료가 유지된다.

## 네이티브 자원 및 빌드

- 기존 4개 native CLI/OCR 자원은 유지하며 **5번째 `record-helper-cli`**만 별도 추가했다.
- `node scripts/electron-p0/build-record.mjs --release`로 해당 플랫폼 binary와 source/binary SHA-256 manifest를 생성한다. Windows는 기존 CLI 방식의 static CRT, Win32_Security 포함 JobObject 계약을 재사용한다.
- 기존 `electron:p0:package:win`/`:linux`에 빌드 단계를 추가하고 builder extraResources와 beforePack provenance 검사에 연결했다. 소스/binary/manifest 불일치 또는 누락 시 패키징을 차단한다.
- 과거 CI에서 npm package script 대신 CLI별 빌드 후 electron-builder를 직접 호출한다면 위 build-record 명령을 선행해야 한다. 이번 작업에서는 workflow/Portable을 생성·변경·실행하지 않았다.
- Windows MSVC 컴파일/PE 실행·최종 Portable 포함은 아직 NOT RUN이다. Cloud 검사는 Linux ELF와 builder 설정/실제 ASAR Main/Preload 의존성 그래프를 검증한다.

## 집중 검증

- Vitest: 기존 Record Helper/개인정보/확인/reducer, Electron Main/Preload/UI, ChatGPT/API Key IPC, Purchase P0-1/Finder P0-2 최소 회귀 **193개 PASS**(고유 테스트, 반복 실행 합산 아님).
- Rust: 원본 추출/압축 한도/HWP control 및 추가 합성·암호화 PDF **16개 PASS**.
- ASAR/네이티브 manifest·변조·resource 계약 **6개 PASS**.
- Electron Main/Renderer/tests TypeScript 및 production build PASS. 저장소에 lint script가 없어 새 명령을 추가하지 않았다. diff whitespace 검사 PASS.
- 루트 `tsc --noEmit`은 기준/현재 모두 기존 오류 **13개**, 오류 서명 차이 0개다. Electron 전용 세 타입 검사는 별도로 통과한다.

Windows native picker·한글/작은 창 GUI·실제 ChatGPT 로그인/유료 호출·Windows child JobObject/종료/패키징은 **NOT RUN**. 실제 학생/교직원/학교 문서, 인증정보, 사용자 데이터는 사용하지 않았다.

## 통합 인계

일반 push는 이 기능 브랜치에만 수행한다. main/통합 브랜치/worktree 정리·자동 migration은 하지 않는다. 원격 통합 기준이 그대로 `fb70d8b…`인 경우 이번 checkpoint는 fast-forward 통합 가능하다. 통합은 Cloud B의 별도 작업이며 이 작업에서 수행하지 않는다.
