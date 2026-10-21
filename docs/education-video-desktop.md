# AI 교육영상 Finder v1.1 — Phase 2B 로컬 준비

## 실행과 범위

이 worktree에서 `npm run dev -- --host 127.0.0.1 --port 1421`을 실행하고 업무 도구의 **AI 교육영상 Finder · Mock**을 선택합니다.

기본 로컬 Mock은 조건에 맞춰 합성 결과 12개를 만들고 ±3분을 우선 표시합니다. ±5분과 전체 보기로 확장합니다. 제목·채널·ID·URL은 합성 fixture로 실제 영상 존재를 검증하지 않았습니다. 안내문에도 합성 경고를 포함합니다. 교육명·대상·일시/기간·안내사항을 입력하고 결정적 템플릿으로 생성·수정한 뒤 교사 확인 후 복사합니다. 누락 정보는 만들지 않으며 AI·자동 발송·영상/자막 다운로드는 연결하지 않습니다.

**서버 검색 준비**는 기존 BOGUNON 로그인 세션을 사용합니다. 로딩·로그아웃·만료 상태에서는 요청하지 않습니다. 토큰 읽기 중 인증이 바뀌면 전송하지 않고, 응답 대기 중 계정 변경/로그아웃 시 결과를 버립니다. 토큰은 기존 보안 저장소의 Supabase 클라이언트에서 읽으며 라이브러리에 저장하지 않습니다.

전용 `education_video_search` Tauri 경로는 이번 단계에서 실제 외부 전송을 항상 차단합니다. 브라우저 역시 실제 서버 검색을 실행하지 않습니다. 테스트 주입 응답은 실제 API 검증이 아닙니다. 0~12개 응답, 길이 미확인(null), 인증/quota/상위 서비스 오류를 처리합니다. 길이 미확인 결과는 전체 보기에서 표시합니다.

## 공식 채널

`src/education-video/officialChannels.ts`는 교육부 `UCexUyFaq9YH7XJfCQzVR_jg`, 질병관리청 `UCa7-3Zvxg-5Rfxgu3RQY_gw`의 공식 홈페이지 근거·채널 링크·확인일(2026-10-22)·검토 상태를 관리합니다. officialEvidence machine 필드는 정확한 홈페이지 URL입니다. 이름·구독자 수나 import의 공식 주장으로 판정하지 않습니다. Mock 근거는 합성 표시를 유지합니다. 공식 채널이어도 영상의 교육 적합성을 보증하지 않으며 교사가 최종 선택합니다.

## 라이브러리 v2

Tauri는 `app_local_data_dir()/education-video/library.json`을 사용합니다. v2는 videoId별 teacher(교육 입력·수정 안내문·메모)와 provider(메타데이터 또는 null)를 분리합니다. 원자적 저장·백업·복구는 네이티브 모듈이 담당합니다. [네이티브 계약](education-video-native-phase2b.md)을 참조합니다.

v1 원본 백업을 보존하고 이행합니다. fetchedAt은 저장/갱신 때 초기화하지 않습니다. live 응답은 canonical UTC fetchedAt이 필수이며 30일보다 오래되거나 미래 5분을 초과하면 거부합니다. expiresAt은 최대 fetchedAt+30일이며 더 짧은 만료를 유지합니다. 화면이 열린 동안에도 만료를 반영합니다. 만료·삭제 후 teacher는 유지하고 영상 제목/URL 없는 새 안내문 생성은 막습니다. 기존 교사 안내문은 과거 텍스트임을 확인 후 복사할 수 있습니다.

저장소 접근 시 만료 provider를 정리하며 명시적 삭제는 유효 백업에서도 지웁니다. 앱이 실행되지 않는 동안 파일 삭제 타이머를 보장하지 않습니다. 갱신은 현재 결과의 동일 videoId만 사용하며 외부 호출하지 않습니다. 같은 영상 재선택 시 수정문·메모를 복원하고 import는 기존 teacher를 유지합니다. 한 문서의 중복 ID는 거부합니다. JSON 2MB/1000개 제한, 잘못된 버전/URL/시각/알 수 없는 필드/비밀 필드를 거부합니다. Export에는 메모가 포함되므로 공유 전 확인합니다.

브라우저는 명시된 **브라우저 QA 모드**이며 `bogunon.education-video.browser-qa.v2` localStorage/backup과 별도 v1 원본을 사용합니다. 유효 primary/backup의 만료 provider를 물리적으로 정리하지만 네이티브 파일 내구성 검증을 대체하지 않습니다.

## 다음 단계

실제 API 연결은 별도 승인 후 서버 인증·영속 quota/cache·서버 전용 YouTube 키·승인 목적지를 준비해야 합니다. Desktop 공개 설정은 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`이며 비밀키를 넣지 않습니다. 이번 단계에서 키/토큰/환경값 생성·출력, 운영 DB 변경, 배포는 하지 않았습니다. Phase 1 QA 기록은 역사적 결과이며 Phase 2B 검증과 구분합니다.
