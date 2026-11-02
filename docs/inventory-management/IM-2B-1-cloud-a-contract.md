# IM-2B-1 Cloud B → Cloud A 연결 계약

## 상태와 소유 범위

- 기준: `feature/inventory-management` / `a765ad08570dc5513edf96bb970442026a0a31ce`.
- Cloud B: `/workspace/BOGUNON_DESK_INVENTORY`, `codex/inventory-im2b1-cloud-b`.
- 기존 `/workspace/BOGUNON_DESK`의 `work` / `a7717f1e1b2234a568f8877adae8c42f8a4d262b` 보존.
- 사용자의 IM-2B-1 구현 지시가 기존 인계 문서의 계획 승인 대기를 대체한다. 기존 인계 문서는 역사 기록으로 보존한다.
- 이번 변경은 `src/inventory-management/connection/**`, Inventory QA script, 이 계약/결과 문서뿐이다.
- Dashboard/Dock, 기존 Inventory UI, Electron main/preload/IPC, 공통 인증, Purchase Helper 제품 코드와 기존 adapter, migration은 변경하지 않았다.
- Cloud A는 이 모듈을 소비하는 UI 연결을 별도 작업한다. B의 연결 모듈을 동시에 수정하지 않는다. 이 단계에서 원격 push/PR/병합/배포는 하지 않는다.

## 진입점과 환경

공개 진입점은 `src/inventory-management/connection/index.ts`, 전체 DTO/인터페이스는 같은 폴더의 `contracts.ts`다.

```ts
import { createInventoryConnection, InventoryError } from './inventory-management/connection';
import type { InventoryLocalConnection, LocalQaConfig } from './inventory-management/connection';

// 위 경로는 src/의 소비 파일 기준. 다른 위치에서는 실제 상대 경로를 맞춘다.
const preview = await createInventoryConnection(); // mode=preview, persisted=false
// preview.mode를 좁힌 뒤 preview.adapter.loadWorkspace()/previewMutation() 사용.

const local = await createInventoryConnection('local-qa', runtimeLocalConfig);
if (local.mode !== 'local-qa') throw new Error('Local QA connection required');
await local.login(syntheticEmail, runtimePassword);
await local.selectSchool(syntheticSchoolId);
const items = await local.listItems();
```

`runtimeLocalConfig`는 `{ endpoint: string; publishableKey: string }`이다. 실제 값/비밀번호를 소스·VITE 변수·번들·Git·로그에 넣지 않는다. 이 모듈은 환경 파일을 읽거나 기존 운영 인증 singleton을 import하지 않는다. Supabase Auth REST/PostgREST 전용 클라이언트를 사용하며 토큰·만료 시간은 인스턴스의 private 메모리만 사용한다. Local Storage, IndexedDB, 파일, 운영 세션 namespace를 사용하지 않는다. client 간 세션도 공유하지 않는다.

- 기본 Preview: 기존 합성 adapter만 생성, 네트워크 0회. Local 데이터 fallback 없음.
- Local QA: 호출자가 명시적으로 `local-qa`와 runtime config를 제공하고 Vite `DEV=true`, `PROD=false`일 때만 생성된다. 직접 `localQa.ts`를 import해도 같은 runtime guard가 적용된다.
- 허용 API: HTTP `127.0.0.1:56321`, `localhost:56321`, `[::1]:56321`만. 사용자정보·별도 path/query/hash·HTTPS·타 포트·외부 origin을 거절한다. 각 HTTP 요청에서도 endpoint와 build/runtime 조건을 검사하며 redirect를 거절한다.
- 브라우저 Local QA UI origin: HTTP loopback의 `56300` 포트만. Electron의 file origin이나 다른 origin에서는 차단된다. Cloud A가 이 gate를 임의 완화하지 않는다. Node 통합 테스트는 브라우저 location 없이 실행한다.
- Cloud의 loopback은 현재 컨테이너다. 학교 PC/호스트 DB 주소로 자동 해석하거나 외부 DB로 대체하지 않는다.
- Production: 명시적 production 요청도 거절한다. production public-entry 빌드에서 Local transport 모듈이 제거되는지 별도 검증한다. 기존 DESK 앱에는 아직 import하지 않는다.
- 허용 key는 publishable 형식 또는 anon 역할 legacy JWT다. service-role/secret key를 받지 않는다. 최종 키 검증·인증·RLS는 로컬 서버 책임이다.

## 인증과 데이터 폐기

