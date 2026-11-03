# Electron 기능 통합 기준본

작성일: 2026-11-03 (한국 시간). 판정: **CONDITIONAL — 통합 소스·Cloud 빌드 확인 / 이 기준본의 Windows 실행본 생성·실사용 확인 대기**.

## 기준과 반영 방식

- 통합 브랜치: `integration/electron-feature-baseline`
- 기반: `feature/electron-common-school-profile@0a417bd98e75c1b0eefbd80eda6b77df4ca0cdcf`
- 이번에 제품 코드 병합·cherry-pick·재구현을 하지 않았다. 아래 기능들이 이미 같은 직렬 계보에 포함돼 있어 기반을 그대로 통합 기준으로 고정했다. 통합 커밋은 이 문서와 기존 인계 문서의 연결만 변경한다.
- 런타임 소스(`electron-p0`, `src`, `src-tauri`, `tools`, `scripts`, package/lock, workflow)는 기반과 바이트 동일하다. 최종 전체 SHA는 이 브랜치의 Git HEAD 및 완료 보고를 사용한다. 문서에 자기 자신의 커밋 SHA를 넣기 위해 추가 커밋을 반복하지 않는다.
- 기존 기능 브랜치·다른 worktree·WIP·main은 보존한다. 새로운 Windows QA workflow, Actions dispatch, 운영 DB 접속, PR·병합·배포는 수행하지 않았다.

## 포함 기능과 진입점

'포함'은 코드·Electron 연결을 뜻한다. 과거 Windows QA나 독립 CI PASS를 새 통합 실행본의 PASS로 승계하지 않는다.

