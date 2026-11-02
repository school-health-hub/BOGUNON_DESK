# IM-2A 보건교사용 물품관리 UI 구조

## 범위

IM-2A는 기존 BOGUNON DESK 안에 보건교사용 `물품관리` 내부 패널을 추가한다. 데이터는 `src/inventory-management/ui/syntheticFixtures.ts`의 명시적 합성 fixture만 사용하며 Supabase, RPC, 운영 저장소에는 연결하지 않는다.

## 진입과 내비게이션

- `src/tools/toolRegistry.ts`: 기존 `업무 도구 > 보건 업무`에 `물품관리`를 등록했다.
- `src/desktop/types.ts`, `src/desktop/actionRegistry.ts`: `inventory-management` 내부 action/target을 등록했다.
- `src/commands/types.ts`, `src/commands/commandRegistry.ts`: 명령 팔레트 검색·실행 항목을 등록했다.
- `src/components/dashboard/useDesktopNavigation.ts`: Inventory를 기존 내부 패널과 상호 배타적으로 연다.
- `src/components/dashboard/DashboardCanvas.tsx`: `InventoryManagementPanel`을 기존 DESK 패널 계층에 렌더링한다.

Dock, Tauri 창 최소 크기, Purchase Helper 패널은 변경하지 않았다.

## 화면 구조

`src/inventory-management/ui/InventoryManagementPanel.tsx`는 다음 순서로 구성된다.

1. 제목과 닫기 동작
2. 항상 보이는 `합성 데이터 전용 화면` 배너
3. 물품 등록·입고 등록·재고 사용 기록·구매 필요 품목 확인 동작
4. 전체 등록·부족·임박·만료 요약 지표
5. 품목명·분류·규격 검색과 상태 필터
6. 품목 목록
7. 선택 품목의 총재고·가용재고·권장재고, 로트별 잔량, 최근 이력
8. 폐기·재고 정정 진입

## 상태 모델

- `loading`: 합성 fixture 로딩
- `ready`: 목록과 상세 표시
- `empty`: 등록 품목 없음
- `permission`: 권한 없음 안내
- `error`: 읽기 실패 안내
- 검색 결과 없음: 목록 영역 안의 별도 빈 상태

목록 필터가 현재 선택 품목을 제외하면 상세 및 업무 동작 대상도 필터 결과의 첫 항목으로 즉시 전환한다. 화면에 보이지 않는 이전 품목을 업무 대상으로 유지하지 않는다.

## 재고 표시 계약

- 총재고: 모든 lot의 현재 잔량 합계
- 가용재고: `available`이고 기준일에 만료되지 않은 lot 잔량 합계
- 임박: 기준일 포함 0~90일
- 만료: 기준일 이전
- 만료·격리·사용 불가 lot는 가용재고에서 제외

## 스타일 경계

`src/styles/inventory-management.css` 한 파일에 Inventory 스타일을 한정했다. 기존 `DESIGN.md`의 Pretendard, muted navy/mint, border, divider, glass/surface 토큰을 재사용한다. 900px 이하에서는 요약을 2열로 바꾸고 목록·상세를 세로로 쌓는다. Tauri의 기존 980×700 최소 크기는 변경하지 않았다.
