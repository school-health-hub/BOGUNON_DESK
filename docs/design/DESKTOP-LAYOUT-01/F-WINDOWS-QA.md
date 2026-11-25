# F — Windows QA 계획

현재 결과: 전 항목 **NOT RUN**. 빌드, 앱 실행, 설정 변경을 수행하지 않았다.

## 매트릭스

| 해상도 | 배율 | 단일 | 듀얼 | 기대 |
|---|---:|---:|---:|---|
| 1920×1080 | 100%, 125% | 필수 | 필수 | 20/22/25% 안전 영역, Dock 비침범 |
| 1600×900 | 100%, 125% | 필수 | 필수 | 상단 4군, 중앙 2:1, 하단 정보 유지 |
| 1366×768 | 100%, 125% | 필수 | 필수 | 단일 열/접기, 모든 컨트롤 접근 가능 |

듀얼 조합은 100→125, 125→100 혼합 DPI와 좌/우, 위/아래 배치를 포함한다.

## 시나리오

1. 첫 실행 추천을 거부/선택하고 재시작해 명시 선택 보존 확인.
2. 1대/2대 프리셋 적용·취소·기본값 복원, OS 디스플레이 구성이 변하지 않음을 확인.
3. 보드 대상과 Dock 대상을 각각 선택하고 재시작 복원.
4. 위젯 drag/resize/hide/show 후 저장·복원. custom geometry가 preset projection에 덮이지 않음.
5. 보조 모니터 분리: 앱 crash/focus steal 없음, 임시 안전 배치, 원본 프로필 유지.
6. 재연결: 같은 모니터 복원, 애매한 모니터 자동 병합 없음.
7. 실행 중 DPI 변경/창 이동: work area 재계산, title/control/Dock 접근 가능.
8. 빈 영역 click-through와 카드/Dock/Palette 클릭을 각각 검증. Explorer 아이콘 이동/조작 없음.
9. Dock 모든 action, Command Palette 검색/실행, Desktop Surface view/edit, Settings 복귀 회귀.
10. 시계, 오늘의 보건실, 메모, 알림, 월간 일정, 오늘 핵심 업무, 급식, 날씨/D-Day의 데이터·빈 상태·오류 상태 회귀.
11. NS-05/Newsletter AI와 SWL action/schema가 영향을 받지 않음.
12. RC2 EXE의 승인 경로·SHA-256과 전용 증거 manifest를 받은 뒤 해시 불변 및 provenance 연결 확인 — **현재 NOT RUN / 자료 UNAVAILABLE**.
13. RC3 Source SHA를 받은 뒤 최종 UX-CLEANUP-02 기준과 파일별 비교 및 보호 영역 회귀 — **현재 NOT RUN / 기준 UNAVAILABLE**.

## 증거

각 셀마다 Windows 캡처, 실제 `displayId/workArea/scaleFactor/DPR`, 적용 전후 device profile(비밀·개인정보 제외), focus/z-order 관찰, 재시작 복원 결과를 남긴다. 시뮬레이션 DPR이나 CSS zoom은 native DPI 증거로 인정하지 않는다.