| 기능 | 현재 통합 내용·실제 진입 | 핵심 근거 커밋 | 남은 제한 |
| --- | --- | --- | --- |
| Soft Rose / Dashboard / Dock | 기존 위젯 13종, 사용자 배치·크기·숨김, 하단 Dock, 설정 modal / 메모·업무 도구 nonmodal | `c06ce6a910002cc7658a5545e23e0d3ed914d377` | 승인 디자인 유지. 실제 DPI·다중 모니터·긴 한글 업무명 overflow는 후속 확인 |
| Quick Memo | 위젯·Dock 패널이 같은 `PersistentMemoProvider` 사용, Main read/write·명시적 저장·재실행 복원 | `bd22237aade2d5576d5c3c1b8b991ad914357398` 및 이후 직렬 계보 | 저장 버튼을 누르지 않은 메모는 저장 완료로 표시하지 않음 |
| 공문작업실 | 업무 도구/Dock → PDF/HWPX/ODT 텍스트 가져오기·새 원고·편집·미리보기·home-v1 새 ODT 저장 | `e23ccffc419bfcd4a4c42f4b714ca0d326a9cf0b` | OCR·원본 서식 복원 제외. 저장 취소/실패·개인정보 경계 유지 |
| Purchase Helper | 업무 도구 → CSV/XLSX/XLS/텍스트 PDF 분석·매핑·품의문·CSV/XLSX·정산·에듀파인 출력, Inventory 선택 품목 추가 | `84198b529739e67c24787d17398e84d7fb130fac`, `c6a31e0101268866e452820273b777c1811ebbe9` | 세션 입력을 자동 재고 입고나 운영 DB로 변환하지 않음. native 파일 저장은 새 Windows 실행본에서 확인 |
| 보건소식지 제작소 | 설정 → 앱 정보 → 보건소식지 제작소. 월·여학교/남학교/남녀공학 신규 작성, 기존 B안 요소 편집·JSON·Revision·PNG/PDF | `bd22237aade2d5576d5c3c1b8b991ad914357398`, `6ad9818507d9f7b285ee2ca3d6a97ad3a6504230` | 미지원 스키마 Guard, Asset ID/SHA, pending 출력 차단 유지. B안 디자인 REVISE/PENDING은 Surface 승인과 별개 |
| 교육영상 Finder | 업무 도구 → 기존 합성 검색·라이브러리 저장·가져오기·Main/Preload JSON 내보내기 | `84198b529739e67c24787d17398e84d7fb130fac` | 실제 YouTube 검색은 미연결. Blob 다운로드 허용으로 바꾸지 않음 |
| 일정·업무 관리 | 업무 도구·빠른 추가·위젯 → CRUD·완료·날짜/마감·오늘/주간/월간·D-Day, Dashboard 동기화 | `c09f6ef12d6b47d70b3ded3a27cf7a68a4035af9` | Electron 전용 로컬 저장. BOGUNON 서버 일정과 자동 병합하지 않음 |
| Inventory | 업무 도구 → 로컬 저장 / 합성 미리보기 / 개발 전용 Local QA 분리. 로컬 물품·입고/사용/폐기·유효기간·이력·구매 전달 | `9915eff1ea5a016977b017ab9bedf9f1f9070e1f`, `c6a31e0101268866e452820273b777c1811ebbe9` | Local QA는 Production 메뉴·업무 IPC에서 차단. 실제 서버 Inventory 운영 연결은 없음 |
| OpenAI·Gemini | 설정 → AI 연결. Main 모델 조회·선택·키 연결/해제, 공문/소식지/Finder의 명시적 전송 확인 | `b0816da4daaba3f4e290fdda9ceba734ae5ddd3f` | 외부 계정/모델·요금·실서비스 응답은 이번에 확인하지 않음. ChatGPT 계정 로그인은 미지원 |
| MY FINANCE | 업무 도구 → 기존 금융 화면·CRUD·현황·백업/복구를 고정 Rust CLI로 연결 | `5c1cfde1d1e4ec7a24e396897b76bbf4dbeacb28` | Windows SQLCipher/DPAPI 엔진 필수. Linux에 평문 fallback 없음. 새 통합 실행본의 실제 금융 보안·파일 QA는 미실행 |
| 학교 행정 도우미 | 업무 도구 → 공식 시스템 바로가기·복무 초안·CSV/XLSX 열 매핑·행 검토·복사/출력 | `168afe8ffd0bee0c0193cab74184c932cb83a85b` | 실제 로그인·자동 입력·신청/상신 없음. 인증정보 저장 금지 |
| 공통 학교 프로필 / NEIS / 학교망·eVPN | 미선택 시 초기 설정, 설정의 학교 프로필, 행정 런처가 단일 프로필 공유. NEIS 검색 후 명시적 선택, 학교망/eVPN별 주소·마지막 환경 복원·eVPN 접속 URL | `4ea89c3a69fa4f76081d32092f617b070483584c`, `0a417bd98e75c1b0eefbd80eda6b77df4ca0cdcf` | BOGUNON 학교 조회 미지원. 교육청 17곳 URL 매핑 구조는 있으나 검증된 기본값 0/17이므로 기관 안내에 따른 수동 등록 사용 |

### 계보 확인의 예외

Newsletter B안 원본 `f29a30ce148952b415451cd2a8cf1e9fb57e1d9d`는 전체 브랜치 병합 대신 `bd22237…`에서 선별 이식됐으므로 `merge-base --is-ancestor`만으로 판단하면 누락으로 오인한다. 원본 변경 41개 파일을 대조한 결과 제품/테스트 코드 40개는 기반과 동일하며 `docs/ELECTRON_P0.md`만 이후 작업 이력이 누적돼 다르다. Guard 및 B안 원본 브랜치를 다시 병합하지 않는다.

다른 표의 직렬 체크포인트는 모두 기반의 조상이다. Inventory DB CI 전용 커밋은 제품 코드에 무조건 추가하지 않는다. 기존 격리 DB CI PASS를 이 통합본의 DB E2E PASS로 표시하지 않는다.

## 데이터·보안 보존

