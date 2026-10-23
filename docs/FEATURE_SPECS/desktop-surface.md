# Desktop Surface

## 목적

Windows 바탕화면에 일정·오늘 업무·D-Day 등 제한된 업무 위젯을 부착해 일반 작업실 창을 열지 않아도 핵심 정보를 확인하게 한다.

## 확정 요구사항

- Always on Top과 구분되는 실제 바탕화면 부착형 표면
- 일반 작업실 창 및 기존 하단 Dock과 책임 분리
- Main 전용 업무 데이터·IPC를 Surface renderer에 자동 노출하지 않음
- 실제 부착·분리·재시작·DPI·Explorer 복구는 Desktop Surface 전용 QA에서 검증

## 현재 구현 범위

- `origin/main@97f9ee9`: C2C2/C2D2 CI dispatcher 등록
- `feature/desktop-surface-widget-ui@2c50e45`: 6-widget renderer preview
- `feature/desktop-surface-c2d2-renderer-session@1574e46`: RendererSession ownership/cleanup local checkpoint, clean, upstream 없음
- `feature/desktop-surface-probe-9b1@160eec4`: Windows capability probe

구현 상태: `PARTIAL`. 통합 기준의 완성된 Surface로 간주하지 않는다.

## QA 상태

`NOT VERIFIED`. CI 계약과 개별 테스트가 존재하나 최신 Surface UI와 RendererSession checkpoint를 함께 검증한 실기기 결과가 없다.

기존 증거: branch별 `docs/DESKTOP_SURFACE_C0_VERIFICATION.md`, `DESKTOP_SURFACE_C2A_DESIGN.md`, `DESKTOP_SURFACE_C2D2_RUNTIME_QA.md`, `DESKTOP_SURFACE_V2_INTEGRATION.md`.

## 아직 구현·확정하지 않은 범위

- 최신 Surface UI와 RendererSession의 통합 기준 SHA
- 최종 attach/detach와 Explorer 재시작 복구
- Main command manifest/ACL의 최종 목록
- 다중 모니터·DPI·로그온/로그오프 실기기 검증

## 연결 관계

Dashboard의 일정·업무 projection을 사용하되 Main 상태의 소유권은 넘기지 않는다. Dock은 일반 작업실 진입점으로 유지한다.

## 위험 및 다음 작업

- upstream 없는 RendererSession checkpoint를 보호하고 독립 QA를 완료한다.
- Surface UI `2c50e45`와 runtime 기준을 고정한 뒤 import boundary, IPC, window ownership을 검토한다.
- [Design Variants](../DESIGN_VARIANTS.md)에서 Main과 Surface의 디자인 차이를 해결한다.
