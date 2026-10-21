# AI 교육영상 Finder v1.1 — Phase 1

## 실행

기존 작업 브랜치를 변경하지 않고 `BOGUNON_DESK-education-video` worktree에서 실행합니다.

- `npm run dev -- --host 127.0.0.1 --port 1421`
- 앱의 업무 도구 → AI 교육영상 Finder · Mock 선택.
- 교육 주제, 검색 대상, 희망 길이(1~180분)를 입력하고 Mock 검색.
- 합성 결과12개를 만들고 기본 ±3분 필터(10분 조건에서7개)로 보여줍니다. ±5분은11개, 전체는12개입니다.
- 제목·채널·길이·fixture URL을 비교하고 영상을 선택합니다.
- 교육명, 대상, 일시/시청기간, 안내사항을 입력하면 독립 결정적 템플릿으로 안내문을 생성합니다.
- 편집하면 확인 체크가 해제됩니다. 확인 후에만 복사할 수 있습니다. 자동 발송은 없습니다.

## Mock 경계

제목, 채널, 영상 ID, 검증 레지스트리는 모두 합성입니다. URL은 YouTube 형식의 fixture로 실제 영상 존재를 확인하지 않았습니다. 안내문에도 합성 Mock 경고를 포함합니다. 채널 이름·구독자 수로 공식 여부를 추정하지 않습니다. 실제 공식 채널 레지스트리는 Phase2에서 확인 근거와 함께 별도 관리해야 합니다.

현재 화면은 네트워크 검색·외부 AI 호출을 하지 않습니다. AI 다듬기는 미연결 안내만 표시합니다.

## 저장

Tauri 앱은 Rust 명령으로 `app_local_data_dir()/education-video/library.json`의 version1/items 저장소를 사용합니다. 원자적 저장·백업·복구는 네이티브 모듈이 담당합니다. 파일형식 필드는 video metadata, 교육 입력, 수정 안내문, 사용자 메모뿐이며 인증/키 필드를 거부합니다.

브라우저 실행은 명확히 표시된 **브라우저 QA 모드**입니다. `bogunon.education-video.browser-qa.v1` localStorage 및 이전 값 backup만 사용하며 네이티브 파일 내구성을 검증한 것으로 볼 수 없습니다.

같은 영상 선택은 저장된 수정문·메모를 불러옵니다. 저장은 명시적 편집을 반영합니다. Import는 기존 같은 videoId 항목의 수정문·메모를 유지합니다. Export/Import JSON은2MB/1000개 이내이며 손상·미지원버전·잘못된URL·알 수 없는 필드는 거부합니다. 가져오기 파일에 개인 메모가 포함될 수 있으므로 공유 전 확인합니다.

실제 API 연결 전 Desktop의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` 설정과 웹 서버 인증·quota/cache·YouTube 키 준비가 필요합니다. 키 값은 저장소에 넣지 않습니다.
