# IM-1B-4A JWT HTTP E2E

2026-11-02에 `Invoke-IM1B4AHttpE2E.ps1`을 clean reset된 로컬 Auth와 REST Data API에 실행했다. 입고·폐기·정정·취소·사용 정상 호출, 입고 replay snapshot 안정성, 동일 UUID의 다른 payload 충돌, 직접 lot DML 차단, instructor·비활성 membership·타학교·anon 차단 및 5개 RPC 공통 DTO를 확인했다. 결과 PASS. JWT와 로컬 키는 메모리에서만 사용하고 출력·저장하지 않았다.

