# 공문작업실 Electron 파일 처리 실행계획

## 고정 기준과 승인 범위

- 사용자 승인: PDF/HWPX/ODT 반입, 승인 템플릿 ODT 저장, 선별 Rust 재사용과 typed IPC, 원고 보존. 추가 승인 없이 구현·집중 검증·원격 보존.
- 기준: `8f0044cd00bdcfe219a2d9ff0decaf4b4b2bede4`.
- 별도 브랜치: `codex/electron-official-document-files-integration`, 별도 worktree 사용. 기존 작업본/원격 WIP 브랜치는 보존.
- 재사용 체크포인트: `5bed512ef8b6bc8421789252b215212c00c9a8ca`. 변경 전 24파일 SHA256/길이 inventory 확인 PASS. 처리 알고리즘은 이 WIP를 선별 재사용하고 기존 Tauri 파일은 변경하지 않는다.
- 현재 연결 환경은 Codex Cloud Linux이며 Windows 세션이 없다. 실제 Windows 파일 처리·native dialog QA는 NOT RUN. 기존 7기능 전체 QA와 GUI 재시도는 하지 않는다.

## 실행 순서

1. 승인 템플릿의 SHA256·구조 계약과 원본 feature/official-document-enhancement의 provenance 확인. 승인 템플릿 확인 실패 시 실제 ODT 저장은 BLOCKED.
2. 원본 Git blob LF PDF(562B)는 실제 CLI에서 PDF unreadable로 거절되었다. authored xref offsets와 일치하는 복구 체크포인트 CRLF(593B)를 실행용 합성 fixture로 확정한다. 알고리즘을 완화하지 않으며 원래 inventory와 PROVENANCE.md의 CRLF 해시를 보존한다. LF 선택은 검증 실패 후 철회했다.
3. 전용 Rust CLI에 bounded stdin JSON import/ODT 생성 프로토콜을 추가한다. 원본 추출/검사/변환을 재사용하고 renderer 경로·임의 명령은 받지 않는다. 기존 Purchase의 shell:false·timeout·출력 제한 실행 패턴과 OS 자원 제한 재사용.
4. main의 선택 파일만 snapshot 후 분석한다. fixed CLI 경로, window/main-frame/URL 검증, bounded 문서 필드, native open/save dialog, 오류 값의 경로/원고 비노출. ODT는 새 파일만 원자 게시하여 기존 원본은 덮어쓰지 않는다.
5. 기존 공문 편집·미리보기·개인정보 경고는 유지하며 반입/저장 버튼만 연결한다. 취소·실패·반입 중 편집/새작업으로 변경된 원고에 늦은 결과를 적용하지 않는다.
6. 합성 자료 focused Rust/IPC/UI 검증, TypeScript 및 production build만 실행한다. Windows 실행기가 없으면 실제 Windows PASS를 주장하지 않는다. 결과/제약을 이 문서와 인계 문서에 기록하고 일반 commit/push·clean·원격 일치를 확인한다.

## 제외 및 완료 판정

승인 reference/AI 신규 기능/디자인 변경/원본 서식·표 구조 보존/실제 학교 자료/운영 데이터·MY FINANCE/자동 이관은 제외한다. 임의 원본 경로·일반 파일 쓰기 IPC·원본 덮어쓰기·PR/main 병합/운영 배포는 금지한다. 자동 검증이 통과해도 Windows 미실행이면 CONDITIONAL이다.

## 구현 결과 및 검증(로컬)

