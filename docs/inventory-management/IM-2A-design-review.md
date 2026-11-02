# IM-2A 디자인 검토

## 적용 원칙

- 기존 DESK의 독립 panel/backdrop 계층을 사용했다.
- 흰색·near-white surface, navy 본문, muted mint accent를 유지했다.
- 카드 중첩 대신 요약·목록·상세를 divider와 spacing으로 구분했다.
- 작은 상태 badge만 semantic color를 사용한다.
- 실제 저장 기능처럼 보이지 않도록 합성 데이터 배너를 모든 상태에서 유지했다.

## 데스크톱과 좁은 창

- 1440×900: 목록과 상세를 좌우로 배치한다.
- 브라우저 900×680: 4개 요약을 2×2로, 목록과 상세를 세로로 배치하며 패널 내부 스크롤을 사용한다.
- Native 기준 980×700: 기존 Tauri 최소 크기를 보존했다. 이번 세션에서는 별도 Native/WebView2 실행 캡처를 완료하지 못했으므로 `NOT RUN`이다.

## 접근성

- panel/dialog에 `role=dialog`, `aria-modal`, 제목 연결을 사용했다.
- 검색·필터·닫기 동작은 명시적 accessible name을 가진다.
- dialog는 처음 제목에 포커스하고 Tab/Shift+Tab을 내부에서 순환시킨다.
- 닫기/Escape 후 호출 버튼에 포커스를 복원한다.
- `:focus-visible` outline과 `prefers-reduced-motion` fallback을 제공한다.

## 실제 캡처

최종 CSS revision의 브라우저 캡처는 `.omo/evidence/im-2a/screenshots-final-resume/`에 있다.

- `inventory-main-1440x900.png`
- `inventory-main-900x680.png`
- `inventory-detail-1440x900.png`
- `dialog-register-1440x900.png`
- `dialog-use-900x680.png`
- `search-no-result-900x680.png`

캡처는 합성 배너, 요약·목록·상세, 좁은 화면 stacking, 등록/사용 dialog, 검색 결과 없음 상태를 보여준다. 최종 캡처 검사에서 상태 badge는 79.25×26px, 900px viewport의 `scrollWidth`는 900px로 확인되어 badge stretch와 page-level 가로 넘침이 없었다.
