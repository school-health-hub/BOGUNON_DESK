# INV-EL-02 — Main 소유 Inventory transport 인계

## 범위와 기준

- B 제품 기준: `ef0ba64cae5c0a6ccbba05a8821a80730dcfc087`, 독립 로컬 브랜치 `codex/inventory-electron-transport`.
- 작업 폴더: `/workspace/BOGUNON_DESK_INVENTORY_TRANSPORT`.
- A 확인 기준: `feature/electron-inventory-local-qa` / `4b37d7885050f174fddeeb4af2441c9efccd1108`. 최초 원격에 없었으나 사용자 원격 인계 후 fetch하여 실제 Main/Preload/protocol/문서를 확인했다. A 파일은 변경하지 않았다.
- 기존 DB CI `95e4f10415a971790d476dd58ac42a12b1ffb80c`, run 41467324396의 READY는 기존 코드의 실제 DB 근거다. **이번 transport 변경의 DB/IPC/GUI 검증을 대신하지 않는다.**
- 수정 범위는 B `connection/**`와 이 인계 문서뿐이다. Preview 합성 데이터, UI, Electron, JSON 재고, SQL/RPC/RLS/migration, CI 브랜치/제품 브랜치는 그대로다. 원격 push 없음.

## 확인한 A의 현재 IPC (변경 금지)

`electron-p0/main/inventory-local-qa.ts`의 `inventoryQaAllowed()`는 `!app.isPackaged`, dev URL 정확히 `http://127.0.0.1:5174/`, `INVENTORY_LOCAL_QA=1`을 모두 요구한다. `main.mts:119`에서 status handler를 등록한다. 호출 window/frame/URL은 `assertSender`로 검증한다.

- 채널 `p2:inventory-local-qa:status`, 인자 없음.
- Preload `window.electronWork.inventoryLocalQa?.status()` → `Promise<IpcResult<InventoryQaStatus>>`.
- 유일한 HTTP는 `GET http://127.0.0.1:56321/auth/v1/health`, 인증 header/body 없음, 전체 3초/16KiB/redirect 미추적/중복 점검 차단.
- status는 `mode:local-qa`, `authGateway:reachable|unavailable`, `inventoryConnection:blocked`, `persisted:false`만 반환한다. DB/RPC/Auth 로그인 성공이 아니다.

**이 status/health 계약을 POST/Auth/RPC proxy로 재사용하지 않는다.** 기존 Renderer 네트워크 allowlist와 CORS도 그대로 유지한다. 아래 업무 IPC와 Main service 구현은 Cloud A 후속 변경이다.

## 공개 진입점과 생성

Browser는 기존 `connection/index.ts`의 `createInventoryConnection()`(기본 Preview), `createInventoryConnection('local-qa', config)`를 유지한다. 기존 browser `environment()`의 DEV/비PROD/HTTP loopback UI port 56300 guard는 삭제·완화하지 않았다. `file:`/5174는 여전히 Browser factory에서 거절한다. Browser/Preview factory로 transport를 전달하면 거절한다.

Electron은 **Main 전용 `connection/electron.ts`**에서 `createElectronInventoryConnection`을 import한다. UI/Preview import가 없는 native ESM 진입점이다. `index.ts`에도 async factory를 제공하지만 Main에서는 electron entry를 권장한다. Cloud A Main의 최소 선별 파일은 electron.ts/localQa.ts/contracts.ts/responses.ts/validation.ts/transport.ts의 6개다. 이 경로는 B의 Preview UI 네 파일이나 index.ts를 요구하지 않는다. index의 Browser/Preview 진입점을 별도로 가져올 경우에는 기존 syntheticAdapter/syntheticFixtures/inventorySelectors/inventoryTypes 의존성도 필요하다. transport 타입은 `transport.ts` 또는 index의 type export를 사용한다.

