# BOGUNON DESK Design Variants

> 목적: 기존 `DESIGN.md`를 교체하지 않고 main 기준과 미통합 기능별 디자인 차이를 기록한다.
>
> 기준 main: `97f9ee9a6fe6ba93b7bfb7a89707902c7b4f2d96`

## 확정 공통 원칙

- Desktop-first 업무 UI
- Sehwa Navy를 주색으로, Mint와 Ivory를 보조색으로 사용
- 기존 위젯형 Dashboard와 하단 Dock 유지
- 카드·버튼·입력·타이포그래피의 일관성
- 안정적이고 차분한 업무용 정보 밀도
- 창 크기와 DPI에 따른 overflow·focus·접근성 보장
- 기능별 디자인은 전체 기능 안정화 이후 공통 기준으로 통합

현재 공통 기준은 [DESIGN.md](../DESIGN.md)다. 아래 항목은 자동으로 공통 기준에 포함되지 않는다.

## Main 디자인 기준

- branch/SHA: `origin/main@97f9ee9`
- 근거: `DESIGN.md`, `docs/qa/V1_UI_REFRESH.md`
- 범위: 통합 Dashboard, Dock, 위젯 배치·스타일, workspace edit/view 경계
- 상태: 현재 공식 기준

## Surface UI 변경

- branch/SHA: `feature/desktop-surface-widget-ui@2c50e45`
- 변경: `DESIGN.md` 9줄 추가, 별도 `src-surface` renderer와 6개 widget preview
- 상태: 미통합 제안/구현
- 검토: Main과 Surface의 토큰 공유 범위, renderer import boundary, Surface 전용 크기·투명도·상호작용

## 공문작업실 변경

- branch/SHA: `feature/official-document-enhancement@344cf66`
- 근거: branch의 `DESIGN.md`, `src/styles/components.css`, `docs/qa/OFFICIAL_DOCUMENT_OUTPUT_QUALITY_QA.md`
- 변경: B-lite 데스크톱 패널, 문서 입력·미리보기·출력 UI
- 상태: 기능 디자인은 구현됐으나 공통 DESIGN에 미통합
- 검토: Dashboard modal 계층, header/button/input token, 980×700 main 창과 작은 QA 창 차이

## Education Video Finder 변경

- branch/SHA: `feature/education-video-finder@8c2172f` + dirty 19건
- 근거: branch의 `DESIGN.md`, `docs/education-video-*`, `src/education-video*`
- 변경: 검색·선택·추천·라이브러리 카드와 QA 표면
- 상태: 미통합, dirty 변경 존재
- 검토: 검색 결과 카드 정보 밀도, source attribution, AI 상태·오류 표현, library navigation

## MY FINANCE 변경

- branch/SHA: main 통합 문서와 `feature/my-finance-2-redesign@dc6772c`
- 근거: `docs/MY_FINANCE_PHASE2.md`, `docs/MY_FINANCE_WINDOWS_QA.md`, branch의 `DESIGN.md`
- 변경: 개인 재무 전용 화면과 확인·백업 흐름
- 상태: 기본/Phase 2는 main 통합, redesign 후보는 미통합
- 검토: 보건업무 화면과의 시각적 연속성을 유지하되 데이터·navigation 경계는 명확히 분리

## 통합 전 필수 비교

1. CSS token과 raw color 중복
2. 전역 selector와 기능별 selector 충돌
3. Dock·modal·Surface z-index 및 focus 복귀
4. 1440×900, 1280×720, 980×700, 고 DPI
5. keyboard navigation, dialog label, focus trap, reduced motion
6. Main-only 데이터가 Surface에 노출되지 않는지 확인
7. 각 기능의 최신 clean SHA 및 QA 상태 재확인

공통 `DESIGN.md` 수정은 별도 디자인 통합 승인 단계에서 수행한다.
