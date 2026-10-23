# Dashboard / Dock

## 목적

달력·오늘 업무·D-Day·급식 등 위젯을 한 화면에 제공하고 Dock과 명령 팔레트로 전문 작업실에 진입한다.

## 확정 요구사항

- 기존 위젯형 Dashboard와 하단 Dock 유지
- 기능별 작업실 진입과 Dashboard 상태 보존
- 기능 개발 완료 후 공통 UI/UX 통일
- Desktop Surface 작업과 충돌하지 않도록 Main Workspace의 소유권 유지

## 현재 구현 범위

`origin/main@97f9ee9`에 widget registry, layout/preset, Dock registry, DashboardCanvas, 일정·Inbox·Quick Add가 포함된다. v1 UI refresh는 PR #24의 `0807f2e`로 main에 반영됐다.

구현 상태: `INTEGRATED`.

## QA 상태

`PASS`는 `docs/qa/V1_UI_REFRESH.md`와 `docs/V1_INTEGRATED_WINDOWS_QA.md`가 다루는 기준 SHA 범위에 한정된다. 후속 `feature/dashboard-mint-ivory-v2@b37c247` 및 Surface UI는 이 PASS에 자동 포함되지 않는다.

## 아직 구현·확정하지 않은 범위

- 후속 Dashboard branch의 최종 통합 여부
- Surface projection과 Main widget의 장기 동기화 계약
- 전체 기능 통합 후 디자인 회귀

## 근거 및 연결 관계

- main: `DESIGN.md`, `src/dashboard/**`, `src/dock/**`, `src/components/dashboard/**`
- 후속 branch: `feature/dashboard-mint-ivory-v2@b37c247`
- 모든 작업실의 공통 진입점이며 Desktop Surface와 일정 데이터를 연결한다.

## 위험 및 다음 작업

후속 Dashboard와 Surface의 CSS/token 차이를 공통 디자인 단계에서 비교하고, Dock 항목과 focus 복귀를 기능별로 회귀한다.
