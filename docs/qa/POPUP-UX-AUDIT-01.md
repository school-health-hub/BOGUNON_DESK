# POPUP-UX-AUDIT-01 — beta.14 팝업 UX 감사

운영 제품 기준 `2.0.0-beta.14`, Source SHA `242b03e3aa14f1c496dad9ea30b46e77d0a28608`. 제품과 동일한 Git 객체를 비교했으며 제품 소스, 설치본, 운영 사용자 데이터, 릴리스 자산, Windows 정책을 수정하지 않았다.

## 대표 사례와 우선순위

| 우선순위 | 관찰과 영향 | 다음 작업 |
| --- | --- | --- |
| P0 검증 후보 | Newsletter의 작업실 나가기와 외부 닫기 요청은 dirty guard를 거친다. 트레이 완전 종료와 `before-quit`에서는 main의 종료/flush 경로가 직접 실행된다. React 메모리의 원고를 보호하는 preflight가 이 경로에도 적용되는지 소스에서 확인되지 않는다. 실제 데이터 손실은 재현하지 않았다. | 합성 미저장 원고를 열고 트레이 종료, 일반 창 닫기, 작업실 닫기, OS 세션 종료, 업데이트 동의를 각각 분리해 재현한다. 결과가 확인된 경로에서만 수정한다. |
| P1 | 업데이트 UI는 Soft Rose의 전용 창과 앱 정보 카드인데, 마지막 저장 확인은 Windows 스타일의 Electron 메시지 박스다. 제목과 버튼은 적절히 구체적이고 안전 버튼이 기본이다. | 업데이트 마지막 동의를 전용 update renderer 안에 우선 통합한다. 다른 진입점도 동일한 main 결정을 공유한다. |
| P1 | 일정·구매·공문·Finder 등 사용자 흐름에서 `window.confirm`과 React 모달, Electron 확인창이 혼용된다. JS 확인창은 도메인 문구를 제공하나 버튼 라벨, 설명의 위계, 위험 색상 및 직접적인 포커스 정책을 공유하기 어렵다. | 반복 노출되는 앱 소유 확인부터 바꾸고, 기존 취소·선택·권한 검증을 경로마다 확인한다. |
| P1 검증 후보 | `SurfaceDialog`는 첫 포커스, Tab 트랩, Escape, inert 및 복귀를 구현한다. main의 Rose 확인창은 부모당 중복 요청을 막고 취소에 초기 포커스를 둔다. 별도 도구 모달의 중첩·resize·멀티모니터 부모 전달은 구현마다 달라 공통 보장을 할 수 없다. | 중첩 시 최상단만 이벤트를 처리하는지, 부모가 숨겨지거나 파괴되는 경우 요청이 취소되는지, 키보드로 모든 선택에 도달하는지 시험한다. |
| P2 | React용 Soft Rose 토큰과 독립 확인창의 인라인 색상·크기 선언, 업데이트 창의 CSS가 따로 관리된다. 제목, 아이콘 크기, 버튼 여백 및 반경 차이가 생긴다. | `DESIGN.md`의 기존 Electron 기준과 `design-07.css` 값을 공유하고, standalone renderer에서도 같은 토큰을 빌드 입력으로 사용한다. |

첫 사례의 운영 보고 문구는 “저장하지 않은 작업을 모두 저장하셨나요?”이며, 조사 SHA의 실제 소스 문구는 “저장하지 않은 작업을 모두 저장했나요?”다. 제목 `BOGUNON DESK 업데이트`와 `계속 작업`, `저장 완료, 설치`는 일치한다. `electron-p0/main/main.mts:171`은 살아 있는 업데이트 창을 부모로 우선 사용하며 `defaultId:0`, `cancelId:0`으로 계속 작업을 기본값과 취소에 둔다. 이는 앱이 호출하는 동의창이므로 외형을 대체할 수 있다. Authenticode, SmartScreen, UAC와 파일 선택기의 Windows UI는 그대로 사용한다.

## 흐름별 인벤토리

아래는 기능별로 묶었다. 뒤의 호출 색인에는 같은 파일의 여러 호출 위치와 보조 패널·상태 표시도 포함한다. 별도 언급이 없는 조합은 Windows 실동작 **NOT RUN**이다. 소스 내 등장과 Electron 제품에서의 실제 도달성은 구분한다.

