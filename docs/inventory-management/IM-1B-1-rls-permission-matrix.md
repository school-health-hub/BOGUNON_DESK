# IM-1B-1 RLS·권한 매트릭스

모든 신규 테이블은 RLS와 FORCE RLS가 활성화됐다. 권한 판정은 `auth.uid()`와 DB의 활성 membership만 사용하며 JWT user metadata를 사용하지 않는다.

## 정책

| 테이블 | 정책 | 역할 | 허용 범위 |
|---|---|---|---|
| schools | `inventory_schools_select_active_member` | authenticated | 활성 membership 학교 SELECT |
| members | `inventory_members_select_self_or_school_admin` | authenticated | 본인 활성 membership 또는 해당 학교 teacher_admin SELECT |
| items | `inventory_items_select_active_member` | authenticated | 활성 membership 학교 SELECT |
| items | `inventory_items_insert_teacher_admin` | authenticated | teacher_admin 학교의 허용 컬럼 INSERT |
| items | `inventory_items_update_teacher_admin` | authenticated | teacher_admin 학교의 허용 컬럼 UPDATE |
| lots | `inventory_stock_lots_select_active_member` | authenticated | 활성 membership 학교 SELECT |

## 직접 권한

- `anon`: 신규 네 테이블의 모든 권한 없음
- `authenticated`: 네 테이블 SELECT
- `authenticated`: items의 업무 컬럼만 INSERT/UPDATE
- item ID, school ID, created/updated timestamps는 직접 UPDATE 불가
- members와 lots는 authenticated INSERT/UPDATE/DELETE 없음
- 모든 테이블 DELETE 없음

membership 관리와 lot 수량 변경은 후속 안전한 RPC가 생기기 전까지 client에서 전면 차단한다.

## 재귀 방지 helper

`inventory_private.inventory_has_active_membership(uuid,text)`는 membership 정책의 자기 참조 재귀를 피하기 위한 최소 `SECURITY DEFINER` helper다.

- schema: Data API 비노출 전용 `inventory_private`
- `search_path = ''`
- caller의 `(select auth.uid())` 필수
- 활성 school과 활성 membership을 매 호출 확인
- PUBLIC/anon EXECUTE 회수
- authenticated만 명시적 EXECUTE

helper는 테이블 데이터를 반환하지 않고 요청 school의 현재 caller membership 여부만 반환한다.

