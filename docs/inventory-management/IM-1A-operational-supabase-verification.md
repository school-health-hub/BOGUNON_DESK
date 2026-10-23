# IM-1A 운영 Supabase 검증

## 프로젝트 식별

| 근거 | 확인 결과 |
|---|---|
| BOGUNON `.env.local` URL | project ref `xxownwxxajzrviuvvfiu` |
| BOGUNON Supabase CLI link state | 동일 ref, branch `main` |
| DESK production config/CSP | 동일 ref |
| Vercel `bogunon` 프로젝트 | production/preview에 URL 및 publishable key 변수 존재 |
| Vercel 변수의 실제 URL 값 | API에서 비공개이므로 ref 직접 대조 불가 |
| 연결된 Supabase 계정 | 다른 ref의 프로젝트 1개만 조회됨 |

따라서 로컬 BOGUNON과 DESK가 같은 Supabase ref를 가리키는 것은 VERIFIED다. Vercel 운영 배포가 같은 값을 사용하는지는 PARTIALLY VERIFIED이며, Supabase 관리 계정 접근은 `ACCESS NOT VERIFIED`다.

프로젝트 endpoint의 Auth/REST 경로는 응답했으므로 endpoint가 존재하거나 접근 경계를 제공하는 것은 확인됐다. 로컬 publishable 자격으로 PostgREST OpenAPI metadata를 읽으려 했으나 401을 반환했다. 비밀키 갱신, 세션 확대, 서비스 역할 사용은 하지 않았다.

## 코드와 운영 DB 비교

| 객체 | 로컬 migration | 실제 운영 DB | 판정 |
|---|---|---|---|
| `medication_items` | 확인 | 메타데이터 접근 불가 | NOT VERIFIED |
| `medication_lots` | 확인 | 메타데이터 접근 불가 | NOT VERIFIED |
| `medication_purchase_plans` | 확인 | 메타데이터 접근 불가 | NOT VERIFIED |
| `medication_receipts` | 확인 | 메타데이터 접근 불가 | NOT VERIFIED |
| `medication_budgets` | 확인 | 메타데이터 접근 불가 | NOT VERIFIED |
| `receive_medication` | 확인 | 메타데이터 접근 불가 | NOT VERIFIED |
| RLS/정책/권한 | migration 확인 | 메타데이터 접근 불가 | NOT VERIFIED |
| PK/FK/UNIQUE/CHECK/index/trigger | migration 확인 | 메타데이터 접근 불가 | NOT VERIFIED |

코드의 migration 존재를 운영 적용의 증거로 사용하지 않는다. 업무 테이블의 행은 조회하지 않았다.

## 후속 읽기 전용 증거

프로젝트 소유자가 해당 ref를 현재 Supabase 연결에 추가하거나, schema-only metadata를 제공해야 한다. 필요한 최소 범위는 migration history, `pg_class`, `pg_attribute`, `pg_constraint`, `pg_indexes`, `pg_policies`, `pg_proc`, `information_schema.routine_privileges`의 SELECT다. 업무 행과 Auth 사용자 목록은 필요하지 않다.