| 흐름 | 소스와 구현 | 위험 및 감사 판정 |
| --- | --- | --- |
| 업데이트 | `electron-p0/main/main.mts:149,159,171,464`, `main/update-service.ts:138–158`, `main/update-notice.ts`, `main/update-installer.ts`, `renderer/update/main.tsx`, `renderer/ProductAbout.tsx`. 별도 BrowserWindow, Windows Notification, 트레이, React 상태 카드, native 저장 확인. | P1 외형. 서명·해시·크기, 저장 동의, 종료 대기, helper 실행 순서는 보안 계약이다. 동의창 양쪽 동작과 실제 설치는 NOT RUN. |
| 일반 닫기·저장 보호 | `main/main.mts:459,485–488`, `renderer/P0App.tsx:176–178,223,246`, `src/newsletter/NewsletterStudio.tsx:37,73–76,145`. main 종료·트레이, 도구 closeRequest, 브라우저 확인, Rose 모달. | P0 검증 후보. 정상 flush와 React 미저장 편집 보호는 별개의 계약이다. 파일 저장 실패·취소는 원고 유지, 종료 이벤트 반복은 중복 방지 필요. |
| 보건소식지 | `main/main.mts:440–450`, `main/newsletter-export.ts:36–37`, `src/newsletter/NewsletterStudio.tsx:145`, `renderer/adapters/NewsletterProjectControls.tsx`, `NewsletterOutputControls.tsx:19,26`, `src/newsletter/NewsletterTopicPlanner.tsx:19,53`, `rendering/StudentArtLibrary.tsx:28–49`. React, HTML dialog, Rose BrowserWindow, OS 선택기·덮어쓰기, 숨은 출력 worker. | P1 저장·복구·내보내기 용어 차이. 출력 worker는 대화상자 후보에서 제외. 외부 AI 전송 및 학생 작업물 경고의 의미 유지. |
| 공문·기록 | `main/main.mts:237–245,306–308`, `renderer/official-document/OfficialAiWorkflow.tsx:72,95`, `SummaryTaskReview.tsx:12`, `src/official-document/OfficialDocumentWorkspace.tsx:34–76`, `src/components/desktop/OfficialDocumentAiConfirmation.tsx`, `RecordHelperAiConfirmation.tsx`, `RecordHelperDiscardConfirmation.tsx`, `renderer/record-helper/RecordHelperHost.tsx`. | P1 확인 UI 혼재. 파일 선택, 개인정보 검토·외부 전송, 승인 템플릿과 저장 확인 유지. main 검증과 동의는 renderer 상태에만 맡기지 않는다. |
| 물품·구매 | `main/main.mts:334–376`, `renderer/inventory-preview/InventoryHost.tsx:11`, `InventoryWorkflowDialog.tsx`, `src/inventory-management/InventoryWorkspace.tsx:17–30`, `school-workspace/school07/ui/InventoryWorkspace.tsx:18`, `renderer/purchase/`의 Session, ImportControls, ImageImport, AiControls, BulkEdit, OutputPreview, ItemName, Draft·Settlement·Helper. | P1. 삭제·초기화·사진/표 전송·출력·기존 파일 덮어쓰기는 별개의 의도다. 외부 전송과 파일 쓰기는 취소 후 부작용이 없어야 한다. |
| Finder | `main/main.mts:412–428`, `renderer/finder/FinderCompatibility.tsx:21–47`, `src/education-video/EducationVideoFinder.tsx`, `VideoResults.tsx`. 브라우저 확인, OS 파일 선택기, Electron Key 등록·검색어 전송·덮어쓰기, 상태 표시. | P1. 키 값/문서명 노출 없이 기존 검토·권한·취소 경로 보존. |
| 업무 폴더·학교·강사·금융 | `main/main.mts:185–187,274–276,324–327,397–399`; `renderer/work-folders/WorkFolders.tsx`, `school-admin/SchoolAdmin.tsx:29–77`, `school-profile/SchoolProfile.tsx:47`, `school-workspace/instructors/ui/InstructorWorkspace.tsx:75–76`, `school02/ui/SchoolWorkspace.tsx:77–78`, `src/my-finance/FinanceConfirmation.tsx:11`. OS 파일/폴더 선택, main 확인, 브라우저 확인, Rose 비모달 및 alertdialog. | P1. 즐겨찾기 해제는 이미 Rose native 브리지 사례다. 암호화 백업 복원·개인정보 검토·권한 있는 폴더 연결은 main의 검증 순서를 보존한다. |
| 온라인 보건실·계정 | `renderer/OnlineHealthRoomSettings.tsx`, `school-profile/BogunonAccount.tsx`, `ai/ChatGptSettings.tsx`, `ai/AiTools.tsx:49`, `src/components/desktop/ChatGptAccountSettings.tsx`. 설정 내 오류·검증의 인라인 상태, 외부 사이트 및 계정 연결. | P1 오류·재시도 컨벤션. 실제 인증과 권한 요청은 기존 외부 소유 경계에 남긴다. |
| 일정·메모·Dock·위젯 | `renderer/local-calendar/LocalCalendarPanel.tsx:23,33,39`, `local-tasks/LocalTasksPanel.tsx:25`, `adapters/PersistentMemo.tsx`, `BoardPlacementSettings.tsx`, `SurfaceSettings.tsx`, `src/dock/DockEditor.tsx`, `src/components/dashboard/WidgetSettingsPanel.tsx:166`, `renderer/palette/PaletteApp.tsx:60`. 브라우저 확인, 편집 시트, 인라인 적용·저장 상태, Palette 모달. | P1 삭제·초기화 확인, P2 상태 대비와 간격. Dock은 편집 도구로 유지하며 저장·복원까지 공통 모달로 바꾸지 않는다. |
| 온보딩·작업 도구·알림 | `renderer/FirstRunOnboarding.tsx`, `P0App.tsx:143–161,232–252`, `toolbox/ToolboxMenu.tsx`, `file-drop/GlobalFileDrop.tsx`, `desktop-utilities/`, `local-tasks/LocalNotices.tsx`, `src/workspace-data/WorkspaceDataNotice.tsx`, `src/components/desktop/CommandPaletteView.tsx`, `InboxTaskActionPopover.tsx`, `DesktopUpdateBanner.tsx`. onboarding, surface, popover, 진행/오류/상태. | 인라인 안내·상태는 맥락에 유지한다. 지속이 필요한 오류를 일회성 토스트에만 표시하지 않는다. |
| 공유·대체·QA 소스 | `src/App.tsx`, `src/components/desktop/DesktopSettingsPanel.tsx:208,215`, `QuickAddPanel.tsx:113`, `QuickMemoEditor.tsx:39`, `PurchaseHelperPanel.tsx:169,201,229`, `school-workspace/integration/dev-ui/`, `renderer/inventory-local-qa/`, `SyntheticIpcSample.tsx`. | 공통 코드와 별도 진입점도 색인에 남겼다. 대체/QA 화면을 운영 Electron 경로에서 봤다고 판정하지 않는다. |

