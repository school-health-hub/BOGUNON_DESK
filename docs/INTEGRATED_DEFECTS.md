# BOGUNON DESK 2.0 통합 결함 목록

## 이식 완료 후 재검증

- **Purchase PDF 요약 행** — WIN-QA-04에서 `예상 합계: 23,500원`이 다섯 번째 품목으로 생성됨. Electron Rust CLI 경로 수정(`03e31e2`)과 회귀 테스트는 PASS이나 새 Windows GUI 실행본 재검증은 전략 전환으로 NOT RUN.
- **Newsletter 긴 제목 및 출력** — 긴 한글 제목의 A4 lead 겹침 수정(`ba23090`)은 구현·집중 테스트 완료. 정상/긴 제목 실제 출력, A4 PDF 1페이지, 카드뉴스 PDF 7페이지, 덮어쓰기 취소 보호는 부분 확인 또는 NOT RUN.
- **Newsletter 이미지 승인 정책** — approved 이미지 재연결·SHA 변경 감지와 pending 출력 차단은 실제 합성 manifest 부재로 BLOCKED.
- **공문작업실 후속 adapter** — ODT 기본 양식, PDF/HWPX/ODT 가져오기, 승인 reference package, Google/AI 연계는 Electron 최소 로컬 이식에서 제외되어 NOT RUN. 기존 Tauri 구현과 데이터 계약을 후속 이식에서 재사용한다.
- **통합 Purchase fixture 테스트** — 통합 worktree에 `tools/purchase-excel-cli/target/qa-fixtures` 생성 자료가 없어 Excel/PDF 실제 파일 연동 9건 FAIL. 나머지 선별 핵심 테스트 233건은 PASS. Purchase 결함 수정은 재개하지 않고 fixture 재현 환경 복구 후 통합 검증 대상으로 유지한다.
- **저장소 전체 TypeScript** — Electron 전용 main/renderer/tests TypeScript와 프로덕션 빌드는 PASS. 전체 `npx tsc --noEmit`은 기존 Newsletter global bridge 타입 및 Tauri 공문 session/reference 타입 불일치로 FAIL이며 Electron 통합 완료로 간주하지 않는다.
- **통합 Windows 화면 진입** — 격리 UUID 실행은 시작됐으나 Computer Use 초기화가 `failed to write kernel assets`로 두 번 실패하여 하나의 실행본에서 6개 영역 진입은 NOT RUN. 개별 Finder·공문 기본 실행 PASS를 반복 수행하지 않았다.
- **Inventory 운영 연계 제외** — Electron 최소 이식은 합성 데이터와 `work-data/inventory` 격리 JSON만 사용한다. Supabase 운영 DB, 보건지원강사 계정, 실시간 동기화, 실제 재고 이전은 NOT RUN이며 운영 자료를 읽거나 변경하지 않았다.
- **Inventory ↔ Purchase 자동 반영 제외** — 부족 수량을 `stockEffect: NONE`인 읽기 전용 후보 DTO로 만드는 계약만 확인했다. Purchase Helper에서 실제 구매·입고를 자동 반영하는 UI/IPC 연결은 미구현이며 후속 통합 대상으로 유지한다.

반복적인 개별 Windows GUI QA와 추가 QA 자동화는 중단한다. 앱 실행 불가, 데이터 손상, 보안 위험을 제외한 결함은 핵심 Tauri 기능의 Electron 이식 완료 후 통합 처리한다.


## CLOUD-G0 갱신 (2026-11-02)

앞부분은 과거 단계의 기록이며 아래 상태가 우선한다.

| 결함/미완료 | 현재 상태 |
| --- | --- |
| Purchase fixture 연동 9 FAIL | **해소(검증 준비 결함)**. 새 worktree에서 9 FAIL 재현 후 원본 Rust fixture 생성·CLI 빌드 선행. 테스트 skip 없이 Electron 225 PASS, Dashboard/Dock 47 PASS. 제품 로직 수정 없음 |
| 공문 ODT/PDF/HWPX/ODT adapter | **이식됨**. `d167c934…`, Windows CI 41401980509 PASS, Windows PC 파일 QA PASS는 사용자 보고로 재사용. reference/Google/AI 연계는 여전히 제외 |
| 전체 저장소 TypeScript | **미해결/범위 분리**. root 26 오류 중 24건은 Electron bridge 선언 범위, 2건은 기존 Tauri 공문 session/reference. Electron 3개 타입 구성/빌드 PASS. 전역 타입 오염이나 기존 Tauri 수정으로 숨기지 않음 |
| 단일 통합 실행본 진입 | **해소**. [Windows CI 41405828621](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41405828621)에서 Dashboard/Dock/Memo/Purchase/Newsletter/Finder/공문/Inventory 진입·복귀 PASS. 기존 개별 파일/설치 QA는 반복하지 않음. 전체 기능 완성 판정은 아님 |
| 기존 출력·운영 연계 잔여 | 위 Newsletter 실제 출력·이미지 승인, Purchase PDF GUI, Inventory 운영/자동 입고 미완료는 그대로 유지. 신규 기능으로 범위를 확대하지 않음 |

전체 Electron은 잔여 검증으로 **CONDITIONAL**이며 main 병합·PR·운영 배포는 하지 않는다.
