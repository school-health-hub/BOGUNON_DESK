# PARITY-P0-1 — Electron Purchase 설정 영속 저장

기준: `5ae8528f47a4d83b6d23cef240b210a7d420ad21`.

## 재사용 계약

- `src/purchase/purchaseDraftSettings.ts`: 품의문 템플릿 최대 10개, 이름 1–40자, 제목/도입 패턴 160자, 붙임 120자, 본문 항목 순서 및 붙임 여부.
- `src/purchase/purchaseImportSettings.ts`: 머리글 서명별 가져오기 템플릿 최대 20개. 품명 연결 필수, 원본 열 중복 연결 금지.
- `src/purchase/purchaseOutputSettings.ts`/`purchaseDomain.ts`: 출력 열 선택·순서, 품명 열 필수.

Tauri의 순수 정규화 함수를 `main/purchase-settings-normalize.ts`에 선별 재사용했다. 원본 함수와의 대조 테스트를 포함한다. 출력 열은 기존 Electron Main의 동일한 정규화 함수를 재사용한다. Tauri localStorage·계정 설정·기존 파일을 읽거나 자동 이전하지 않는다.

## 저장·보호

`<Electron userData>/work-data/purchase-settings/settings.json`:

```json
{
  "version": 1,
  "revision": 0,
  "draftTemplates": [],
  "importTemplates": [],
  "outputColumns": ["number", "name", "specification", "quantity", "unitPrice", "amount", "note"]
}
```

- 품목·현재 품의 원고·정산 데이터는 포함하지 않는다. 해당 데이터는 기존 세션 계약을 유지한다.
- Main 소유 `load/save`, 정확한 sender/mainFrame 검증, 명시적 expectedRevision CAS와 직렬화 큐를 사용한다. Renderer가 저장 경로를 선택할 수 없다.
- 기존 SettingsStore의 임시 파일→sync→rename 및 Windows EPERM 제한 재시도를 재사용한다. 정상 대상 파일을 삭제한 뒤 교체하지 않는다.
- 이전 정상 revision을 `settings.backup.json`에 보관한다. 쓰기 실패 시 정상 primary를 유지한다.
- 손상·미지원 version·비정규 스키마를 자동 정규화하여 덮어쓰지 않는다. 백업이 있으면 읽기 전용으로 표시하며 저장/초기화를 차단한다. 백업도 없으면 오류를 표시하고 기존 파일을 유지한다.
- 설정은 최대 128 KiB, ID 최대 200자, 머리글 최대 256개·각 500자로 제한한다. 심볼릭 링크/하드 링크 및 비정상 저장 대상은 거절한다.
- 원본 Tauri 정규화 계약이 빈 머리글을 제거하므로, 빈 머리글이 포함된 서명은 열 번호 이동을 막기 위해 저장하지 않는다. 기억하기를 해제하면 일회성 열 연결은 그대로 사용할 수 있다.

## UI

- 품의문 템플릿 생성·명시적 선택/적용·현재 형식으로 수정 저장·확인 후 삭제.
- 템플릿 저장/수정/삭제, 전체 설정 초기화는 현재 원고를 자동 교체하지 않는다. 삭제된 템플릿의 형식도 현재 원고에는 남는다.
- CSV/XLS/XLSX 열 지정에서 템플릿 저장·동일 서명 설정 불러오기. 같은 서명의 수정과 삭제·초기화는 확인한다. 저장 설정 선택만으로 품목을 추가/교체하지 않는다.
- 출력 열 선택·순서 저장과 취소. Main 쓰기 완료 후에만 새 설정과 성공 안내를 반영한다. 실패 시 이전 설정과 편집 입력을 보존한다.
- 기존 가져오기 설정 영역에서 목록 삭제·전체 설정 초기화. 품목·원고·정산은 초기화 대상이 아니다.
- 저장 실패·읽기 전용·연결 불가에서도 품목/원고 편집은 계속 가능하다. 기존 계산·AI-FIRST·OCR·출력 엔진 및 TD2 Glass 스타일은 변경하지 않는다.

## Cloud 검증

- 집중 Vitest 74 PASS: 신규 설정 21개 + 기존 관련 회귀 53개. 설정 CRUD/재생성 복원/손상·미지원 버전/쓰기 실패/CAS/IPC/확인 취소/현재 원고 보호, 계산·품의문·정산·CSV/XLSX·에듀파인 포함.
- 기존 ASAR 런타임 그래프 검사 3 PASS. 새 Main 모듈이 기존 `main/**` 선택 규칙에 포함됨을 확인했다. Portable을 생성하지 않았다.
- 별도 Node Main-store 프로세스 종료→재기동에서 열 순서·매핑·revision 복원 PASS. Renderer unmount/remount 복원도 PASS. 실제 Electron GUI 재시작 검증과 구분한다.
- Electron Main/Preload·Renderer·테스트 TypeScript PASS, `npm run electron:p0:build` PASS.
- 기존 Purchase CLI는 기존 로컬 Rust 툴체인/캐시로 offline build 후 실제 출력 회귀에 사용했다. Rust 업무 로직은 수정하지 않았다.
- 저장소에 lint script가 없어 새 도구/스크립트를 추가하지 않았다. diff 및 민감정보·변경 범위 검사 수행.
- Windows 실제 GUI·파일 대화상자·Portable: NOT RUN. 새 workflow·Portable 빌드·외부 API 호출 없음.

통합 브랜치가 고정 기준에서 이동하지 않았다면 이 기능 커밋으로 fast-forward 가능하다. 자동 통합은 하지 않는다.