## 공통 시스템과 후속 변경 범위

| 유형 | 공통 규칙 |
| --- | --- |
| 정보 안내 | 한 줄 제목과 핵심 사실, 필요한 경우 상세, 확인 또는 닫기. 대상 영역의 인라인 안내를 우선한다. |
| 일반 확인 | 취소와 구체적인 행동 동사, 작업 대상·영향을 먼저 보여준다. Enter는 현재 포커스에만 작동하게 한다. |
| 미저장 보호 | 계속 편집, 저장 후 나가기, 저장하지 않고 나가기. 저장 흐름이 실패하거나 취소되면 남긴다. 업데이트의 저장 완료 동의는 기존 의미를 보존하며 자동 저장 성공으로 해석하지 않는다. |
| 위험 작업 | 취소에 초기 포커스, 동작 이름과 삭제·덮어쓰기 영향 명시, 제출 중 재클릭을 막는다. 확인 후 실제 대상이 바뀌지 않았는지 검증한다. |
| 오류·재시도 | 오류 원인과 사용자 다음 동작을 분리한다. 재시도는 반복 가능한 작업에서 제공한다. 저장/전송 상태는 필요한 동안 유지한다. |
| 다운로드·진행 | 전용 업데이트 UI의 상태 기계와 기존 진행 UI 재사용. 완료/중단/재시도 상태를 실제 결과와 연결한다. |
| 완료 알림 | 인라인 `role=status` 또는 작업을 방해하지 않는 토스트로 표시한다. Windows 알림은 운영체제 표현을 유지한다. |

1. **업데이트 우선**. `electron-p0/main/main.mts`, `main/update-service.ts`, `main/update-installer.ts`, update preload·protocol, `renderer/update/main.tsx`와 `update.css`의 계약부터 대조한다. 기존 update window에 일회성 결정을 표시하고 안전한 sender/owner 확인, 요청 ID, 닫힘·Escape 기본 취소, 미결 요청 중복 방지, 종료와 프로세스 인계를 유지한다. 명시 동의 뒤 기존 무결성 재검사를 유지한다.
2. **기존 공통 구현 활용**. `renderer/SurfaceDialog.tsx`를 React 작업실/설정의 공통 외피로, `main/rose-confirmation.ts`를 main 소유 확인의 참조점으로 쓴다. `renderer/soft-rose.css`, `design-07.css`, `update/update.css`의 공유 토큰 경로를 정리하고 Pretendard, 한글 줄바꿈, 줄 길이, 좁은 하단 버튼 줄바꿈과 본문 스크롤을 맞춘다. 전체 기능을 새 BrowserWindow로 확대할 필요는 없다.
3. **반복 위험 확인부터 선별**. `src/newsletter/NewsletterStudio.tsx`, `P0App.tsx`, `LocalCalendarPanel.tsx`, `LocalTasksPanel.tsx`, `PurchaseImageImport.tsx`, `OfficialAiWorkflow.tsx`, `FinderCompatibility.tsx` 순으로 공통 확인을 검토한다. 파일 선택 `showOpenDialog/showSaveDialog`, SmartScreen, UAC, 시스템 권한 창은 OS UI로 유지한다.

## 회귀 전략

- 단위·IPC에서 안전한 기본값, 불일치 sender, 중복 요청, 부모 닫힘, 취소, 해시 불일치와 파일 사이즈 불일치, 승인 전 쓰기·전송 0회와 승인 후 정확히 1회 검증.
- 격리 Windows에서 한국어 긴 제목·파일명, 좁은 화면, 작은 작업 영역·100%/125% DPI, 주/보조 화면의 실제 부모 위치, Tab/Shift+Tab·Enter·Escape·포커스 복귀 검증. NVDA 또는 Windows 내레이터의 제목·본문·상태 낭독은 별도 실측.
- Newsletter 로컬 저장·JSON 저장 실패/취소, 공문/구매/Finder 덮어쓰기 경쟁, 삭제·복원 취소, Palette 설정 클릭 통과 및 트레이 복귀, 설치 진행 중 재클릭과 종료 flush를 기존 회귀에 추가.
- 실제 설치/보안 메시지는 별도 승인된 환경에서만 검증한다. 운영 Windows 경고를 유도하거나 닫지 않았다.

## 실제 Windows GUI 증거

운영 앱이 아닌 검증된 동일 Source SHA의 beta.14 패키지를 임시 QA 프로필로 실행했다. CDP는 로컬 루프백으로만 사용했다. 캡처는 로컬 `artifacts/popup-audit-gui/`에 있다. 증거 파일은 원격 커밋에 포함하지 않는다.