- Electron 프로필과 기존 `work-data`별 저장 경계를 유지한다. Dashboard/Dock의 기존 설정 JSON·위젯 ID·사용자 배치를 변경하거나 초기화하지 않는다.
- 기존 메모·업무·Finder·Inventory·행정·학교 프로필의 파일/백업 schema·revision·원자적 교체·충돌/실패 보호를 그대로 사용한다. Tauri 프로필을 검색·자동 이전·삭제하지 않는다.
- Purchase/공문/소식지의 기존 파일 선택·검증·취소/실패 보호, 원본 보존·덮어쓰기 정책을 유지한다. Newsletter의 현재 문서/모든 Revision snapshot 사전 Guard 및 승인 대기 자산 출력 차단을 보존한다.
- Finance는 원본 SQLCipher와 사용자 DPAPI 키, 암호화 백업/복구 계약을 유지한다. 다른 업무 JSON이나 Electron API Key vault로 금융 저장을 대체하지 않는다. 이번에 실제 금융자료·비밀번호를 사용하지 않는다.
- Inventory JSON numeric ID / Preview 합성 데이터 / Local QA UUID DTO는 분리한다. 학교 프로필 변경을 서버 Inventory의 인증·학교 전환으로 해석하지 않는다. Production Local QA 차단을 유지한다.
- AI Key는 Main 소유이며 선택한 경우 Windows 암호화 저장을 사용한다. 사용자 확인 없는 업무 원고 전송은 하지 않는다. BOGUNON 계정 연결·ChatGPT 계정 연결 미지원 문구는 그대로 유지한다.
- 서버/RLS/SQL/migration·운영 Supabase·실제 학교 계정·개인정보에 접근하거나 변경하지 않는다.

## 이번 Cloud 검증

- 새 브랜치에서 최소 연결 경계 테스트 16파일 **49개 고유 테스트 최종 PASS**: Memo IPC, Finder export Preload, Purchase 저장 경계, Newsletter 승인/미지원 스키마 Guard, 업무·Inventory·AI·Finance·행정/학교 Preload, Finance 원본/패키지 계약, 설정 EPERM, Surface modal/nonmodal, 네트워크 정책.
- 최초 실행의 Finance provenance 1건은 새 worktree에 production build의 `p0-renderer-boundary.json`이 아직 없어 ENOENT였다. build 완료 후 해당 파일의 4건만 재실행해 모두 통과했다. 제품 코드/테스트 assertion을 바꾸지 않았고 나머지 PASS 테스트를 다시 실행하지 않았다. 49는 재실행 중복을 제외한 고유 건수다.
- `npm run electron:p0:build` **PASS**: Main/Preload·Renderer·테스트 TypeScript와 Vite production build, closed-renderer 검사가 포함된다. 새 통합 디렉터리에서 실행했다. 빌드 대상 제품 코드는 기반과 동일하며 최종 문서 커밋 이후에도 runtime diff가 없음을 확인한다.
- 기존 ASAR runtime 패키징 검사 **3 PASS**: 실제 electron-builder files 선택 규칙·Main/Preload 전체 상대 의존성 graph·Windows ASAR 경로 처리. Finance provenance는 builder의 실제 extraResources 병합으로 native CLI 3개 경로 설정도 검증한다. Linux에서 Windows 바이너리가 실제 만들어졌다는 뜻은 아니다.
- lint 스크립트는 없다. `git diff --check`, 변경 범위·민감정보·계보 및 제품 소스 동일성 검사를 수행한다. 루트 Tauri 타입 검사·전체 회귀·Rust 전체 테스트·외부 API 호출·DB E2E를 새로 실행하지 않는다. 기존 학교 프로필 53 PASS 및 과거 Windows PASS는 별도 과거 근거이며 이번 49개에 합산하지 않는다.

## 다음 Windows 통합 실행본 준비

현재 상태: **소스 및 기존 빌드 진입 명령 준비 완료 / 새 Portable·EXE 해시·Windows 실화면 NOT RUN**. 이번에 Actions를 실행하거나 Artifact를 만들지 않았다. 과거 `c06ce6a…` EXE를 새 기준본의 실행본으로 재명명하지 않는다.