`authState()`는 `signed_out | signing_in | authenticated | expired | disposed`를 반환한다. authenticated 상태에는 `userId`, `schoolId|null`만 있으며 token/email/password는 없다.

- `login(email,password)`: `@example.invalid` 합성 계정만 허용. 계정은 기존 QA harness 또는 신규 Local test가 생성한다. 앱 signup/OAuth는 제공하지 않는다.
- 허용된 형식의 로그인 요청을 보내기 전에 이전 세션/학교/요청을 폐기한다. 서버 로그인 실패 후 이전 계정으로 돌아가지 않는다. 입력 형식 오류는 네트워크 전 검증에서 거절되며 기존 세션을 전환하지 않는다.
- `logout()`: 메모리·진행 요청을 먼저 제거하고 현재 로컬 세션만 revoke한다. revoke 실패도 이전 세션을 복원하지 않는다. 이미 발급된 JWT는 서버 만료 전까지 유효할 수 있다.
- refresh token은 저장하거나 자동 갱신하지 않는다. 만료 시 `expired`로 전환하고 재로그인이 필요하다. 서버 401/JWT 오류도 동일하게 세션을 제거한다.
- `selectSchool(id)`: 기존 학교를 먼저 제거한 후 실제 RLS-visible active membership을 확인한다. 실패하면 선택 학교는 null이다.
- 계정/학교 전환, 만료, logout, dispose 시 HTTP 요청을 abort하고 epoch를 변경한다. 이미 끝나가는 이전 응답도 STALE_CONTEXT로 거절한다.
- `subscribe(fn)`와 `onInvalidate(fn)`는 각각 unsubscribe 함수를 반환한다. UI는 invalidate에서 이전 데이터·오류·선택·pending 표시를 제거한다. 성공한 mutation에도 invalidate가 발생한다. adapter에는 row cache가 없다.
- Local → Preview 전환 시 UI가 `local.dispose()`와 기존 view 폐기를 수행한 뒤 새 Preview를 생성한다. 두 모드의 DTO를 섞거나 이전 Promise 결과를 화면에 게시하지 않는다.

## 읽기 API

| 함수 | 결과/권한 |
| --- | --- |
| `listItems()` | 선택 학교의 RLS-visible `Item[]` |
| `itemDetail(itemId)` | `ItemDetail`: item, lot 잔량/기한, total/available decimal-integer string |
| `movements(itemId?)` | 교사 관리자 학교 전체, 강사는 서버 RLS에 의해 본인 기록만 |
| `purchaseBatches()` | teacher_admin 전용 `PurchaseBatch[]` |
| `purchaseProgress(batchId)` | teacher_admin 전용 batch, lines, receipts, receiptLines |

매 작업 전 active membership을 다시 확인한다. membership이 없거나 구매 권한이 없으면 PERMISSION_DENIED, 권한 확인 후 빈 목록이면 `[]`, 선택 학교의 단일 대상 부재는 NOT_FOUND다. RLS는 조회 불가 대상의 실제 존재 여부를 공개하지 않으므로 타학교 존재/부재를 구분하지 않는다.

모든 조회에 school filter를 적용하고 응답 school도 검사한다. 총재고는 모든 visible lot 잔량 합계, 가용재고는 Asia/Seoul 오늘 기준 미만료 available lot 합계다. 500행씩 고유 ID 순으로 pagination하며 100,000행 한도 초과는 실패한다. 여러 HTTP 조회의 집계는 DB transaction snapshot이 아니며 동시 변경 중 표시가 바뀔 수 있다. 쓰기 판정의 권위는 RPC다. 성공 후 반드시 재조회한다.

`Integer`, `Decimal`, UUID는 TypeScript string DTO다. PostgreSQL bigint를 JS number로 임의 변환하지 않는다. 서버 JSON이 안전 정수 범위를 벗어난 number이면 rounded 값을 반환하지 않고 INVALID_RESPONSE로 거절한다. 서버 decimal number는 검증 후 string으로 정규화한다. 클라이언트 수량·금액 검사는 서버 검증을 대체하지 않는다.

## mutation API와 DTO