| 화면 | 실행 및 관찰 | 근거 |
| --- | --- | --- |
| 설정 | PASS 범위는 실창 열기, 초기 닫기 버튼의 로즈 포커스 표시, Escape 닫기다. 844×721 캡처에서 제목과 한글 선택지가 가독성을 유지한다. 화면 배치 하단은 스크롤 영역이다. | `settings.png`, SHA-256 `27f8390407a324846ea3124b1cbb9f3f574463023b134d0616dd9e26a1c72a54` |
| 업데이트 전용 창 | PASS 범위는 앱 메뉴 진입과 ‘나중에 하기’ 닫기다. 504×371 캡처에서 제목, 버전, 상태와 버튼이 한글 잘림 없이 보인다. 초기 활성 요소는 개별 컨트롤로 확인되지 않아 초기 포커스는 P1 검증 후보로 남겼다. | `update.png`, SHA-256 `32bb5708924c4481d5d0b512105a97dbf265c16e2da9717c5969ab48eb0aeceb` |
| Windows 네이티브 업데이트 동의창 | 기준 소스와 문구·버튼·기본값을 맞춘 별도 합성 호출을 같은 QA 앱에서 실행했다. AbortSignal로 취소 응답 0을 확인했다. 실제 업데이트 서비스의 설치 분기는 실행하지 않았다. | 네이티브 창 캡처 NOT RUN. QA HWND 캡처가 시간 내 완료되지 않았고, 재시도에서는 CDP 시작 타임아웃이 발생했다. 승인 버튼·Enter·Escape 원격 조작도 NOT RUN. |

독립 검토에서 설정과 업데이트의 글자 계층·로즈 포커스·닫기 버튼을 대조했다. 두 화면을 모두 기준 폭에서 확인했고, 좁은 폭·125% DPI·다중 화면 배치 위치·Tab 순환·Enter·창 간 포커스 복귀·스크린리더 실측은 **NOT RUN**이다. 설정/업데이트 시나리오의 QA Electron 종료 코드는 0이었다.

`main.mts`에는 네이티브 메시지 박스 21개, 열기 12개, 저장 10개의 직접 호출이 있다. 소스의 직접 브라우저 호출은 `window.confirm` 59개와 `window.prompt` 1개가 검색됐으며 `window.alert` 직접 호출은 검색되지 않았다. 독립 검토에서는 앱 완전 종료의 Newsletter 닫기 요청 미전달과, 업데이트 설치의 승인 앞뒤 무결성 재검증을 별도로 확인했다.

## 전체 호출 및 표시 표식 색인

기준 SHA의 Electron·React 소스에서 직접 호출, 모달·상태 표식, 별도 창과 표준 helper를 검색했다. 테스트·E2E·증거 diff를 제외했다. 역할 표기가 없는 패널은 위 흐름 표와 마지막 코드 표식에서 보완했다. bare confirm은 주입된 검증 포트도 포함하므로 독립 대화상자로 합산하지 않는다. OS 선택기와 별도 작업창·백그라운드 worker는 유형별로 해석한다.

### Electron native 메시지·파일 선택기

검색 일치 43건. 호출·시맨틱 표식 기준이며 고유 팝업 개수와 다를 수 있다.

| 파일 | 행 | 표식 |
| --- | --- | --- |
| `electron-p0/main/main.mts` | 171, 185, 186, 187, 237, 238, 239, 241, 245, 274, 275, 276, 306, 307, 308, 324, 325, 327, 334, 344, 350, 356, 358, 359, 365, 366, 376, 397, 412, 413, 422, 426, 428, 440, 441, 446, 447, 450 | `dialog.showMessageBox(, dialog.showOpenDialog(, dialog.showSaveDialog(` |

### 직접 브라우저 대화상자 및 확인 포트

검색 일치 91건. 호출·시맨틱 표식 기준이며 고유 팝업 개수와 다를 수 있다.