- 전용 CLI는 import legacy 호출을 유지하고 bounded stdin JSON `import`/`odt`를 추가했다. 기존 Purchase runner와 OS 제한(Windows Job Object, Linux rlimit)을 재사용한다. 제한 설정 실패 시 exit 78, 시간 초과/취소 시 프로세스 종료 후 임시 snapshot을 정리한다. core 추출/ODT 검사/변환 알고리즘은 WIP 그대로다.
- 승인 템플릿은 source `6f26310d9d36db6b54ef63870838aa42fe347774:resources/templates/official-document/home-v1.odt`와 바이트 일치. SHA256 `8BC0FD240B1BEA06758794D9F07A75ABF7FAF13BAC1FBDBCDD3556BE3FF6C285`; 매 생성 시 hash/구조 계약 검증. 검증 실패 시 ODT 생성/저장을 차단한다. 원본 공문 서식·표 구조 보존 기능은 추가하지 않았다.
- typed preload API `officialDocument.pick/save/cancel`만 노출. main native 선택만 접근하며 renderer 경로/추가 키/초과 문서를 거부한다. 반입 결과는 basename/format/text만 전달한다. 원고·경로·CLI stderr는 기록하지 않는다. 확인 후 새 ODT 저장은 같은 디렉터리 private staging+fsync+atomic hardlink(no-clobber)를 사용한다. 지원 안 되는 파일시스템에는 덮어쓰기 fallback 없이 실패한다.
- 기존 UI 편집·미리보기·로컬 개인정보 경고는 유지한다. 편집된 본문도 개인정보 검사에 포함한다. 반입 중 편집/종료/취소 후 늦은 결과를 원고에 적용하지 않으며 실패/취소 시 원고를 초기화하지 않는다.
- Linux 집중 검증: 공문 Electron/순수 모듈 6파일 **63 PASS**, Rust **18 PASS / 수동 artifact 1 ignored**, TypeScript(main/preload/renderer/tests)·production build PASS. Rust 초기 WIP와 변경 후 테스트 모두 통과했다. Clippy는 현재 toolchain에 없어 **NOT RUN**이며 추가 설치하지 않았다.
- LF 원본 PDF 562B는 실제 CLI에서 `PDF unreadable`로 거절됨. CRLF 593B는 `Synthetic official document QA`를 추출했다. 실행용 fixture는 WIP 593B를 유지하며 복구 inventory는 변경 전 증거로 보존한다. 이 차이를 엔진 재작성/검사 완화로 우회하지 않는다.
- dev/packaging 스크립트에 fixed CLI build·extraResources·beforePack 존재 검사 추가. Windows release CLI는 static CRT로 빌드하도록 설정했다. 실제 Portable/NSIS 패키지 생성·실행은 이번 범위에서 **NOT RUN**.
- Windows는 새 집중 CI에서 Rust와 이 6파일/타입/빌드만 실행한다. 이전 PASS 7기능 전체 QA/GUI는 재실행하지 않는다. CI 결과와 실제 Windows PC 결과는 별도로 기록한다.

## Windows 집중 CI 및 최종 인계

- 검증 구현 SHA `b0d3545dedcf336b3e6529db391c878379e096ff`.
- [Windows CI 41401980509](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41401980509) **SUCCESS**. Windows Rust 계약/CLI, 실제 CLI를 통한 PDF/HWPX/ODT 반입·승인 템플릿 생성/재반입·새 파일 저장·원본 보존, 공문 IPC/UI 계약 테스트와 TypeScript/production build가 통과했다. native dialog는 테스트 포트로 대체하므로 실제 대화상자 PASS를 의미하지 않는다.
- 후속 마감 변경은 이 결과 문서와 기존 선택적 전체 패키징 스크립트의 CLI 선행 빌드 1줄이다. `node --check` PASS. 이 선택적 전체 흐름은 실행하지 않았으며 `[skip ci]` 마감으로 집중 CI를 불필요하게 반복하지 않는다. 기능 구현/테스트 소스는 위 검증 SHA 그대로다.
- **실제 Windows Codex/학교 PC NOT RUN**: 현재 연결 실행기는 Linux다. 사용자 PC native open/save/취소·한글 경로, 앱을 통한 ODT 저장·외부 ODT 프로그램 열기/인쇄, 취소/권한 오류 후 편집 상태, 패키징된 CLI와 일반 사용자 실행은 미검증이다. Portable/NSIS 생성/설치·7기능 전체 QA·GUI 재시도는 하지 않았다. Clippy NOT RUN(도구 미설치).
- **최종 CONDITIONAL**: 승인 범위의 연결 및 Linux/Windows 집중 자동 검증은 통과. 설치 앱/실기기 사용 가능 최종 승인은 남긴다. 기존 Tauri 원본, 운영 자료, reference, AI, 디자인 및 원본 서식/표 구조 보존은 이번 변경 대상이 아니다.
- 다음 단계: 학교 PC 별도 worktree에서 최종 SHA를 확인하고 합성 파일로 native 반입/취소·편집 중 취소, 새로운 한글 ODT 저장/기존 대상 거절, 실제 ODT 프로그램 열기와 승인 템플릿 결과를 집중 확인한다. 기존 7기능 전체 QA를 다시 돌리지 않는다. 저장은 hardlink 지원 로컬 디스크를 사용하며 미지원 파일시스템 실패를 덮어쓰기 fallback으로 바꾸지 않는다.
