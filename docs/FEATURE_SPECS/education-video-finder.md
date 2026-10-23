# Education Video Finder

## 목적

교육영상을 검색하고 교육 적합성, 추천 이유, 출처를 검토해 결과를 로컬 라이브러리에 저장한다.

## 확정 요구사항

- 교육영상 검색
- 교육 적합성 검토와 추천 이유 생성
- 결과물 저장
- 기존 Finder 작업과 검증 상태 보호

## 현재 구현 범위

`feature/education-video-finder@8c2172f`에 검색·native 저장·AI 추천·라이브러리·QA surface가 존재한다. 스냅샷 시점에 17 modified + 2 untracked이며 관련 Vitest가 실행 중이었다.

구현 상태: `PARTIAL`.

## QA 상태

`BLOCKED`.

- `docs/education-video-phase1-qa.md`: 합성 UI/contract 검증 PASS
- 전체 Tauri build: vendored OpenSSL/Perl 의존성 문제로 완료되지 않음
- `finder-live-qa-failure-analysis.md`: 최초 live 시도의 정확한 HTTP/status/body가 보존되지 않아 root cause UNKNOWN
- 최신 dirty 19건은 기존 PASS에 포함되지 않음

## 아직 구현·확정하지 않은 범위

- 최신 dirty 변경의 checkpoint와 전체 회귀
- 실제 native/live search 성공 증거
- 실패 진단 receipt와 개인정보·토큰 비저장 확인
- 통합 UX와 Workspace Library 저장 계약

## 근거 및 연결 관계

branch의 `docs/education-video-*`, `docs/education-video/**`, `src/education-video/**`, `src-tauri/src/education_video/**`. 결과는 Workspace Library로 전달될 수 있다.

## 위험 및 다음 작업

실행 중 테스트 결과를 회수하고 dirty 파일을 보존한 뒤, native build blocker와 live API 실패를 분리해 검증한다. 로그에는 prompt, 응답 본문, URL, 계정정보, 토큰을 저장하지 않는다.