```ts
// Cloud A의 Main 서비스 모듈에서 상대 경로를 실제 배치에 맞춘다.
import { createElectronInventoryConnection } from '../../src/inventory-management/connection/electron.js';
import type { InventoryElectronTransport } from '../../src/inventory-management/connection/transport.js';

// mainInventoryTransport는 아래 제한을 구현한 Main 내부 함수 객체다.
const adapter = createElectronInventoryConnection({
  enabled: true,
  endpoint: 'http://127.0.0.1:56321',
  publishableKey: runtimeQaPublicKey,
  host: {
    readExecutionState: () => ({
      packaged: app.isPackaged,
      devUrl: dev, // 실제 Main 설정, 정확히 http://127.0.0.1:5174/
      optIn: process.env.INVENTORY_LOCAL_QA,
    }),
  },
  transport: mainInventoryTransport,
});
await adapter.login(syntheticEmail, enteredPassword);
await adapter.selectSchool(syntheticSchoolId);
const items = await adapter.listItems();
const request = adapter.prepare('inventory_use_stock', {
  p_item_id: itemId, p_quantity: '1', p_reason: 'Synthetic use',
});
const saved = await request.execute(); // persisted=true/refreshRequired=true만 저장 성공
const detail = await adapter.itemDetail(itemId); // 성공 후 서버 권위 데이터 재조회
```

capability는 Main이 실제 app/config를 읽는 **함수 객체**다. Renderer가 넘긴 `packaged:false`/`enabled:true`를 권위로 사용하지 않는다. 매 요청 전·응답 후 실행 상태를 다시 검사한다. host 조건이 꺼지면 세션/요청을 폐기한다. window/document/location이 있는 Renderer에서는 생성 자체를 거절하므로 `file:` allowlist 추가가 아니다. native Node에서 Vite env가 없더라도 실행 가능하며, packaged=true 또는 NODE_ENV=production이면 차단한다. Vite production 빌드는 public entry에서 Local QA 구현을 제거하고 direct Electron entry도 실행을 거절한다.

Main의 JS 함수 자체를 이 라이브러리가 sandbox하는 것은 아니다. Main transport와 capability는 신뢰할 수 있는 host 코드여야 하며 Renderer IPC 입력으로 주입해서는 안 된다. 실제 sender 검증·프로세스 정책은 Cloud A Main 경계가 독립적으로 수행한다.

## Transport v1

이 객체는 **Main 내부 네트워크 계층**이며 Preload/Renderer에 그대로 노출하지 않는다.

```ts
interface InventoryElectronTransport {
  readonly kind: 'electron-local-qa';
  readonly version: 1;
  send(request: InventoryTransportRequest, signal: AbortSignal): Promise<InventoryTransportResponse>;
}
```

요청은 `{version:1,id,method,path,query,body,credentials:{publicKey,bearer}}`다. `id`는 전송 correlation UUID이며 RPC body의 `p_request_uuid`(논리 요청 UUID)와 별개다. path는 아래 literal 집합이고 origin/URL/host/header/channel 필드는 없다. Adapter는 immutable clone을 전달하며 `validateInventoryTransportRequest()`로 검증한다. Main transport도 동일 validator를 호출한 후 고정 hostname `127.0.0.1`, port `56321`로만 요청한다. 환경 proxy/redirect를 통해 외부로 라우팅하지 않는다.

| path | method / 고정 조건 |
| --- | --- |
| `/auth/v1/token` | POST, query grant_type=password, body email/password, reserved example.invalid 계정, user bearer 없음 |
| `/auth/v1/logout` | POST, query scope=local, body null, 현재 사용자 JWT |
| `/rest/v1/<table>` | GET, select=*, school_id=eq.UUID, 고정 ID order, limit=500, offset=500 단위/100000 미만; UUID item/batch/user filter와 is_active=eq.true만 |
| `/rest/v1/inventory_items` | POST, 허용된 10개 품목 필드+자동 school_id만; Prefer return=representation |
| `/rest/v1/rpc/<name>` | POST, query 없음, 기존 typed RpcInputs + 자동 school_id/request_uuid만 |

GET table 허용 목록: inventory_members, inventory_items, inventory_stock_lots, inventory_stock_movements, inventory_purchase_batches, inventory_purchase_lines, inventory_purchase_receipts, inventory_purchase_receipt_lines.

