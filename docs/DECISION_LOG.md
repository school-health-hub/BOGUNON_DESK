# BOGUNON DESK Decision Log

> 최초 작성 기준: `origin/main` `97f9ee9a6fe6ba93b7bfb7a89707902c7b4f2d96`
>
> 이 문서는 사용자가 확정한 결정만 `ACCEPTED`로 기록한다. 검토 중인 설계는 별도 절에 둔다.

## 상태 정의

- `ACCEPTED`: 사용자 확정 결정
- `PROPOSED`: 검토 중이며 구현 기준으로 사용할 수 없음
- `SUPERSEDED`: 새 결정으로 대체됨
- `RETIRED`: 더 이상 적용하지 않음

## 확정 결정

| ID | 날짜 | 결정 | 이유 | 영향 기능 | 근거 | 상태 |
|---|---|---|---|---|---|---|
| GOV-001 | 확인되지 않음 | 공식 공통 문서는 통합 기준 브랜치에서 관리하고 기능 작업은 시작 전에 해당 버전을 확인한다. | 분산된 채팅·worktree의 중복 개발과 설계 충돌 방지 | 전체 | Project Governance P-1/P-2 사용자 지시 | ACCEPTED |
| PROD-001 | 확인되지 않음 | BOGUNON DESK는 Windows 바탕화면 부착형 Desktop Surface와 일반 작업실 창을 분리한다. | Always on Top과 실제 바탕화면 부착의 책임을 구분 | Desktop Surface, Dashboard | 사용자 확정 요구사항 | ACCEPTED |
| PROD-002 | 확인되지 않음 | 기존 하단 Dock과 위젯형 Dashboard를 유지한다. | 공통 진입 및 기존 업무 흐름 보존 | Dashboard, Dock, 전체 작업실 | 사용자 확정 요구사항 | ACCEPTED |
| DEV-001 | 확인되지 않음 | 기능은 독립 worktree에서 개발하고 QA 후 순차 통합한다. | 병렬 개발 보호와 통합 위험 축소 | 전체 | 사용자 확정 로드맵 | ACCEPTED |
| DESIGN-001 | 확인되지 않음 | 기능 안정화 이후 전체 UI/UX를 통일하며, 기능 개발 중에는 공통 Navy·Mint·Ivory 원칙을 준수한다. | 기능별 작업과 전체 디자인 통합의 충돌 방지 | 전체 UI | 사용자 확정 요구사항 | ACCEPTED |
| INV-001 | 확인되지 않음 | 물품관리는 DESK 중심 관리와 제한된 웹 사용자 구조로 이전한다. | 관리자와 현장 입력 권한을 분리하면서 공유 재고 단일 원장 유지 | Inventory, BOGUNON Web | 사용자 확정 요구사항 | ACCEPTED |
| INV-002 | 확인되지 않음 | 보건지원강사는 조회·사용기록만 가능하며 등록·삭제·입고·폐기 확정·재고 정정·구매 품의 권한을 갖지 않는다. | 재고 관리자 권한과 사용자 입력 권한의 분리 | Inventory, Auth/RLS | 사용자 확정 권한 모델 | ACCEPTED |
| INV-003 | 확인되지 않음 | Purchase Helper의 구매 후보·입고 결과를 Inventory 재고 갱신과 연결한다. | 구매부터 입고·재고까지 추적 가능한 흐름 확보 | Purchase, Inventory | 사용자 확정 요구사항 | ACCEPTED |
| NEWS-001 | 확인되지 않음 | Newsletter Studio는 `otter-nest`와 최신 newsletter Skill의 제작 규칙을 참고해 독립 엔진으로 구현하며 Skill을 Tauri에서 직접 실행하지 않는다. | 앱 런타임 경계와 제작 규칙을 분리 | Newsletter | 사용자 확정 요구사항 | ACCEPTED |
| PDF-001 | 확인되지 않음 | PDF & Image Tools는 이음오피스 처리 엔진을 좁게 검토하고 Electron UI나 전체 앱을 복사하지 않는다. | 필요한 처리 로직만 재사용하고 제품·라이선스 경계를 유지 | PDF & Image Tools | 사용자 확정 요구사항 | ACCEPTED |
| LIB-001 | 확인되지 않음 | Workspace Library는 기능 결과물 정리, 기능 간 전달, 최근 작업 재개, 승인 기반 백업을 제공한다. | 분산된 작업 결과를 로컬 우선으로 연결 | Workspace Library, 전체 제작 기능 | 사용자 확정 요구사항 | ACCEPTED |
| WEB-001 | 확인되지 않음 | 기존 BOGUNON 웹앱의 연간 보건업무 캘린더를 DESK에 중복 구현하지 않는다. | 역할 중복과 이중 유지보수 방지 | 일정, BOGUNON Web | 사용자 확정 요구사항 | ACCEPTED |
| FIN-001 | 확인되지 않음 | MY FINANCE의 개인 재무 데이터는 보건업무 데이터와 분리하고 로컬 보호·백업 규칙을 적용한다. | 민감 개인 데이터의 도메인·저장 경계 유지 | MY FINANCE | 사용자 확정 요구사항 | ACCEPTED |
| REL-001 | 확인되지 않음 | QA PASS와 배포 완료를 구분하며, Windows 통합 회귀와 설치·업데이트·제거 검증 후 정식 배포한다. | 근거 없는 완료 선언과 운영 위험 방지 | 전체, Release | 사용자 확정 로드맵 | ACCEPTED |

## 검토 중인 제안

아래 항목은 저장소에 설계 또는 구현 흔적이 있지만 사용자 확정 결정으로 승격하지 않는다.

| ID | 제안 | 근거 | 상태 |
|---|---|---|---|
| PROP-001 | Desktop Surface의 최종 renderer/session/ACL 계약 | `feature/desktop-surface-widget-ui`, `feature/desktop-surface-c2d2-renderer-session` | PROPOSED |
| PROP-002 | Inventory의 최종 Supabase schema·RPC·RLS 세부 계약 | `feature/inventory-management`의 IM-1A 문서와 untracked IM-1B 자산 | PROPOSED |
| PROP-003 | 기능별 디자인 변경을 공통 `DESIGN.md`에 병합하는 구체 순서 | [Design Variants](DESIGN_VARIANTS.md) | PROPOSED |

## 변경 규칙

새 결정을 추가할 때는 사용자 승인 근거와 영향을 함께 기록한다. 날짜를 확인할 수 없으면 `확인되지 않음`을 유지한다. 기존 결정을 바꿀 때는 원래 행을 삭제하지 않고 `SUPERSEDED`로 표시하고 새 ID를 추가한다.
