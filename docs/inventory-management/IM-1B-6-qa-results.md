# IM-1B-6 QA 결과

## Adapter 행동 QA

`src/inventory-management/purchaseHelperAdapter.test.ts`의 합성 시나리오는 다음을 검증한다.

1. Inventory batch의 Helper DTO 변환
2. 구매수량·단가·금액 입력 정합성
3. 구매단위와 기본단위의 정확한 변환
4. 동일 품명·상이한 item ID 구분
5. 구매 line ID sidecar 보존
6. 행 재정렬 후 매핑 유지
7. 행 삭제 감지
8. 신규 행의 검토 필요 판정
9. 잘못된 수량·단가 거부
10. 분수 기본단위와 모호한 변환 거부
11. Adapter stock effect `NONE`
12. receipt 명령 미노출
13. 부분입고 누적 metadata 보존
14. 서버 snapshot 기반 결정적 재투영
15. 실패 시 원본 객체 불변
16. 학교 간 매핑 차단
17. 미구현 session 복구 범위 표시
18. CSV formula/control 문자열 차단

명령:

```powershell
npx vitest run src/inventory-management/purchaseHelperAdapter.test.ts
npx tsc --noEmit
```

최종 실행 수와 DB 회귀 결과는 `IM-1B-6-summary.md`에 기록한다.

실행 결과: Adapter 21/21 PASS, TypeScript typecheck PASS. 정밀도 경계(half-ULP), line별 school 누락·불일치, C0/DEL 및 선행 공백 수식 문자열, 40+30 누적 입고 snapshot 왕복을 포함한다. 기존 DB 회귀는 로컬 QA DB unhealthy로 이번 실행에서 수행하지 못했으며 PENDING으로 유지한다.

## 계약 상태

실제 왕복 행동 QA가 통과한 경우 `INV-P01`만 PASS로 전환한다. 구매 취소와 재고 reversal 분리 정책인 `INV-P05`는 PENDING으로 유지한다.

## 보안 경계

- 실제 학교명·품목·수량·사용자 사용 없음
- 운영 Supabase 연결 없음
- Purchase Helper worktree 변경 없음
- Adapter에서 Supabase, lot, movement, audit, receipt mutation import 없음
- Formula/control 문자열은 자동 반영하지 않음