승인 후 기존 Windows 빌드 runner의 격리 작업 폴더에서 다음 순서로 준비한다. 학교 PC의 기존 WIP/worktree나 운영 앱 폴더에서는 clone·npm ci·Cargo 빌드를 수행하지 않는다.

1. 원격 `integration/electron-feature-baseline`의 승인된 전체 SHA를 고정 checkout하고 HEAD·clean을 확인한다. QA/CI SHA와 제품 source SHA는 별도로 기록한다.
2. 기존 Node/Rust MSVC 환경과 `npm ci`를 사용한다. 새 의존성/전역 도구 설치나 새 workflow를 추가하지 않는다.
3. **기존 `npm run electron:p0:package:win`**을 사용한다. 이 명령은 Purchase·Official Document·Finance CLI 3개를 locked release build한 뒤 Electron production build와 Portable 패키징을 수행한다. NSIS가 별도 승인 대상이면 기존 builder에 `--win nsis --x64 --publish never`를 사용한다. 실제 설치/제거는 별도 범위다.
4. beforePack의 ASAR 누락 차단·3개 native 파일 사전 존재 확인을 그대로 사용한다. 생성된 `app.asar`의 전체 런타임과 실제 `resources/{purchase-excel-cli,official-document-cli,my-finance-cli}/*.exe` 3개, build-meta의 정확한 sourceSha·dirty:false를 검증한다. sourceSha 불일치/누락 시 실행본 제공을 중단한다.
5. 최종 Portable EXE의 SHA-256·서명 상태·manifest·Artifact 이름을 기록한다. 코드 서명이 없으면 명시하고 Windows 실행 PASS와 구분한다. 기존 beforePack 검사와 `runtime-package.test.mjs`를 재사용한다.
6. GUI 실행이 별도로 승인되면 기존 독립 Portable 실행 방식을 재사용한다. NSIS 런처를 Playwright `electron.launch()`에 직접 넣지 않는다. 실제 런처/자식 Electron·창을 식별하고 합성 QA 프로필로 기존 파일 기능·학교 설정/외부 브라우저·Finance를 필요한 경로만 묶어 확인한다. 소형창의 긴 한글 업무명 overflow를 후속 목록에 유지한다. 실제 학생·교직원·금융 자료는 사용하지 않는다.

### 그대로 실행하면 안 되는 과거 경로

- `.github/workflows/electron-p0-windows.yml`와 `scripts/electron-p0/windows-check.mjs`는 오래된 기준 SHA/범위와 전체 설치·제거 경로가 포함돼 있다. 현재 소스용 최소 패키징 작업으로 자동 승계하지 않는다.
- `.github/workflows/electron-cloud-g1.yml`의 native build 단계는 Purchase/공문 2개만 빌드하므로 Finance를 요구하는 현재 beforePack에서 충분하지 않다. 다음 실행 시 기존 경로에 승인된 SHA와 이미 존재하는 Finance build 명령이 반영돼야 한다. 이번에 workflow를 수정하거나 이 문제를 우회하지 않았다.
- 과거 SHA 고정 CI·Windows GUI·DB 테스트 성공을 새 Source SHA의 성공으로 표기하지 않는다. 새 Windows 실행본이 나오기 전 사용자 실자료 투입·운영 배포를 권장하지 않는다.

## 유지하는 미지원·미검증 범위

BOGUNON 계정/등록 학교 동기화, ChatGPT 계정 사용량 기반 호출, 실제 YouTube 검색, 운영 Inventory 연결, Tauri 데이터 자동 이전은 제공하지 않는다. 교육청 공식 URL 기본값 검토는 별도 잔여 작업이다. 실제 Windows 금융 DPAPI·native 파일 UI·외부 인증·설치·DPI/다중 모니터는 이 통합본에서 미검증이다. 이를 완료 기능으로 승격하지 않는다.