| 파일 | 행 | 표식 |
| --- | --- | --- |
| `electron-p0/main/admin-ipc.ts` | 33, 39, 47, 61, 86, 89, 98, 99, 101 | `confirm(` |
| `electron-p0/main/education-video-export.ts` | 36 | `confirm(` |
| `electron-p0/main/instructor-files.ts` | 17, 44, 47, 53, 58 | `confirm(` |
| `electron-p0/main/newsletter-export-storage.ts` | 17 | `confirm(` |
| `electron-p0/main/newsletter-json.ts` | 24 | `confirm(` |
| `electron-p0/main/newsletter-projects.ts` | 62 | `confirm(` |
| `electron-p0/main/purchase-export-storage.ts` | 22 | `confirm(` |
| `electron-p0/main/purchase-export.ts` | 24 | `confirm(` |
| `electron-p0/renderer/ai/AiTools.tsx` | 49 | `window.confirm(` |
| `electron-p0/renderer/finder/FinderCompatibility.tsx` | 21, 38, 46, 47 | `window.confirm(` |
| `electron-p0/renderer/inventory-preview/InventoryHost.tsx` | 11 | `window.confirm(` |
| `electron-p0/renderer/local-calendar/LocalCalendarPanel.tsx` | 23, 33, 39 | `window.confirm(` |
| `electron-p0/renderer/local-tasks/LocalTasksPanel.tsx` | 25 | `window.confirm(` |
| `electron-p0/renderer/official-document/OfficialAiWorkflow.tsx` | 57, 72, 95 | `confirm(, window.confirm(` |
| `electron-p0/renderer/official-document/SummaryTaskReview.tsx` | 12 | `window.confirm(` |
| `electron-p0/renderer/P0App.tsx` | 223 | `window.confirm(` |
| `electron-p0/renderer/purchase/components/desktop/PurchaseDraftEditor.tsx` | 131, 132 | `window.confirm(` |
| `electron-p0/renderer/purchase/components/desktop/PurchaseHelperPanel.tsx` | 111 | `window.confirm(` |
| `electron-p0/renderer/purchase/PurchaseAiControls.tsx` | 14 | `window.confirm(` |
| `electron-p0/renderer/purchase/PurchaseImageImport.tsx` | 20, 25, 32, 37 | `window.confirm(` |
| `electron-p0/renderer/purchase/PurchaseImportControls.tsx` | 16, 41, 55 | `window.confirm(` |
| `electron-p0/renderer/purchase/PurchaseSession.tsx` | 39 | `window.confirm(` |
| `electron-p0/renderer/school-admin/SchoolAdmin.tsx` | 29, 30, 52, 66, 73, 76, 77 | `window.confirm(` |
| `electron-p0/renderer/school-profile/SchoolProfile.tsx` | 47 | `window.confirm(` |
| `school-workspace/instructors/ui/InstructorWorkspace.tsx` | 75, 76 | `window.confirm(` |
| `school-workspace/school02/ui/SchoolWorkspace.tsx` | 27, 28, 29, 60, 61, 66, 67 | `confirm(` |
| `school-workspace/school07/ui/InventoryWorkspace.tsx` | 18 | `window.confirm(` |
| `src/components/dashboard/DashboardCanvas.tsx` | 252 | `window.confirm(` |
| `src/components/desktop/DesktopSettingsPanel.tsx` | 208, 215 | `window.confirm(, window.prompt(` |
| `src/components/desktop/OfficialDocumentPanel.tsx` | 134 | `confirm(` |
| `src/components/desktop/PurchaseDraftEditor.tsx` | 138 | `window.confirm(` |
| `src/components/desktop/PurchaseHelperPanel.tsx` | 169, 201, 229 | `window.confirm(` |
| `src/components/desktop/QuickAddPanel.tsx` | 113 | `window.confirm(` |
| `src/components/desktop/QuickMemoEditor.tsx` | 39 | `window.confirm(` |
| `src/components/desktop/RecordHelperWorkspacePanel.tsx` | 130 | `confirm(` |
| `src/inventory-management/InventoryWorkspace.tsx` | 17, 19, 20, 22, 30 | `window.confirm(` |
| `src/my-finance/FinanceScreen.tsx` | 62, 145 | `confirm(` |
| `src/newsletter/rendering/StudentArtLibrary.tsx` | 29 | `confirm(` |
| `src/official-document/OfficialDocumentWorkspace.tsx` | 34, 48, 52, 57, 76 | `window.confirm(` |

### 공통 창·레이어·열기 제어

검색 일치 32건. 호출·시맨틱 표식 기준이며 고유 팝업 개수와 다를 수 있다.

| 파일 | 행 | 표식 |
| --- | --- | --- |
| `electron-p0/main/desktop-surface-controller.ts` | 116 | `new BrowserWindow(` |
| `electron-p0/main/main.mts` | 134, 149, 159, 399, 445 | `new BrowserWindow(, new Notification(, showRoseConfirmation(` |
| `electron-p0/main/newsletter-export.ts` | 36 | `new BrowserWindow(` |
| `electron-p0/main/rose-confirmation.ts` | 9, 16 | `new BrowserWindow(, showRoseConfirmation(` |
| `electron-p0/renderer/adapters/NewsletterOutputControls.tsx` | 19, 26 | `<dialog, showModal(` |
| `electron-p0/renderer/desktop-utilities/DesktopUtilities.tsx` | 29, 30 | `<SurfaceDialog` |
| `electron-p0/renderer/desktop-utilities/LocalQuickAdd.tsx` | 21 | `<SurfaceDialog` |
| `electron-p0/renderer/file-drop/GlobalFileDrop.tsx` | 22 | `<SurfaceDialog` |
| `electron-p0/renderer/FirstRunOnboarding.tsx` | 24 | `<SurfaceDialog` |
| `electron-p0/renderer/local-calendar/LocalCalendarPanel.tsx` | 43 | `<SurfaceDialog` |
| `electron-p0/renderer/local-tasks/LocalTasksPanel.tsx` | 10 | `<SurfaceDialog` |
| `electron-p0/renderer/official-document/OfficialAiWorkflow.tsx` | 99 | `<SurfaceDialog` |
| `electron-p0/renderer/P0App.tsx` | 232, 241 | `<SurfaceDialog` |
| `electron-p0/renderer/QuickMemoSurface.tsx` | 25 | `<SurfaceDialog` |
| `electron-p0/renderer/record-helper/RecordHelperHost.tsx` | 24 | `createPortal(` |
| `electron-p0/renderer/school-profile/BogunonAccount.tsx` | 22 | `<SurfaceDialog` |
| `electron-p0/renderer/school-profile/SchoolProfile.tsx` | 23 | `<SurfaceDialog` |
| `electron-p0/renderer/SurfaceDialog.tsx` | 26 | `createPortal(` |
| `school-workspace/instructors/ui/InstructorWorkspace.tsx` | 81 | `<SurfaceDialog` |
| `src/newsletter/NewsletterStudio.tsx` | 145 | `<SurfaceDialog` |
| `src/newsletter/NewsletterTopicPlanner.tsx` | 19, 53 | `<dialog, showModal(` |
| `src/newsletter/rendering/StudentArtLibrary.tsx` | 28, 49 | `<dialog, showModal(` |

### 모달·토스트·오류·진행의 접근성 표식

검색 일치 285건. 호출·시맨틱 표식 기준이며 고유 팝업 개수와 다를 수 있다.