RPC 허용 목록: inventory_use_stock, inventory_receive_stock, inventory_dispose_stock, inventory_adjust_stock, inventory_reverse_movement, inventory_create_purchase_batch, inventory_set_purchase_batch_status, inventory_confirm_receipt. health GET, signup, refresh, 임의 REST table/core RPC, PATCH/PUT/DELETE, lot/movement 직접 쓰기, arbitrary query/header는 이 transport에서 거절한다. 기존 item INSERT의 서버 권한을 확대하지 않았다.

Main은 publicKey를 apikey header로 사용한다. publicKey가 legacy anon JWT면 anonymous Auth 요청의 Bearer에도 사용할 수 있고, publishable key는 Bearer JWT로 취급하지 않는다. bearer가 있으면 user Authorization Bearer에 사용하며 role=authenticated만 허용한다. service_role/secret key는 거절한다. JWT 서명/실제 권한의 최종 검증은 Auth/RLS/RPC 서버가 담당한다. user_metadata로 권한을 판단하지 않는다.

응답은 `{version:1,id,status,redirected:false,body:string}`으로 정확히 반환한다. `body`는 UTF-8 JSON 텍스트이며 204에서는 빈 문자열이다. status/상관 ID/redirect/크기를 확인한 뒤 기존 Auth·RPC decoder를 재사용한다. header/token을 별도로 Renderer에 반환하지 않는다. 이 body에는 Auth token이 포함될 수 있으므로 응답 전체를 로깅하지 않는다.

### 업무 요청 제한 (health와 별도)

- UTF-8 JSON request 전체 **64KiB**(credentials 포함).
- REST/RPC response **2MiB**, Auth response **32KiB**.
- 요청 시작부터 body 완료까지 **15초**. 자동 재시도 없음.
- redirect 금지. 3xx/redirected=true를 거절한다.
- Main은 실제 스트리밍 중 byte를 집계하고 한도/timeout/abort에서 소켓을 destroy해야 한다. Adapter의 Promise 경합도 bridge가 abort를 무시한 경우 timeout/late-response를 거절한다. 신뢰할 수 없는 host 함수가 무슨 URL로 접속하는지 Adapter가 대신 보장할 수는 없다.
- AbortSignal은 Main 내부 wrapper 상태이며 IPC structured clone 대상으로 삼지 않는다.

A가 제안한 업무 요청 64KiB/2MiB/15초 상한을 채택하고 Auth에는 더 작은 32KiB 상한을 둔 것이다. 기존 health의 3초/16KiB는 그대로 유지한다. 100-line DTO라도 64KiB 초과면 전송 전 실패하며 상한을 자동 확대하지 않는다.

## Auth와 lifecycle

Auth login/logout까지 같은 주입 transport로 전송한다. 별도 Supabase singleton/내부 SDK fetch/운영 session fallback은 없다. 토큰·비밀번호·refresh token을 Electron store/JSON/localStorage/로그에 보관하지 않는다.

- 기존 AuthState/읽기/PreparedMutation/RpcInputs/RpcOutput/NewItem API와 UUID·bigint/decimal string을 유지한다.
- login은 token role을 검사한 뒤 상태를 게시한다. 세션은 instance 메모리 전용이고 expires_in에 따라 만료된다.
- 세션 복구/refresh-token 갱신은 **미지원**이다. 새 프로세스 또는 expired 상태에서는 명시적 재로그인이 필요하다. refresh endpoint를 열지 않는다.
- logout은 메모리를 먼저 지우고 scope=local revoke를 전송한다. revoke 실패가 로컬 인증을 복원하지 않는다.
- 계정/학교 전환은 기존 epoch+abort를 재사용한다. 이전 응답/준비된 mutation은 STALE_CONTEXT로 거절한다. `onInvalidate`에서 Main과 UI가 이전 데이터/오류/pending을 제거한다.
- host opt-in/packaged/devUrl이 바뀌면 진행 요청/인증 상태를 지우고 ENVIRONMENT_BLOCKED로 닫는다.
- 동일 논리 요청은 동일 PreparedMutation과 request UUID를 재사용한다. Main은 불변 payload를 보존한다. 중복 실행·같은 UUID의 다른 payload는 거절한다.
- timeout/네트워크 단절/잘못된 성공 응답에서 outcomeUnknown=true일 수 있다. abort는 서버 rollback이 아니다. 새 UUID로 자동 재전송하지 않는다. 성공 후 권위 데이터 재조회 실패도 원래 저장 성공과 구별한다.