```ts
// local은 위 예시처럼 mode를 좁힌 InventoryLocalConnection이다.
const request = local.prepare('inventory_use_stock', {
  p_item_id: itemId, p_quantity: '1', p_reason: 'Synthetic use',
});
// 논리 요청이 끝날 때까지 이 handle 또는 동일한 UUID + 동일 DTO를 유지한다.
try {
  const result = await request.execute();
  // persisted=true, data=검증된 RPC 응답, refreshRequired=true
  const freshDetail = await local.itemDetail(itemId);
  // UI는 result와 freshDetail을 해당 context의 최신 상태로 반영한다.
} catch (error) {
  // UI가 판단한 재시도는 request.execute()로 수행한다. 자동 재시도 없음.
}
```

`prepare<N>(name: N, input: RpcInputs[N], requestUuid?: UUID)`가 immutable DTO와 actor/school epoch를 캡처한다. `p_school_id`는 선택 학교에서, `p_request_uuid`는 handle에서 주입한다. 외부에서 이 두 필드를 input에 추가하면 거절한다. 동일 UUID의 동시 실행과 동일 UUID의 변경 payload를 차단한다. 다른 클라이언트/프로세스의 멱등성은 서버 계약이 담당한다. 서버 acknowledgement 및 응답 school/request/operation/대상·수량 구조를 검증한 뒤에만 persisted=true를 반환한다.

| RPC | input (school/request는 자동 주입) |
| --- | --- |
| inventory_use_stock | p_item_id, p_quantity, p_reason |
| inventory_receive_stock | p_item_id, p_purchase_quantity, p_base_units_per_purchase_unit, p_received_at, p_expires_on, p_purchase_link_id:null, p_reason |
| inventory_dispose_stock | p_item_id, p_lot_id, p_quantity, p_reason |
| inventory_adjust_stock | p_item_id, p_lot_id, p_expected_quantity, p_counted_quantity, p_reason |
| inventory_reverse_movement | p_original_movement_id, p_reason |
| inventory_create_purchase_batch | p_batch_id, p_note, p_lines:PurchaseLineInput[] |
| inventory_set_purchase_batch_status | p_batch_id, p_target_status, p_reason |
| inventory_confirm_receipt | p_batch_id, p_receipt_id, p_received_at, p_reason, p_lines:ReceiptLineInput[] |

`PurchaseLineInput`는 실제 SQL의 9개 필드 candidate_id/item_id/requested_purchase_quantity/base_unit/purchase_unit/base_units_per_purchase_unit/specification_snapshot/expected_unit_price/currency다. `ReceiptLineInput`는 line_id/received_purchase_quantity/expires_on이다. client는 구조·UUID·decimal·정수·중복 line을 검사하고 변환비·재고·상태 전이·멱등 payload hash는 서버가 최종 검증한다. bigint는 문자열 정수, numeric은 소수 문자열, 날짜는 ISO date, timestamp는 timezone이 있는 ISO 문자열이다. 클라이언트는 일부 text/decimal 길이를 서버보다 보수적으로 제한한다.

기존 StockResponse는 quantity_delta, item_total_quantity, item_available_quantity, movements, processed_at, replayed, applied/replayed status, reactivation_required를 유지한다. 구매 응답은 batch/status, 부분입고 응답은 receipt_lines/remaining_by_line을 유지한다. replay 응답은 저장된 결과일 수 있으므로 최신 상태는 다시 조회한다.

`registerItem(NewItem)`만 별도 column-scoped INSERT를 사용한다. school_id는 자동 주입하며 item_id/created_at/updated_at 등 임의 필드는 허용하지 않는다. lot/movement/audit/idempotency 직접 DML API는 없다. 품목 INSERT에는 서버 request UUID 계약이 없으므로 자동 재시도/멱등 성공을 약속하지 않는다. 네트워크 실패로 결과가 불명확하면 먼저 품목 목록을 확인한다.

## 오류와 미지원

`InventoryError` 공개 속성은 `code`, 안전한 대문자 `serverCode?`, `outcomeUnknown`이다. raw 서버 message/details/hint, 토큰, 경로, 자격정보를 로그/오류로 전달하지 않는다.

- ENVIRONMENT_BLOCKED, INVALID_INPUT, UNAUTHENTICATED, PERMISSION_DENIED, NOT_FOUND
- CONFLICT, IDEMPOTENCY_CONFLICT, REQUEST_IN_FLIGHT
- SERVER_REJECTED, NETWORK_ERROR, INVALID_RESPONSE, STALE_CONTEXT, DISPOSED
- 서버 PT401/403/404/409/422, 42501 및 JWT 오류를 정규화한다.
- INSUFFICIENT_STOCK, STALE_STOCK_STATE, RETRYABLE_CONFLICT, PURCHASE_RECEIPT_EXCEEDS_REQUESTED, PURCHASE_RECEIPT_REVERSAL_REQUIRES_POLICY 등 원 서버의 안전한 code를 serverCode로 유지한다.
UI 권장 처리(아래는 표시 계약이며 UI 구현은 Cloud A 범위):