| 파일 | 행 | 표식 |
| --- | --- | --- |
| `electron-p0/main/rose-confirmation.ts` | 24 | `aria-modal=, role="dialog"` |
| `electron-p0/renderer/adapters/NewsletterOutputControls.tsx` | 26 | `role="status"` |
| `electron-p0/renderer/adapters/NewsletterProjectControls.tsx` | 24 | `role="status"` |
| `electron-p0/renderer/adapters/PersistentMemo.tsx` | 22 | `role="status"` |
| `electron-p0/renderer/ai/AiTools.tsx` | 22, 26, 51, 54 | `role="alert", role="status"` |
| `electron-p0/renderer/ai/ChatGptSettings.tsx` | 14, 23 | `role="status"` |
| `electron-p0/renderer/BoardPlacementSettings.tsx` | 54 | `role="status"` |
| `electron-p0/renderer/desktop-utilities/DesktopUtilities.tsx` | 21 | `aria-modal=, role="dialog"` |
| `electron-p0/renderer/desktop-utilities/LocalQuickAdd.tsx` | 22 | `role="alert"` |
| `electron-p0/renderer/file-drop/GlobalFileDrop.tsx` | 22, 26 | `role="alert", role="status"` |
| `electron-p0/renderer/finance/FinanceHost.tsx` | 11, 12, 13 | `role="alert", role="status"` |
| `electron-p0/renderer/finder/FinderCompatibility.tsx` | 42 | `role="status"` |
| `electron-p0/renderer/FirstRunOnboarding.tsx` | 37 | `role="alert"` |
| `electron-p0/renderer/inventory-local-qa/InventoryLocalQa.tsx` | 22 | `role="status"` |
| `electron-p0/renderer/inventory-local-qa/InventoryQaWorkspace.tsx` | 47, 73 | `role="alert", role="status"` |
| `electron-p0/renderer/inventory-preview/InventoryHost.tsx` | 11 | `role="status"` |
| `electron-p0/renderer/inventory-preview/source/InventoryManagementPanel.tsx` | 42, 46, 47, 48 | `aria-modal=, role="alert", role="dialog", role="status"` |
| `electron-p0/renderer/inventory-preview/source/InventoryWorkflowDialog.tsx` | 89, 102, 103 | `aria-modal=, role="alert", role="dialog", role="status"` |
| `electron-p0/renderer/local-calendar/LocalCalendarPanel.tsx` | 46, 47, 62 | `role="alert", role="status"` |
| `electron-p0/renderer/local-tasks/LocalNotices.tsx` | 13, 15 | `role="alert", role="status"` |
| `electron-p0/renderer/local-tasks/LocalTasksPanel.tsx` | 12, 13, 15, 37 | `role="alert", role="status"` |
| `electron-p0/renderer/official-document/OfficialAiWorkflow.tsx` | 88, 89 | `role="alert", role="status"` |
| `electron-p0/renderer/official-document/SummaryTaskReview.tsx` | 31, 32 | `role="alert", role="status"` |
| `electron-p0/renderer/OnlineHealthRoomSettings.tsx` | 17 | `aria-live="polite", role="status"` |
| `electron-p0/renderer/P0App.tsx` | 78, 79, 143, 146, 152, 161, 235, 236, 242, 243, 246, 247, 248, 249, 251, 252 | `aria-modal=, role="alert", role="dialog", role="status"` |
| `electron-p0/renderer/palette/PaletteApp.tsx` | 40, 41, 58, 60, 63 | `aria-modal=, role="alert", role="dialog", role="status"` |
| `electron-p0/renderer/ProductAbout.tsx` | 22 | `role="status"` |
| `electron-p0/renderer/purchase/components/desktop/PurchaseBulkEditDialog.tsx` | 54, 70, 75 | `aria-modal=, role="alert", role="dialog"` |
| `electron-p0/renderer/purchase/components/desktop/PurchaseDraftEditor.tsx` | 148 | `aria-live="polite"` |
| `electron-p0/renderer/purchase/components/desktop/PurchaseHelperPanel.tsx` | 120, 132, 139 | `aria-modal=, role="dialog", role="status"` |
| `electron-p0/renderer/purchase/components/desktop/PurchaseItemNameDialog.tsx` | 45 | `aria-modal=, role="dialog"` |
| `electron-p0/renderer/purchase/components/desktop/PurchaseOutputPreviewDialog.tsx` | 52, 61, 62 | `aria-modal=, role="alert", role="dialog"` |
| `electron-p0/renderer/purchase/components/desktop/PurchaseSettlementEditor.tsx` | 141, 142 | `role="status"` |
| `electron-p0/renderer/purchase/ImageEvidenceView.tsx` | 17 | `role="alert", role="status"` |
| `electron-p0/renderer/purchase/PurchaseImageImport.tsx` | 43, 56, 59 | `role="alert", role="status"` |
| `electron-p0/renderer/purchase/PurchaseImportControls.tsx` | 62, 63 | `aria-modal=, role="dialog", role="status"` |
| `electron-p0/renderer/purchase/PurchaseSession.tsx` | 39, 44 | `role="status"` |
| `electron-p0/renderer/record-helper/RecordHelperHost.tsx` | 15, 23 | `aria-modal=, role="alert", role="dialog"` |
| `electron-p0/renderer/school-admin/SchoolAdmin.tsx` | 50, 52, 74 | `role="alert", role="status"` |
| `electron-p0/renderer/school-admin/SmartWorkLauncher.tsx` | 43, 45 | `role="status"` |
| `electron-p0/renderer/school-profile/BogunonAccount.tsx` | 102, 103, 104, 105 | `role="alert", role="status"` |
| `electron-p0/renderer/school-profile/SchoolProfile.tsx` | 38, 46, 52 | `role="alert", role="status"` |
| `electron-p0/renderer/school-profile/SchoolSystemAddresses.tsx` | 20, 33 | `role="alert", role="status"` |
| `electron-p0/renderer/SurfaceDialog.tsx` | 26 | `aria-modal=, role="dialog"` |
| `electron-p0/renderer/SurfaceSettings.tsx` | 8 | `role="status"` |
| `electron-p0/renderer/SyntheticIpcSample.tsx` | 11 | `role="status"` |
| `electron-p0/renderer/toolbox/ToolboxMenu.tsx` | 55 | `role="status"` |
| `electron-p0/renderer/update/main.tsx` | 16 | `aria-live="polite", role="status"` |
| `electron-p0/renderer/work-folders/WorkFolders.tsx` | 39 | `role="alert", role="status"` |
| `electron-p0/renderer/WorkspaceBoundary.tsx` | 2 | `role="alert"` |
| `school-workspace/instructors/ui/instructor-settings-form.tsx` | 40 | `role="alert", role="status"` |
| `school-workspace/instructors/ui/payment-statement-preview.tsx` | 23 | `role="status"` |
| `school-workspace/integration/dev-ui/WorkspacePanel.tsx` | 11 | `aria-live="polite", role="status"` |
| `school-workspace/school02/ui/SchoolWorkspace.tsx` | 50, 53, 64, 65, 72, 76, 77, 78 | `aria-modal=, role="alert", role="alertdialog", role="status"` |
| `school-workspace/school05/ui/ProductWorkspace.tsx` | 2, 10 | `role="alert", role="status"` |
| `school-workspace/school07/ui/InventoryWorkspace.tsx` | 11, 21 | `role="status"` |
| `src/App.tsx` | 55 | `role="status"` |
| `src/components/dashboard/DashboardCanvas.tsx` | 655 | `role="status"` |
| `src/components/dashboard/DesktopWidgetLayout.tsx` | 30 | `role="status"` |
| `src/components/dashboard/WidgetFrame.tsx` | 98 | `role="dialog"` |
| `src/components/dashboard/WidgetSettingsPanel.tsx` | 111, 112, 158, 162, 166 | `aria-live="polite", aria-modal=, role="alert", role="dialog"` |
| `src/components/desktop/CalculatorPanel.tsx` | 136, 160, 197 | `aria-live="polite", aria-modal=` |
| `src/components/desktop/ChatGptAccountSettings.tsx` | 51, 73, 79, 85, 89, 126, 130, 132 | `aria-live="polite", role="alert", role="status"` |
| `src/components/desktop/CommandPaletteView.tsx` | 125, 145 | `aria-modal=, role="alert"` |
| `src/components/desktop/DesktopUpdateBanner.tsx` | 41, 49 | `aria-live="polite", role="alert"` |
| `src/components/desktop/DesktopUpdateConfirmationDialog.tsx` | 44 | `aria-modal=, role="dialog"` |
| `src/components/desktop/FileDropRouter.tsx` | 8 | `aria-modal=` |
| `src/components/desktop/InboxPanel.tsx` | 110, 111, 236 | `aria-live="polite", role="alert"` |
| `src/components/desktop/InboxTaskActionPopover.tsx` | 44, 81 | `role="alert", role="dialog"` |
| `src/components/desktop/OfficialDocumentAiConfirmation.tsx` | 55, 83, 84, 85 | `aria-modal=, role="alert"` |
| `src/components/desktop/OfficialDocumentOutput.tsx` | 53 | `aria-live="polite"` |
| `src/components/desktop/OfficialDocumentPanel.tsx` | 200, 245 | `aria-modal=, role="alert", role="dialog"` |
| `src/components/desktop/OnboardingDialog.tsx` | 51, 88, 102 | `aria-modal=, role="alert", role="dialog"` |
| `src/components/desktop/PurchaseDraftEditor.tsx` | 154 | `aria-live="polite"` |
| `src/components/desktop/PurchaseHelperPanel.tsx` | 217, 227, 250 | `aria-modal=, role="dialog", role="status"` |
| `src/components/desktop/PurchaseSettlementEditor.tsx` | 109 | `role="status"` |
| `src/components/desktop/QuickAddPanel.tsx` | 202 | `role="alert"` |
| `src/components/desktop/QuickMemoPanel.tsx` | 21 | `aria-modal=, role="dialog"` |
| `src/components/desktop/record-helper/RecordHelperReportDetail.tsx` | 157, 160, 171 | `aria-live="polite", role="alert", role="status"` |
| `src/components/desktop/record-helper/RecordHelperWorkspaceView.tsx` | 33, 58 | `aria-live="polite", role="alert"` |
| `src/components/desktop/RecordHelperAiConfirmation.tsx` | 56, 69, 70, 71 | `aria-modal=, role="alert", role="dialog"` |
| `src/components/desktop/RecordHelperDiscardConfirmation.tsx` | 92, 93 | `aria-modal=, role="dialog"` |
| `src/components/desktop/RecordHelperWorkspacePanel.tsx` | 240 | `aria-modal=, role="dialog"` |
| `src/components/desktop/SettingsCenterSections.tsx` | 269, 316 | `role="alert", role="status"` |
| `src/components/desktop/WorkFoldersPanel.tsx` | 32 | `aria-modal=` |
| `src/components/workspace/WorkspaceStepBar.tsx` | 38 | `aria-live="polite"` |
| `src/education-video/EducationVideoFinder.tsx` | 109 | `role="status"` |
| `src/education-video/VideoResults.tsx` | 11 | `role="status"` |
| `src/inventory-management/InventoryWorkspace.tsx` | 25 | `role="status"` |
| `src/my-finance-qa/FinanceQaApp.tsx` | 16 | `role="alert", role="status"` |
| `src/my-finance/FinanceConfirmation.tsx` | 11 | `aria-modal=, role="alertdialog"` |
| `src/my-finance/FinanceScreen.tsx` | 110, 111, 124, 128 | `role="alert", role="status"` |
| `src/my-finance/FinanceTransfer.tsx` | 93, 105, 115, 118 | `aria-modal=, role="alert", role="dialog", role="status"` |
| `src/my-finance/IncomeForm.tsx` | 38 | `role="alert"` |
| `src/my-finance/Phase2Workspace.tsx` | 34 | `role="alert"` |
| `src/newsletter/NewsletterAiProductionPanel.tsx` | 47, 51 | `role="alert", role="status"` |
| `src/newsletter/NewsletterStudio.tsx` | 139, 141, 144, 148 | `role="alert", role="status"` |
| `src/newsletter/NewsletterTopicPlanner.tsx` | 67, 72 | `role="status"` |
| `src/newsletter/rendering/NewsletterDesignEditor.tsx` | 73, 93, 104, 111, 113, 116 | `aria-live="polite", aria-modal=, role="alert", role="dialog", role="status"` |
| `src/newsletter/rendering/NewsletterEditorialControls.tsx` | 42, 47, 50 | `role="status"` |
| `src/newsletter/rendering/NewsletterEditorialCopy.tsx` | 33 | `role="alert"` |
| `src/newsletter/rendering/NewsletterOutputControls.tsx` | 40 | `role="alert", role="status"` |
| `src/newsletter/rendering/OfficialElementCopy.tsx` | 40 | `role="alert"` |
| `src/newsletter/rendering/OfficialTemplateControls.tsx` | 17, 42, 43 | `role="alert", role="status"` |
| `src/newsletter/rendering/StudentArtLibrary.tsx` | 56, 59 | `role="alert", role="status"` |
| `src/newsletter/UserImageImportPanel.tsx` | 14 | `role="alert"` |
| `src/official-document/OfficialDocumentWorkspace.tsx` | 71, 72, 77 | `role="alert", role="status"` |
| `src/widgets/TodayTasksWidget.tsx` | 62 | `role="status"` |
| `src/workspace-data/WorkspaceDataNotice.tsx` | 22 | `role="status"` |