추가 오류 code는 TRANSPORT_TIMEOUT, PAYLOAD_TOO_LARGE, RESPONSE_TOO_LARGE다. 기존 NETWORK_ERROR/INVALID_RESPONSE/STALE_CONTEXT/UNAUTHENTICATED/PERMISSION_DENIED/CONFLICT/IDEMPOTENCY_CONFLICT를 유지한다. transport 예외의 raw message/cause를 사용자 오류로 전달하지 않는다. `persisted:true`는 검증된 서버 mutation 결과에서만 반환한다.

## Cloud A 후속 IPC 구현 계약 (이번에는 미구현)

기존 status()와 분리해 `p2:inventory-local-qa:<구체적 동작>`을 추가한다. Preload는 아래 메서드만 노출하고 raw `send(request)`, URL, header, token, endpoint, 임의 channel 또는 임의 invoke는 노출하지 않는다.

| Preload method | Main 처리 |
| --- | --- |
| login({email,password}) | 합성 계정/길이 검증 → adapter.login → AuthState만 반환 |
| logout() / dispose() | adapter lifecycle, pending handle map과 cache 폐기 |
| authState() | token 없는 AuthState |
| selectSchool({schoolId}) | UUID 검증 → 기존 membership/RLS 확인 |
| listItems() / itemDetail({itemId}) / movements({itemId?}) | 권한 있는 DTO만 반환 |
| purchaseBatches() / purchaseProgress({batchId}) | teacher_admin 정책 유지 |
| registerItem(NewItem) | 기존 column-scoped INSERT 계약만 |
| prepare({operation,input}) | allowlist RpcName+RpcInputs를 검증, Main이 UUID 생성·PreparedMutation 보관; opaque handleId/requestUuid만 반환 |
| execute({handleId}) | caller 소유 handle 실행, 동일 UUID replay; DTO/refreshRequired 반환 |
| discard({handleId}) | 로컬 handle 해제만. 서버 취소/rollback 성공으로 표시하지 않음 |

각 handler는 exact `assertSender(event,window.webContents,url)`, exact 인자 수/schema, app.isPackaged/dev URL/opt-in을 검사한다. service와 handle은 해당 window/session에 소유시킨다. window close·navigation·학교/계정/모드 변경 시 폐기한다. 기존 JSON Inventory IPC에 연결하지 않는다.

새 InventoryQaResult는 `{ok:true,data:{contextRevision,value}} | {ok:false,error:{code,serverCode?,outcomeUnknown,retryable,message}}`를 권장한다. 기존 공통 IpcResult enum에 모든 Adapter 오류를 무리하게 끼워 넣지 않는다. Main은 onInvalidate에서 contextRevision과 cache를 갱신하며 Renderer는 이전 revision 응답을 폐기한다. 성공 value는 기존 Auth/읽기/RPC DTO, 오류 message는 고정 UI 문구다. 자동 retryable=true는 outcomeUnknown을 무시하는 재전송 허가가 아니다.

Renderer에는 실제 UUID를 쓰는 별도 presenter가 필요하다. 합성 Preview의 synthetic-* ID, numeric JSON 잔량, 기존 Preview mutation 결과를 실제 서버 DTO로 캐스팅하지 않는다. 화면 진입 성공/health reachable을 persisted 또는 연결 완료로 표시하지 않는다.

## 실행/컴파일과 테스트

Native Main 진입점은 .js import specifier를 사용한다. Cloud A의 TypeScript 구성에서 필요한 DOM platform type(AbortSignal/TextEncoder 등)과 Vite ImportMeta 타입을 제공한다. native 실행에는 import.meta.env 주입/위장이 필요하지 않다. 검증용 명령(임시 outDir 사용):

```sh
node node_modules/typescript/bin/tsc src/inventory-management/connection/electron.ts --ignoreConfig --outDir /tmp/inventory-main-check --target ES2022 --module ES2022 --moduleResolution bundler --types vite/client --lib ES2022,DOM --skipLibCheck --strict
npx vitest run src/inventory-management --maxWorkers=2
npx tsc --noEmit
npm run build
node inventory-management/qa/scripts/Verify-IM2B1-production.mjs
```

