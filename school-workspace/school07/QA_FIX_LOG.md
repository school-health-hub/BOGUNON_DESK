# 자율 QA·수정 기록

| 결함/원인 | 최소 수정 | 실질적 수정 시도 | 결과 |
|---|---|---:|---|
| 기본 permission seed가 ws_owner FORCE RLS에 거부됨 | 승인된 migration 세션에서만 기본값 INSERT, 앱 정책/권한 확대 없음 | 1 | 빈 DB 설치 PASS |
| 지원강사 사용 시 물품 SELECT FOR UPDATE가 편집 전용 RLS와 충돌 | 학교 직렬화 유지, 물품은 읽기만; 실제 변경 lot는 FOR UPDATE 유지 | 1 | 지원강사 명시 권한/동시 출고 PASS |
| 정지 fixture가 auth UUID와 Workspace actor UUID 혼동 | 합성 membership ID로 정확한 구성원 갱신 | 1 | 실제 정지 후 거부 PASS |
| CSS side-effect 타입 선언 누락 | vite/client 선언 추가 | 1 | 신규 strict 오류0 |
| 실제 DB React 검사의 기본1초 대기 부족 | assertion은 유지하고 비동기 대기15초로 지정 | 1 | 실제 저장/입고/사용 UI PASS |
| 기존 Preload 허용 목록에 inventory 누락 | 승인된 고정 inventory 키 추가, 메서드·IPC·범용 API 금지 검사 유지 | 1 | 기존 경계12 PASS |
| REST 격리 테스트 사용자가 A/B 모두 승인됨 | A-only 합성 사용자4로 부정 검사, 다중 소속자는 학교별 역할 상한 별도 검사 | 1 | 실제 LOCAL POSTGREST 거부 PASS |
| 기존 parent 지문에 새 public inventory 함수가 포함 안 됨 | 별도 child 장부·정확한15개 공개 함수 지문/ACL 범위, 기존 장부 불변 | 1 | 공개 wrapper 드리프트/close/replay PASS |
| 비활성 등록값 누락 및 보관 물품 가용량 표시 불일치 | active 입력 저장, 보관 시 전체 수량 유지·가용0·사용불가 표시 | 1 | 실제 등록/전환/입고 거부 재검증 |
| 지원강사 본인 이력 범위 명시 | movement SELECT를 현재 membership/epoch 본인으로 제한, 관리자·교사는 학교 전체 이력 유지 | 1 | 실제 RLS 본인/교사 이력 검사 |
| 기존 root13 오류/SheetJS cache 없음 | 기준 SHA 재현·공식 CDN 확인, 기존 제품/의존성 버전은 변경 안 함 | 0 (분리) | root 기존 실패, 전체 Electron 환경 BLOCKED |

여러 기능을 구축하는 중의 예비 실행과 최종 실행을 구분한다. 수정 없는 반복 결과를 새 고유 시나리오 수로 합산하지 않는다. 보안 검사를 줄이거나 RLS를 끄지 않았다. 기존 로그 일부의 말미 공백은 Git whitespace 검사를 위해 정리한다.
