# IM-1A 요약

## 결론

최종 권고는 **혼합형**이다. 기존 품목·구매계획·입고 UI와 Purchase Helper의 파서/검산/출력을 재사용하되, 학교별 공유 재고의 권위 원장은 신규 membership, lot balance, immutable movement, idempotency request, audit, purchase link 영역으로 구성한다.

기존 medication 스키마는 개인 소유형이며 일반 authenticated 사용자가 자신의 재고 행을 직접 수정·삭제할 수 있다. 현 구조를 그대로 공유 재고로 확장하면 역할 통제와 원장 무결성이 깨진다.

## 핵심 확인 사실

- 품목, lot, 구매계획, 입고, 부분입고 상태, 예산이 SQL/코드로 구현됐다.
- 총재고는 저장하지 않고 클라이언트가 lot 수량을 합산한다.
- 사용 차감, movement/audit, 학교 membership은 없다.
- 기존 입고 RPC는 트랜잭션·소유권·plan 잠금은 갖췄지만 idempotency payload 충돌 검사가 없다.
- 만료 lot도 기존 currentStock에 합산된다.
- NEIS 학교정보는 개인 user settings이며 tenant 권위가 아니다.
- Purchase Helper는 import/edit/검산/export를 재사용할 수 있으나 Inventory ID·독립 unit·세션 복원이 없다.
- DESK는 publishable key만 허용하도록 방어하며 관리자 비밀키를 bundle에 넣지 않는 구조다.

## 프로젝트/백업 한계

DESK 코드가 가리키는 Supabase project ref는 식별했으나 연결 계정에서 접근 가능한 프로젝트 목록에 없었다. 무관할 수 있는 다른 프로젝트는 조회하지 않았다. 실제 schema 적용, 환경 분리, 운영 데이터, plan, backup, PITR은 `NOT VERIFIED`다.

## IM-1B 전 필수 게이트

1. 실제 프로젝트 읽기 권한으로 schema/policy/function/backup metadata 확인
2. 혼합형 및 school membership/role 계약 승인
3. 강사 이력 범위와 단위·만료 정책 승인
4. 권위 원본과 전환 기준시각 확정 또는 별도 migration gate 승인
5. 복원 가능한 백업과 담당자·절차 확인
6. 합성 Supabase 환경에서 RLS/RPC 계약 테스트 계획 승인
7. 사용자 명시적 IM-1B 승인

## 최종 판정

**CONDITIONAL**. 설계 근거는 충분하지만 운영 DB와 백업의 실제 상태, 권위 원본 및 업무 정책 승인이 남아 있다. 제품 코드·DB·기존 worktree는 변경하지 않았고 commit/push/PR도 수행하지 않았다.