### 명시적 팝오버·확인·토스트 구성 요소

검색 일치 26건. 호출·시맨틱 표식 기준이며 고유 팝업 개수와 다를 수 있다.

| 파일 | 행 | 표식 |
| --- | --- | --- |
| `electron-p0/inventory-qa-protocol.ts` | 16 | `<PurchaseProgress` |
| `electron-p0/main/inventory-connection/contracts.ts` | 92 | `<PurchaseProgress` |
| `electron-p0/main/inventory-connection/localQa.ts` | 232 | `<PurchaseProgress` |
| `electron-p0/renderer/official-document/OfficialAiWorkflow.tsx` | 99 | `<OfficialDocumentAiConfirmation` |
| `electron-p0/renderer/school-profile/BogunonAccount.tsx` | 115 | `<AccountReviewModal` |
| `src/components/dashboard/DashboardCanvas.tsx` | 432 | `<DesktopUpdateBanner` |
| `src/components/desktop/InboxPanel.tsx` | 200, 215, 238 | `<InboxTaskActionPopover, <InboxUndoNotice, <WorkspaceDataNotice` |
| `src/components/desktop/OfficialDocumentPanel.tsx` | 67, 255 | `<OfficialDocumentAiConfirmation, <PendingAiConfirmation` |
| `src/components/desktop/RecordHelperWorkspacePanel.tsx` | 92, 292, 299 | `<PendingConfirmation, <RecordHelperAiConfirmation, <RecordHelperDiscardConfirmation` |
| `src/my-finance/FinanceScreen.tsx` | 145 | `<FinanceConfirmation` |
| `src/my-finance/FinanceTransfer.tsx` | 120 | `<FinanceConfirmation` |
| `src/widgets/CalendarWidget.tsx` | 63 | `<WorkspaceDataNotice` |
| `src/widgets/DdayWidget.tsx` | 16 | `<WorkspaceDataNotice` |
| `src/widgets/MealWidget.tsx` | 19 | `<WorkspaceDataNotice` |
| `src/widgets/NotificationWidget.tsx` | 15 | `<WorkspaceDataNotice` |
| `src/widgets/PriorityTaskWidget.tsx` | 31 | `<WorkspaceDataNotice` |
| `src/widgets/TodaySummaryWidget.tsx` | 26 | `<WorkspaceDataNotice` |
| `src/widgets/TodayTasksWidget.tsx` | 29 | `<WorkspaceDataNotice` |
| `src/widgets/UpcomingWidget.tsx` | 14 | `<WorkspaceDataNotice` |
| `src/widgets/WeatherWidget.tsx` | 18 | `<WorkspaceDataNotice` |
| `src/widgets/WeeklyWidget.tsx` | 23 | `<WorkspaceDataNotice` |
