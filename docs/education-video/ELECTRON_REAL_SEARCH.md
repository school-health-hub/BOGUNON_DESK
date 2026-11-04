# Electron Finder: YouTube 공식 검색 연결

기준: `integration/electron-feature-baseline@362e9ef38e46addb798eefc34c92eda73d7529d3`.
기능 브랜치: `feature/electron-finder-real-search`.

## 사용 흐름

1. Finder → `YouTube 검색 API 연결 설정`을 연다. 사용자가 Google Cloud에서 발급하고 YouTube Data API v3를 활성화한 **전용 API Key**를 클립보드에 복사하여 등록한다. ChatGPT/OpenAI/Gemini 자격증명은 읽거나 자동 재사용하지 않는다.
2. Windows 보안 저장을 기본 선택한다. Main의 `safeStorage.encryptString/decryptString`(Windows DPAPI 기반)과 기존 `replaceSettingsFile` 원자적 교체를 사용한다. 파일은 Electron userData 아래 `work-data/youtube-search/youtube-api-key.bin`이다. 일반 설정 JSON과 Finder 보관함에 키를 넣지 않는다. 보안 저장 불가 환경은 명시적으로 실행 중 메모리만 사용하며 평문 파일로 대체하지 않는다.
3. 저장된 Key는 `저장된 YouTube Key 불러오기`로 복원한다. `Key 설정됨`은 실제 API 권한 검증 성공이 아니다. API 활성화·할당량·키 제한 오류는 검색 응답에서 확인한다. 연결 해제는 이 앱의 YouTube 메모리/저장 Key만 지우며 Google Cloud에서 Key를 폐기하는 작업은 아니다.
4. 교육 주제·대상·희망 길이를 입력하고 개인정보 없는 검색어 전송에 동의한다. Main의 네이티브 확인창에서 실제 전송 검색어를 다시 확인한 뒤에만 요청한다. 학생·교직원 정보, 메모·원고·학교 프로필은 전송하지 않는다. 자동 개인정보 검사는 보조이며 모든 이름을 탐지한다고 보장하지 않는다.
5. 페이지당 최대 10개, 최대 3페이지. `search.list`로 ID를 받고 `videos.list`로 실제 제목·채널·재생시간을 확인한다. 전체 요청 제한은 페이지당 15초, JSON 응답은 요청당 512KiB다. 삭제/비공개 등 상세정보가 없거나 길이를 확인하지 못한 영상은 제외하고 개수를 안내한다. 검색어/권한/할당량 오류·빈 결과를 구분하며 자동 재시도·Mock 대체는 없다.
6. 결과 또는 저장한 실제 영상의 `원본 열기`는 Main이 검증한 11자 videoId로 생성한 `https://www.youtube.com/watch?v=…`만 기본 브라우저에 전달한다. 임의 URL이나 외부 페이지에서 전달한 redirect를 사용하지 않는다.
7. 기존 안내문 작성·직접 수정·메모·보관함 저장·JSON 파일 저장/가져오기/백업을 계속 사용한다. 실제 영상의 안내문에는 Mock 문구를 붙이지 않는다. Mock은 사용자가 별도로 선택한 합성 체험이며 실제 결과와 섞이지 않는다.

## 보안 경계 / IPC

`educationVideo.searchProvider`는 선택적인 typed bridge다. 기존 저장·내보내기·AI 보조 계약은 유지한다.

| IPC 접두사 `p2:education-video:search:` | 인자 | 결과 |
| --- | --- | --- |
| `status` | 없음 | provider/configured/secureStorage/saved (키 없음) |
| `connectFromClipboard` | `{remember:boolean}` | 위 상태. Key는 Main이 직접 읽음 |
| `restore` / `disconnect` | 없음 | 위 상태 |
| `search` | `{conditions:{topic,target,minutes},consent:true,cursor?}` | 검증된 영상 목록, opaque nextCursor, 페이지, 제외 개수 |
| `cancel` | 없음 | null |
| `openVideo` | `{videoId}` | null |

- sender window/mainFrame/URL, 인자 수, 필드 이름과 크기를 검사한다. 키·파일 경로·URL·provider HTTP 옵션을 Renderer에서 받지 않는다. 검색어에는 알려진 개인정보/인증정보 패턴을 거절한다.
- `https://www.googleapis.com/youtube/v3/search`와 `/videos` GET만 전용 비영구 session에서 허용한다. 각 endpoint의 query 항목·개수·고정 파라미터도 검사한다. 쿠키와 캐시는 사용하지 않고 permission과 다운로드를 차단한다. 기존 Renderer 네트워크 제한은 유지한다.
- 발급 Key는 Main 내부에서 요청의 **`key` query parameter**로 넣는다. 이 URL은 비밀정보이므로 로그나 오류에 출력하지 않는다. 응답의 provider 원문 오류, key 또는 내부 URL을 Renderer에 반환하지 않는다. 라이브러리/일반 설정/환경 파일/Git에 인증정보를 넣지 않는다.
- `redirect:error`와 최종 응답 URL 검사를 함께 사용한다. 외부 도메인, 임의 경로, 중복 query, URL/userinfo 주입을 거절한다. API 응답의 URL을 신뢰하지 않고 videoId로 watch URL을 구성한다.
- pageToken은 Main에만 저장한다. Renderer cursor는 임의 UUID이며 현재 연결·검색 조건·페이지에 귀속된다. 추가 요청은 사용자 선택/네이티브 전송 확인마다 한 페이지만 수행한다. 조회 간 중복도 제거한다. Main의 브라우저 열기 캐시는 최근 영상 최대 100개로 제한한다.
- 취소·닫기·navigation·renderer 종료·앱 종료에서 AbortController/세대 검사를 적용한다. 늦은 응답을 무효화하고 종료 시 pending 작업을 정리한다. 이미 완료된 암호화 저장이나 이미 열린 브라우저를 취소로 되돌린다고 표시하지 않는다.

