# E — UX-CLEANUP-02 충돌 지도

기준: UX-CLEANUP-02 `2408941e0abde536d967bcf7e8238d2800b4cdb2`. 이 브랜치에는 이미 `e433817` 다중 모니터 Desktop Palette 계약이 포함된다.

| 파일/영역 | 실제 겹침 | 잠재 충돌 | 처리 |
|---|---|---|---|
| `DESIGN.md` | 실제: 화면/Palette/다중 모니터 계약 추가 | 새 01 문구가 이전 계약을 중복·모순시킬 수 있음 | UX 완료 후 최종 문서에 보완 조항만 선별 적용 |
| `src/components/dashboard/DashboardCanvas.tsx` | 실제: WidgetLibrary hide callback/편집 흐름 | 화면 배치가 같은 state를 덮으면 custom geometry 손실 | 기존 reducer/좌표 보존 경로 재사용, device profile은 별도 |
| `DesktopWidgetLayout.tsx`, `WidgetFrame.tsx` | 실제: visible geometry와 설정 진입 | monitor ownership을 grid visibility로 대체하면 자동 복제/숨김 위험 | ownership projection과 widget visibility 분리 |
| `DesktopSettingsPanel.tsx`, `SettingsCenterSections.tsx` | 실제: 공식 로고 및 안내 polish | 새 “화면 배치”가 기존 화면 꾸미기 CTA와 경쟁 | 같은 화면 섹션에 별도 subpanel, 기존 CTA 유지 |
| `src/styles/dashboard.css` | 실제: Settings 로고 규칙 4줄 | preview/controls selector가 전역 panel 규칙과 충돌 가능 | `.display-layout-*` namespace와 기존 token만 사용 |
| `src/styles/release-ui.css` | 직접 변경 없음 | Settings/card 공통 override에 간접 영향 | 신규 raw 색/반경 금지, token 상속 |
| Dock/Palette | UX-CLEANUP-02 계보의 `e433817`에서 실제 구현 | 두 Dock, 자동 widget 복제, click-through 전역화 | 단일 Dock·전역 데이터·화면별 ownership 계약 보존 |
| NS-05/Newsletter | `2408941`에서 실제 다수 수정 | 공통 CSS 또는 widget registry 변경 시 회귀 | Newsletter 파일/CSS/AI 엔진 `720057c` 무변경 보호 |
| SWL | 직접 겹침 없음 | Dock registry/action ID 변경 시 실행기 회귀 | `b07fae5` 계약과 action ID 유지 |

## 통합 순서

1. UX-CLEANUP-02가 완료된 뒤 그 **최종 Source SHA**를 고정한다.
2. 그 SHA에서 파일별 3-way 비교를 다시 수행한다.
3. `e433817`의 도메인 계약을 기준으로 Tauri/Electron 실제 런타임 소유자를 결정한다.
4. Settings UI와 device-only schema를 먼저, display projection을 다음, click-through/Dock 복구를 마지막으로 분리한다.
5. RC2/RC3, NS-05, Newsletter AI, SWL의 파일 해시와 action/schema 호환을 회귀 gate로 둔다.

현재 제안 기준선은 `2408941…`가 아니라 **UX-CLEANUP-02 완료 후 새 최종 SHA**다. 현재 SHA는 감사 시점의 중간 기준일 뿐이다.

RC2 EXE·전용 증거 manifest와 RC3 ref/SHA는 감사 위치에서 확인되지 않았다. DESKTOP-LAYOUT-02 착수 조건은 README의 승인 경계를 따른다.
