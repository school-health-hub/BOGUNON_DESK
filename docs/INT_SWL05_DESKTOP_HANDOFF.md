# INT-SWL-05 Desktop Surface 인계

기준 HEAD는 `e0182135f8571bda25279775204cf94d5b4da2ab`이다.

- 실제 Preload는 `onOpenTool` 구독 함수와 구독 해제 함수를 제공한다. 라우팅 테스트의 브리지 대역에 해당 함수가 빠져 있었다. 테스트 대역을 수정한 뒤 라우팅 5건과 Palette·Surface 집중 테스트를 합쳐 21건이 통과했다.
- 작은 일반 창의 보기 모드에서 Dock 위 예약 여백을 줄였다. 편집 모드 및 Palette 배치에는 기존 규칙을 적용한다.
- Desktop Surface는 화면별 작업 영역에 맞춘 투명 Electron Palette를 사용한다. 별도 작업 표시줄 항목과 상시 최상위 표시를 사용하지 않는다. [Microsoft의 SetParent 문서](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent)는 서로 다른 DPI 인식 모드를 가진 프로세스 간 부모 변경의 부작용을 명시한다. Explorer 셸 부착을 보장하는 지원 API를 확인하지 못해 기존 Palette 경로를 사용했다.
- 실제 Explorer 재시작, 운영 바탕화면 클릭 전달 및 모니터 분리·재연결은 격리 Windows 데스크톱이 없어 NOT RUN이다.
- Desktop Surface의 최종 판정은 CONDITIONAL이다. SWL-02 EPKI 구현은 기존 정책·비밀 보호·격리 검증 조건이 충족된 뒤 별도 승인으로 진행한다.