## 데이터 호환성 및 통합

기존 JSON version 1, 필드, 영상 ID별 메모/원고 보존·중복 import 정책을 유지한다. `source:'youtube'`만 `source:'mock'`과 함께 허용하는 가산적 확장이다. 기존 Mock JSON은 그대로 왕복한다. 미지원 source/필드는 계속 거절한다. 구버전 앱은 youtube 항목이 있는 파일을 거절할 수 있으므로 새 항목을 사용하는 보관함은 새 버전에서 열어야 한다. 자동 데이터 이전·삭제는 없다.

Cloud B 통합 시 `finder-search-protocol.ts`, Main provider/service/vault, Main 등록·종료 정리, Preload/Protocol bridge, Finder source enum 및 Main/Renderer 양쪽 JSON 검증을 함께 반영한다. Main 모듈은 기존 builder `main/**` 선택에 포함되며 별도 native CLI나 OCR 변경은 없다. 다른 연결의 vault, Finance/Inventory/학교 프로필·17개 주소·Purchase AI-FIRST/OCR·TD2 Glass와 geometry는 수정하지 않는다. `P0App`에서는 Finder에 bridge를 전달하는 한 줄만 바뀐다. 공유 Finder 컴포넌트는 bridge가 없는 경우 기존 Mock 동작을 유지한다.

## 공식 API 근거 (2026-11-04 문서 열람)

- https://developers.google.com/youtube/v3/docs/search/list
- https://developers.google.com/youtube/v3/docs/videos/list
- https://developers.google.com/youtube/v3/guides/authentication

공개 데이터 검색은 API Key 방식으로 지원된다. 각 페이지의 실제 요청은 search.list 및 필요한 경우 videos.list이며, 상세 조회가 필요 없는 빈 결과는 추가 요청하지 않는다. 할당량 비용/일일 한도는 공식 정책 및 사용자 Google Cloud 프로젝트 설정에 따르므로 앱에서 고정 비용이나 잔여량을 추정하지 않는다. quotaExceeded/dailyLimitExceeded/rateLimitExceeded와 429는 할당량 안내로, 인증/활성화/키 제한 거부는 Key/API 설정 안내로 정규화한다. Key 등록·복원은 네트워크 요청을 발생시키지 않는다.

## Cloud 검증 / 실제 미검증

- 신규 경계와 기존 Finder 회귀: Vitest 9개 파일 **55 PASS**. 요청·응답/위조·중복·페이지·취소/timeout·동의 전 요청 0회·할당량·typed Preload·암호화 저장 모의 cipher·원본 보존·혼합 JSON/백업/재가져오기·기존 Mock/AI 슬롯/내보내기를 확인했다.
- `npm run electron:p0:build`: Main/Renderer/tests TypeScript 및 Electron production build **PASS**. 기존 chunk-size 경고는 유지. package.json에는 별도 lint/typecheck 스크립트가 없어 새 스크립트를 추가하지 않았다.
- 기존 Main/Preload ASAR 의존성 검사로 새 모듈의 builder 포함을 확인한다. Portable/native CLI 재빌드, 새로운 workflow, Windows Actions 실행은 하지 않는다.
- 실제 YouTube API 호출·사용자 Key 등록·실제 할당량/키 제한: **NOT RUN**. 공식 문서 열람과 모의 HTTP 응답 검증을 실서비스 PASS로 취급하지 않는다.
- 실제 Windows safeStorage/DPAPI·클립보드·네이티브 확인창·기본 브라우저·GUI·Portable·프로세스 종료: **NOT RUN**. 실제 키를 사용한 검색은 별도 승인 후 수행한다.
- 판정: **CONDITIONAL** — 구현 및 Cloud 집중 검증 완료, 실제 서비스/Windows 검증 대기.

### 변경 파일 묶음

- Main: `electron-p0/main/finder-youtube.ts`, `finder-search.ts`, `finder-vault.ts`(신규), `main.mts`(등록/정리), `education-video-library.ts`(youtube source 허용).
- 계약: `electron-p0/finder-search-protocol.ts`(신규), `electron-p0/protocol.ts`, `electron-p0/preload/preload.cts`.
- UI: `src/education-video/{EducationVideoFinder,SearchConnection,VideoResults,MessageEditor}.tsx`, `src/education-video/{model,library}.ts`, `electron-p0/renderer/P0App.tsx`.
- 테스트: `electron-p0/tests/finder-{youtube,search,vault}.test.ts`, `finder-search-ui.test.tsx`, 기존 `education-video-{model,library,export-preload}.test.ts` 확장.
- 문서: 이 문서. 총 23개 텍스트 파일이며 패키지/의존성·native CLI·OCR·workflow 변경은 없다.
- `node --test scripts/electron-p0/runtime-package.test.mjs`: **3 PASS**, 실제 builder 선택 규칙과 ASAR Main/Preload 상대 의존성 포함 검사 완료. diff·비밀정보·보호 경로 변경 검사 PASS.
