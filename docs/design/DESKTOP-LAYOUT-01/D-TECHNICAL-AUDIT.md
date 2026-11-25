# D — 기술 감사와 구현 설계

## 근거별 판정

| 영역 | 근거 (SHA/파일) | 판정 | 후속 위험 |
|---|---|---|---|
| Desktop Surface probe | `b44c6c6`, `src-tauri/src/desktop_surface/{probe,windows,state}.rs` | 재사용: Progman/WorkerW를 읽기만 하고 정상 창을 기본으로 둔다 | attach 구현이 아니며 모니터 API도 없다 |
| Palette 다중 화면 | `e433817efc438a188dc21a00a34c81e9f7ec0af7`, `electron-p0/main/desktop-surface-{controller,domain,mode}.ts`, `desktop-palette.ts`, `palette-protocol.ts`, `renderer/palette/PaletteApp.tsx` | 선별 재사용: 화면별 frameless Palette, 단일 Dock, 프로필/복구 계약 | Electron 계열 구현이다. 현재 Tauri main에 직접 이식 금지, 계약만 포팅 |
| Workspace 위젯/HWND | `b44c6c6`, `DashboardCanvas.tsx:79-81,169-172,445-480` | 재사용: 위젯 기능, drag/resize, edit checkpoint, Dock 상태 | 현재 한 renderer/grid라 위젯별 HWND가 아니다. 새 HWND 분리는 큰 범위 |
| Dock | `b44c6c6`, `src/dock/AppDock.tsx`, `storage.ts`; `DashboardCanvas.tsx:653` | 그대로 재사용, 단일 인스턴스 | 보조 화면 소실 시 임시 투영/포커스 규칙 신규 필요 |
| Command Palette | `b44c6c6`, `CommandPalette.tsx`; `DashboardCanvas.tsx:638-646` | 그대로 재사용 | 정보 확인/명령 역할을 보드 배치 설정과 섞지 않는다 |
| Settings | `b44c6c6`, `DesktopSettingsPanel.tsx:351-401`, `SettingsCenterSections.tsx:131-165` | 화면 섹션·navigation 재사용 | 현재 “현재 작업 공간에서 직접 꾸밈”만 존재. 화면 배치 subpanel 신규 |
| 저장 | `b44c6c6`, `settings/types.ts:17-32`, `settingsService.ts:32-38`, `accountSettings.ts:44-66` | Workspace/Dock 저장 adapter 재사용 | 모니터 ID·DPI·work-area는 device-only 신규 schema로 분리 |
| CSS | `b44c6c6`, `dashboard.css`, `desktop-workspace.css`, `release-ui.css` | 토큰/카드/Dock/작은창 규칙 재사용 | z-index와 fixed panel이 다중 창 경계까지 해결하지는 않는다 |

## 신규 장치 전용 모델

`DisplayLayoutProfileV1 = { mode, explicitBoardDisplayKey, dockDisplayKey, safeAreaRatio, monitors[] }`. 각 monitor는 `{displayId?, fingerprint, lastWorkAreaDip, lastScaleFactor, widgetOwnership, geometryDip, normalizedGeometry, updatedAt}`를 가진다. 계정 동기화 payload에는 넣지 않는다.

매칭 순서: 현재 display ID → 고유한 hardware/work-area fingerprint → 해상도/위치 후보가 단 하나일 때만 복구 → 그 외 미확정. 미확정은 주 화면 안전 영역 안에 임시 배치하고 원본 프로필을 보존한다.

## Windows 동작 계약

- **click-through:** 빈 Palette 영역만 입력 무시. 카드/Dock/Palette 컨트롤은 interactive region으로 복귀한다. 전체 화면 오버레이는 금지한다.
- **z-order/focus:** always-on-top 금지. Desktop Surface는 일반 앱 뒤/바탕화면 위 계약을 따르고, 편집/Settings를 열 때만 명시적 focus를 요청한다. 포커스 탈취 반복 금지.
- **분리:** `display-removed` debounce 후 연결 목록 재조회 → 해당 프로필 dormant → 위젯을 안전 화면에 임시 투영 → 저장 원본 불변.
- **재연결:** ID/fingerprint 매칭 성공 시 원래 ownership/geometry 복원. 애매하면 자동 병합하지 않고 Settings에 선택 요청.
- **DPI:** display/scale/work-area 변경마다 DIP 기준 bounds와 안전 영역 재계산. `WM_DPICHANGED` 또는 프레임워크 scale 이벤트 후 제안 rect를 검증한다.
- **3대 이상:** 기존 명시 선택 유지, 새 화면은 빈 보조 프로필. 보드와 Dock을 임의 분산하지 않는다.
- **Explorer 보호:** `SetParent`, 아이콘 열거/이동, WorkerW attach, Shell 재시작, 전면 투명 오버레이를 DESKTOP-LAYOUT-02 범위에서 제외한다.

개별 HWND 우선 재사용은 “기존 별도 창이 이미 있는 경우”에 한한다. 현행 renderer 위젯을 위젯별 HWND로 쪼개는 것은 재사용이 아니라 신규 창 수명주기·IPC·포커스 설계이므로 02의 기본안이 아니다.