`main-runtime.test.mjs`는 위 Main entry를 실제 native ESM으로 emit하고 별도 Node process에서 DEV 성공/PROD 거절을 확인한다. `production.test.mjs`는 실제 Vite production 빌드로 public-entry code 제거와 direct-entry 차단을 검사한다. `transport.test.ts`는 host capability, Renderer 거절, 고정 endpoint/경로/method, auth/RPC DTO·재조회·logout·학교 전환, replay/충돌/중복, timeout/크기/redirect, service-role 거절, 세션 만료와 fail-closed 오류를 검사한다.

### 실제 DB CI 확장 절차 (아직 실행하지 않음)

이번 변경은 원격 push 및 CI branch 수정을 하지 않는다. 기존 CI 95e4f10 기반 별도 승인된 검증 작업에서 **connection/**의 새 파일/변경만 선별 반영한다. 기존 QA scripts/6 migration/78+15 SQL 및 INV-D06 expectation 보완을 보존한다. product 기준 ef0ba64만 사용하면 과거 Studio 키 조회/Prep 문제가 재발하므로 CI 지원 파일을 되돌리지 않는다.

최소 stack start/reset/migration/78+15/실제 JWT가 끝난 뒤 기존 runner를 순서대로 두 번 실행한다:

```sh
node inventory-management/qa/scripts/Run-IM2B1-local.mjs
INVENTORY_QA_TRANSPORT=electron-host node inventory-management/qa/scripts/Run-IM2B1-local.mjs
```

기존 테스트 4개가 각각 실제 PostgreSQL/Auth/REST/RPC에 연결된다. 두 번째는 새 Main-only factory+주입 wire를 사용하고, QA harness의 고정 loopback HTTP transport로 실제 DB를 호출한다. test scope의 host capability만 합성하며 SQL/Auth 응답을 Mock하지 않는다. **실제 Electron Main/Preload IPC/GUI 검증은 이 테스트로 대체하지 않는다.** 기존 default Browser 4개는 유지되며 환경 변수가 없으면 원래 경로다. fixture UUID는 매 실행 새로 생성한다.

그 후 typecheck/transport+Browser 회귀/production 검사/DB lint/security catalog/final invariant/stop을 유지한다. CI summary는 Browser real=4와 injected real=4를 분리해 기록하고 raw key/JWT/password/HTTP body를 업로드하지 않는다. Cloud A는 실제 Electron Main service에서도 동일한 합성 fixture에 typed IPC를 통해 로그인→학교선택→읽기→mutation→재조회→logout 및 mode 전환을 별도로 검증한다. Windows GUI는 후속이다.

## 이번 단계 판정

로컬 구현·독립 검사 완료 여부와 최종 commit SHA/집계는 완료 보고를 따른다. 새로운 실제 DB/IPC/Windows GUI는 **NOT RUN**이다. 기존 CI READY를 이번 transport의 READY로 확대하지 않으며, 실제 host 연결·DB 재검증 전까지 **CONDITIONAL**이다.


### 로컬 검증 기록

- 기존 Browser 집중 62 PASS 유지.
- 최종 Inventory 집중 164 PASS / 실제 DB 4 SKIP.
- 신규 transport/lifecycle 47개 및 실제 production/native Main 빌드·실행 검사 2개 PASS (집중 합계에 포함).
- TypeScript, 기존 root production build, 기존 production entry zero-network 검사 PASS. 기존 chunk-size 경고는 유지.
- 최종 전체 JS/UI 회귀 1,365 PASS / 실제 DB 4 SKIP. 신규 코드로 78개 DB/15개 구매 SQL/실제 Adapter 4개를 재실행하지 않았으며 CI 확장 절차를 위에 제공했다. 최종 로컬 SHA는 완료 보고에서 확정한다.
- 변경 범위·secret/PII 패턴 및 diff 공백 검사를 수행하며, 전체 DLP/과거 Git 이력 무결함을 뜻하지 않는다.
