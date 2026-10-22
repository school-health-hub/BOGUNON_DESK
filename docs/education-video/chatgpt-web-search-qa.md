# ChatGPT 교육영상 Finder 구현·합성 QA

2026-10-22, Desktop feature/education-video-finder, 기준 0f0110ada3af13d322934a50865107f3f1e29973.
구현과 합성 검증을 완료했으며 실제 AI 검색·OAuth·운영 DB·배포는 실행하지 않았다. 이 단계에서 commit/push는 하지 않았다.

## 결과

- PASS: 대상 Vitest 31개 파일 232/232.
- PASS: TypeScript 및 `npm run build` (frontend only). 500kB 초과 번들 경고는 남아 있으나 빌드는 성공했다.
- PASS: 기존 경량 Rust harness 43개, 실패 0, 별도 stdin/stdout interop 1개는 명시적으로 ignored.
- PASS: 실제 Edge 155의 합성 브라우저 흐름. 375/768/1280px × 9개 상태 = 27개 캡처. 초기/확인/결과/검토/빈 결과/오류/수동 URL/출처 부족/잘못된 응답.
- PASS: 검색 전 확인, 3개 카드, 공개 소개정보 검토, 저장, 기안 전달 callback, 빈 결과·오류·수동 대안. 실제 공문 세션/기안 생성기 연결은 별도 컴포넌트 테스트로 검증했다. 실제 네트워크 E2E는 아니다.
- PASS: 브라우저 페이지 오류 0, 허용하지 않은 외부 요청 0, 21개 주 캡처의 가로 넘침 0. 추가 6개 상태는 후보 0개 유지.
- PASS: 코드·요구사항·공식 계약·보안·독립 QA 및 두 시각 검토. 마지막 두 검토는 27개 캡처 전부를 확인했다.
- PASS: `git diff --check`. 설치된 전용 secret scanner가 없어 변경 파일에 대한 키/JWT/개인키 패턴의 best-effort 검사만 수행했다. 실제 비밀값은 읽거나 출력하지 않았다. 이 검사는 모든 개인정보/비밀을 탐지한다는 보장이 아니다.

## 실제 사용으로 확인한 위험 가설

1. 전송 확인 전 호출 또는 계정/모델/동의 변경 뒤 응답 혼입: UI 테스트에서 미호출·오래된 응답 무효화를 확인했다.
2. 본문이 만든 URL·제목·길이·기관의 무근거 수용: 출처 일치 테스트와 브라우저 출처 부족 상태에서 후보 배제, 미확인 기관/길이 유지가 확인됐다.
3. AI 출처 추가·만료·중복 저장·삭제로 교사 메모 손실: TS 라이브러리 회귀와 실제 native store harness에서 메모 보존·원본/백업 삭제 일치를 확인했다.

브라우저 사용 중 좁은 화면의 후보 번호 줄바꿈과 QA fixture의 공통 확인창 CSS 누락을 발견해 수정한 뒤 모든 캡처를 새로 생성했다. 실제 앱의 공통 확인창 구현을 대체하지 않았다.

## 재현 명령

```sh
node node_modules/vitest/vitest.mjs run src/education-video src/chatgpt src/official-document src/components/desktop/OfficialDocumentPanel.interaction.test.tsx src/components/desktop/OfficialDocumentPanel.test.tsx
node node_modules/typescript/bin/tsc --noEmit
npm run build
cargo test --offline --manifest-path src-tauri/education-video-harness/Cargo.toml
git diff --check
node node_modules/vite/bin/vite.js --config vite.education-video-qa.config.ts --host 127.0.0.1 --port 5197 --strictPort
```

마지막 명령은 별도 합성 QA 서버다. `/ai.html` 및 `?mode=empty|error|unsupported|insufficient|malformed`에서 재현한다. 실제 OAuth 공급자를 mount하지 않는다. 로컬 서버로만 접속하고 외부 연결은 하지 않는다. 실제 앱 계정 연결과 구분한다.

## 로컬 증거와 한계

이번 PC의 `.omo/evidence/chatgpt-finder/`에 테스트 JSON·build/native 로그·브라우저 드라이버·27개 PNG·브라우저 JSON이 있다. `.omo`는 Git 제외이며 전송/업로드하지 않았다. 소스와 합성 fixture로 재현할 수 있지만 다른 PC에서 복원을 검증한 것은 아니다.

전체 Tauri/Windows native 빌드는 실행하지 않았다. harness는 실제 파서·요청 본문·라이브러리 코드를 검사하지만 새 Tauri 명령과 전체 OAuth/reqwest 모듈의 통합 컴파일·실제 실행을 대신하지 않는다. 실제 계정의 웹 검색 권한, 사용량·비용, 실제 검색 출처와 원본 영상 대조는 별도 승인이 필요하다. 기존 YouTube Desktop·Proxy 외부 dispatch는 모두 false이며 Proxy 파일은 변경하지 않았다.

## 변경 파일

- `DESIGN.md`
- `docs/education-video/chatgpt-web-search-qa.md`
- `docs/education-video/chatgpt-web-search.md`
- `qa-education-video/ai.html`
- `src-tauri/education-video-harness/lib.rs`
- `src-tauri/src/chatgpt/commands.rs`
- `src-tauri/src/chatgpt/plan.rs`
- `src-tauri/src/chatgpt/plan/web_search.rs`
- `src-tauri/src/chatgpt/plan/web_search_parser.rs`
- `src-tauri/src/education_video/ai_metadata.rs`
- `src-tauri/src/education_video/legacy.rs`
- `src-tauri/src/education_video/mod.rs`
- `src-tauri/src/education_video/model.rs`
- `src-tauri/src/education_video/phase2_tests.rs`
- `src-tauri/src/education_video/store.rs`
- `src-tauri/src/education_video/tests.rs`
- `src-tauri/src/lib.rs`
- `src/App.tsx`
- `src/chatgpt/ChatGptConnectionContext.tsx`
- `src/chatgpt/chatgptPlanService.ts`
- `src/chatgpt/types.ts`
- `src/chatgpt/webSearch.test.ts`
- `src/chatgpt/webSearch.ts`
- `src/education-video-qa/ai-main.tsx`
- `src/education-video/AiVideoDraftConfirmation.tsx`
- `src/education-video/AiVideoFinder.test.tsx`
- `src/education-video/AiVideoFinder.tsx`
- `src/education-video/AiVideoFinderCards.tsx`
- `src/education-video/ConnectedFinder.test.tsx`
- `src/education-video/ConnectedFinder.tsx`
- `src/education-video/LibraryPanel.tsx`
- `src/education-video/aiFinder.css`
- `src/education-video/aiLibrary.test.ts`
- `src/education-video/aiLibrary.ts`
- `src/education-video/aiLibraryMetadata.ts`
- `src/education-video/aiVideo.test.ts`
- `src/education-video/aiVideo.ts`
- `src/education-video/library.ts`
- `src/education-video/libraryBrowser.test.ts`
- `src/education-video/libraryV2.ts`
