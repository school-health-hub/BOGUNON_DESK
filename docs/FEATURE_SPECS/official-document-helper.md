# Official Document Helper

## 목적

공문·안내문 작성, 기존 문서 가져오기·요약, 개인정보 검사, AI 전송 전 확인과 출력 준비를 한 작업실에서 제공한다.

## 확정 요구사항

- 문서 작성·가져오기·요약
- 개인정보 검사와 AI 전송 전 명시적 확인
- 기존 공문 관련 작업과 증거 보호
- 참고자료 패키지와 로컬 파일 처리의 안전한 저장

## 현재 구현 범위

- main에 기본 공문 작업실, session, privacy guard, import service가 존재
- `feature/official-document-enhancement@344cf66`: B-lite UI, 참고자료 패키지, Rust IPC, 출력 품질 개선
- 구현 상태: `IMPLEMENTED`, enhancement는 main 미통합

## QA 상태

`PASS` at `344cf66`의 문서 기록:

- 품질 계약 `47 PASS / 0 FAIL / 2 REVIEW / 0 NOT RUN`
- 기존 공문 회귀 테스트 209건 통과

근거: branch의 `docs/qa/OFFICIAL_DOCUMENT_OUTPUT_QUALITY_QA.md`, `docs/OFFICIAL_DOCUMENT_QA_PATHS.md`, `docs/OFFICIAL_DOCUMENT_REFERENCE_PACKAGE.md`. 이는 이후 변경이나 실제 학교별 서식 정책 REVIEW를 자동 승인하지 않는다.

## 아직 구현·확정하지 않은 범위

- enhancement의 main 통합
- 두 REVIEW 항목의 학교 적용 정책
- Desktop Surface command manifest와 Main-only IPC 경계 통합

## 연결 관계

Workspace Library에 결과물을 전달하고, 파일 drop·Dashboard·Dock에서 진입한다. Surface renderer에는 공문 원문이나 Main IPC를 노출하지 않는다.

## 위험 및 다음 작업

`src-tauri/src/lib.rs`, 공용 CSS, command registry 충돌 가능성이 있다. clean integration worktree에서 branch 전체와 QA 자산을 함께 통합 검토한다.
