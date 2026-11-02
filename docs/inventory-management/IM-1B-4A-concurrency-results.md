# IM-1B-4A 혼합 동시성

2026-11-02에 독립 PostgreSQL 세션으로 입고+사용, 폐기+사용, 정정+사용, 취소+사용, 입고+입고, 폐기+폐기, 정정+정정, 취소+취소의 8쌍을 실제 경쟁시켰다. 각 조합은 허용된 성공/거부 수, 최종 잔량, movement 수, audit 수를 assertion으로 확인했다. 초과 차감·lost update·중복 취소 없이 8/8 PASS였고 관찰된 deadlock은 0건이다.

초기 재실행에서 취소+취소의 패배 요청이 반환한 계약 오류 `ALREADY_REVERSED`와 runner의 예상 문자열이 달라 중단됐다. migration과 기존 B4 회귀의 PT409 계약을 대조해 runner의 오류명만 수정한 뒤 clean reset부터 다시 실행해 PASS를 확인했다. runner: `inventory-management/qa/scripts/Invoke-IM1B4AConcurrency.ps1`.