| code / 상태 | UI 표시·동작 |
| --- | --- |
| INVALID_INPUT | 필드 입력 안내, 저장 완료 표시 금지 |
| UNAUTHENTICATED / expired | 이전 데이터 제거 후 합성 계정 재로그인 안내 |
| PERMISSION_DENIED | 빈 목록과 구별한 권한 부족 상태 |
| NOT_FOUND | 현재 학교에서 대상을 조회할 수 없음; 타학교 존재를 추정하지 않음 |
| CONFLICT / IDEMPOTENCY_CONFLICT | 현재 데이터 재조회·재검토; 새 UUID로 자동 재전송 금지 |
| REQUEST_IN_FLIGHT | 해당 논리 요청의 버튼 비활성 유지 |
| NETWORK_ERROR / INVALID_RESPONSE + outcomeUnknown | 저장 여부 미확인 안내; 기존 UUID handle과 재조회로 확인 |
| STALE_CONTEXT / DISPOSED | 이전 화면 응답 폐기, 새 학교/사용자 화면에 표시하지 않음 |
| ENVIRONMENT_BLOCKED | 개발 Local QA 조건 안내, 운영 origin으로 fallback 금지 |
| SERVER_REJECTED | 허용된 serverCode를 사용자 설명으로 매핑하고 raw 응답 출력 금지 |

- POST 이후 네트워크/문맥 변경/잘못된 acknowledgement는 outcomeUnknown=true일 수 있다. abort는 서버 rollback을 보장하지 않는다. 동일 UUID로 확인·재조회하며 새 UUID로 맹목 재시도하지 않는다.
- 구매 연결 입고 reversal, batch 임의 편집/삭제, 강사 구매 쓰기, lot 상태 재활성화, 운영 연결, 자동 세션 복원, Electron UI/IPC는 미지원이다. 서버가 제공하지 않는 정정/취소 흐름을 만들지 않는다.

실행 명령과 현재 검증 한계는 `IM-2B-1-cloud-b-results.md`를 따른다.

## Cloud A에서 가져올 때 필요한 선행 파일

2026-11-02 원격 `codex/electron-feature-integration` (`40d0153af1d95a8669d48102c1e1cdab2c8a14d7`), `codex/electron-inventory-minimal` 및 `codex/electron-seven-feature-integration` (`8f0044cd00bdcfe219a2d9ff0decaf4b4b2bede4`)과 비교했다. B의 13개 변경 경로와 직접 겹치는 원격 변경은 0개다. 다른 채팅의 미푸시 변경은 이 비교로 확인하지 못한다.

**B 구현 커밋만 해당 Electron 브랜치에 cherry-pick하는 것은 충분하지 않다.** 이들 원격에는 B의 Preview 진입점이 import하는 아래 기존 Inventory 기준 파일이 없다:

- `src/inventory-management/ui/syntheticAdapter.ts`
- `src/inventory-management/ui/syntheticFixtures.ts`
- `src/inventory-management/ui/inventorySelectors.ts`
- `src/inventory-management/ui/inventoryTypes.ts`

위 네 파일은 B가 이번에 수정한 파일이 아니라 인계 기준 `a765ad08570dc5513edf96bb970442026a0a31ce`의 의존성이다. 독립 B clone에서는 이미 존재한다. Cloud A는 별도 통합 작업에서 이 선행 의존성과 로컬 서버 QA 트리를 검토·확보해야 한다. Electron의 기존 `InventoryWorkspace.tsx`/`model.ts`는 별도 모델이므로 자동 대체하지 않는다. 원본 Inventory 브랜치 전체를 자동 병합하지 않는다.

또한 Local API의 PostgreSQL migration/기존 QA 스크립트는 `inventory-management/qa/**` 인계 기준에 의존한다. 새 연결 통합 테스트만 복사해도 DB가 자동 준비되지 않는다. `file:` Electron origin에서 Local QA를 연결하려고 guard를 제거하지 말고, 우선 Windows의 독립 Inventory clone과 Node/Vitest 경로로 DB 연결을 검증한다. Electron UI 연결·DTO 변환·origin 설계는 Cloud A의 별도 승인 범위다.
