# Changelog

## 0.2.1 공유 베타

### 생기부 도우미

- 검토 전송본, 재시도, 재생성, 중단 흐름을 안정화
- 입력 변경 시 stale response를 차단하고 검토 완료 packet을 보존
- 개인정보 전송 전 재검사와 outbound prompt 보호 강화

### 품의 도우미

- drag/drop 파일 가져오기와 분석 lifecycle 안정화
- XLSX preflight, 셀 제한, 검토 필요 항목 차단 강화
- 에듀파인용 Excel 내보내기 추가
- 에듀파인 파일 contract를 단일 worksheet `품목내역`, A-D `내용/규격/수량/예상단가`로 고정

### 공문 작업실

- AI 전송 전 확인 dialog와 privacy guard 강화
- 요청 lifecycle과 stale response 처리 보강
- 행정 사실 무창작 원칙과 붙임 안전 처리 강화

### Desktop / UI

- 작은 창에서 빠른 메모와 Dock이 겹치지 않도록 최소 화면 layout 수정
- 기존 Windows Tray, autostart, close-to-tray 동작 유지

### Release / Updater

- production candidate를 한 번만 build/sign하고 exact bytes를 downstream QA와 publish에서 재사용
- exact-byte clean-install QA 통과
- `UPGRADE_QA_MODE = SYNTHETIC_0_2_0_ENDPOINT_OVERLAY` 기반 synthetic 0.2.0 → 0.2.1 updater protocol/signature/install/relaunch QA 통과
- immutable versioned objects, release metadata, `latest.json` 순서의 staged production publish 적용
- public latest pointer 검증 후 candidate namespace cleanup
- production release 성공 이후 checkpoint 기반 resume workflow 추가
## 0.1.0 공유 베타

### Workspace

- 12-column Widget Workspace, desk 기본 layout, 프리셋, appearance와 Dock 편집
- 실제 BOGUNON 업무·일정 기반 Today Tasks, Priority Task, D-Day, 알림과 Work Inbox
- 급식·날씨 위젯과 workspace filter

### 업무 흐름

- 업무/일정 Quick Add와 구분된 수행일·선택적 마감일
- session-only Quick Memo와 BOGUNON 업무 초안 handoff
- 이 PC 전용 Work Folder Favorites와 업무포털 launcher

### 품의 도우미

- XLSX/XLS/CSV/텍스트형 PDF 로컬 분석
- 수동 column mapping, import template, 품목내역, 품의문, 구매결과 정리와 export

### 공문 작업실

- 새 공문 작성, 받은 공문 수정, 공문 핵심정리
- PDF/HWPX 로컬 import와 근거 기반 기본 핵심정리
- 명확한 제출기한을 Quick Add 마감일로 넘기는 BOGUNON 업무 handoff

### 선택형 AI

- session-only API Key를 사용하는 OpenAI/Gemini 연결
- provider-neutral AI prompt와 개인정보 preflight

### Windows

- Tray, close-to-tray, autostart, opt-in 업무 요약 알림
- 3단계 first-run onboarding과 공유 베타 version 표시
- Windows 10/11 x64용 NSIS installer release workflow
