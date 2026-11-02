# Inventory Preview 선별 재사용

- Cloud A 기준: `723e301446b06af9690a91df6cbd724549710d8d`.
- Cloud B source: `codex/inventory-im2b1-cloud-b@ef0ba64cae5c0a6ccbba05a8821a80730dcfc087`.
- 원본 경로: `src/inventory-management/ui/`의 syntheticAdapter.ts, syntheticFixtures.ts, inventorySelectors.ts, inventoryTypes.ts, InventoryManagementPanel.tsx, InventoryWorkflowDialog.tsx.
- 위 6파일만 Electron 전용 `source/`로 선별 복사. 순수 의존성 4개와 WorkflowDialog는 바이트 그대로이며 `source-hashes.json` 및 boundary test로 검증한다.
- Panel만 Cloud A 표시/호스트 연결을 조정: 제목/닫기 이름, preview_only·persisted:false·실제 저장/DB 없음 배너, 로컬 화면 전환 callback. 계산·합성 검증·입력 처리 알고리즘은 재작성하지 않았다.
- CSS는 B의 `src/styles/inventory-management.css`에서 가져와 PostCSS로 모든 selector(media query 포함)를 `.inventory-preview`에 기계적으로 한정했다. 기존 로컬 CSS와 충돌하는 최소 reset/host 색상·전환 버튼만 추가했다. 원본 source CSS는 변경하지 않았다.
- Preview는 2026-11-02 고정 기준일의 합성 fixture·숫자형 Preview 타입만 사용한다. DB용 UUID/bigint/decimal DTO와 캐스팅/변환하지 않는다. 입력은 유효성 검사 결과만 반환하며 합성 재고도 저장/변경하지 않는다.
- B connection/index.ts 또는 connection/**는 가져오지 않는다. 인증/DB/서버 설정/transport/RPC/RLS/migration/DB QA도 포함하지 않는다. Preview에는 token/config/IPC client 의존성이 없다.
- 기존 InventoryWorkspace.tsx/model.ts/main JSON 저장소/preload/protocol은 보존한다. Local/Preview는 별도 lazy 화면으로 mount/unmount하고 데이터 props를 공유하지 않는다. JSON 자동 이관/삭제/덮어쓰기 없음.
- 이 폴더의 host/view 사본·CSS는 Cloud A 소유. 원본 B 파일/connection/security/DB 계약은 Cloud B 소유이며 변경하지 않는다. 향후 B UI 변경은 이 고정 source와 diff하여 별도 승인 범위로 반영한다.
