# IM-2B-1 Cloud 인계

## 현재 상태

- Branch: `feature/inventory-management`
- 기준 구현 HEAD: `adf1b2f5536ed68fc5b060551e8f6d17d10f9a47`
- IM-2B-1 상태: `INCOMPLETE / PLAN APPROVAL PENDING`
- 완료: 기존 UI·인증·RLS·RPC 계약에 대한 읽기 전용 조사와 구현 접근안 작성
- 미완료: 상세 실행 계획 생성, 제품 코드 구현, Local QA 통합, 회귀 및 보안 검증
- IM-2A 상태: Native 기능 검증은 통과했으나 자동 Native 캡처 증거가 일부 미확보되어 `CONDITIONAL`

## 확인된 계약

1. 현재 Inventory UI는 합성 데이터 `Preview` 어댑터만 사용한다.
2. 기존 전역 Supabase 인증 클라이언트는 운영 origin 전용이므로 Local QA에 재사용하지 않는다.
3. Local QA Supabase 프로젝트는 저장소의 격리된 QA 설정과 기존 실행 스크립트를 사용한다.
4. 활성 membership 사용자는 자기 학교의 물품·로트를 조회할 수 있다.
5. movement 조회는 교사 관리자의 학교 전체 범위와 강사의 본인 기록 범위로 제한된다.
6. 구매 batch·line·receipt 조회 및 변경은 교사 관리자 범위다.
7. `inventory_items` 등록은 별도 RPC가 아니라 교사 관리자 RLS와 column-scoped `INSERT` 권한으로 제공된다.
8. lot 잔량, movement, audit, idempotency 레코드는 클라이언트가 직접 변경하지 않는다.
9. 재고 수량 변경은 기존 검증된 RPC만 사용한다.
10. 구매 연결 입고 movement의 reversal은 서버 정책이 확정되지 않아 현재 차단되어 있다.

## 승인 대기 중인 권장 접근

### 데이터 소스

- `Preview`: 기존 합성 데이터, 서버 요청 없음, `persisted: false`
- `Local QA`: 명시적인 개발 환경 플래그에서만 활성화
- `Production`: IM-2B-1에서는 비활성화하며 런타임 설정으로 우회할 수 없게 한다.

### Local QA 인증과 클라이언트

- 운영 인증 singleton과 별도의 Supabase client 및 session storage namespace를 사용한다.
- Local QA 설정은 loopback origin과 저장소에 정의된 Inventory QA 포트만 허용한다.
- 운영 build에서는 Local QA 구성을 거부한다.
- 합성 계정의 자격정보는 Git, 앱 bundle, 로그, 문서에 저장하지 않는다.
- 기존 QA harness가 생성한 합성 계정으로만 인증한다.

### 읽기·쓰기 경계

- 조회: items, lots, 권한 범위의 movements, 교사 관리자 범위의 purchase batch/receipt 진행 상태
- 물품 등록: 기존 `inventory_items` RLS `INSERT` 계약만 사용
- 재고 쓰기: 기존 use/receive/dispose/adjust/reversal RPC만 사용
- 구매 쓰기: 기존 purchase batch/status/receipt RPC만 사용
- 현재 구매 후보 UI가 서버 batch 생성에 필요한 전체 line 계약을 수집하지 못하면 Local QA에서도 비활성화하고 이유를 표시한다.
- 어떤 경로에서도 lot 또는 movement 직접 DML을 추가하지 않는다.

### 요청·UI 상태

- 논리적으로 동일한 요청은 성공 또는 취소까지 같은 request UUID를 유지한다.
- 요청 중 버튼 중복 실행을 막는다.
- 서버 성공 응답 전에는 저장 완료를 표시하지 않는다.
- 성공 후 서버 데이터를 다시 조회해 화면 상태를 확정한다.
- Preview와 Local QA 전환 시 이전 데이터, 오류, pending 요청, session이 섞이지 않게 초기화한다.
- 권한 거부와 실제 빈 목록을 서로 다른 상태로 표시한다.

## 구현 구성요소

1. Preview / Local QA / blocked Production 데이터 소스 경계
2. localhost-only Local QA 인증 및 Supabase client
3. RLS 기반 Inventory read adapter
4. 기존 RPC 및 item INSERT를 감싼 typed mutation adapter
5. pending, retry, permission, error, refetch를 포함한 UI 상태 통합
6. Local Auth/RLS/RPC 브라우저 통합 QA와 기존 회귀 검증

## 범위 밖

- 운영 Supabase 연결 또는 변경
- `medication_*` 객체 변경
- Purchase Helper 제품 코드 변경
- 강사용 웹 UI
- 운영 배포, PR, main 병합
- 기존 서버 계약에 없는 업무를 클라이언트에서 모방하는 구현

## Cloud에서 재개할 순서

1. 이 문서와 기존 Inventory 설계·QA 문서를 읽는다.
2. 실제 branch HEAD와 원격 동기화 상태를 확인한다.
3. 권장 Local QA 활성화 방식에 대한 사용자 승인을 확인한다.
4. `.omo` 계획 workflow를 사용하는 환경이면 IM-2B-1 상세 실행 계획을 먼저 생성한다.
5. 승인 전에는 제품 구현을 시작하지 않는다.
6. 구현 후 Preview 격리, Local QA RLS/RPC, 멱등 재시도, 학교 간 격리와 기존 회귀를 검증한다.

## 필수 검증 범위

- Inventory 집중 UI 테스트 및 전체 UI 회귀
- 기존 Inventory DB 회귀 78개
- 구매 SQL QA 15개
- Purchase Helper Adapter QA 21개
- 실제 합성 JWT HTTP E2E
- 학교별 RLS 및 cross-tenant 차단
- TypeScript, production build, DB lint, security catalog 검사
- secret/PII 검사 및 `git diff --check`

## 보안 메모

- 이 문서에는 운영 URL, project ref, API key, access token, 비밀번호, 실제 학교명, 학생·교직원 정보 또는 실제 재고가 포함되지 않는다.
- Local QA 자격정보와 실행 중 생성되는 토큰은 Cloud 인계 대상이 아니다. Cloud 환경에서 합성 fixture로 다시 생성한다.
