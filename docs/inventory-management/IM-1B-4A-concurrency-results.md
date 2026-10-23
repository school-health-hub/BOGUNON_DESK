# IM-1B-4A 혼합 동시성

독립 PostgreSQL 세션으로 입고+사용, 폐기+사용, 정정+사용, 취소+사용, 입고+입고, 폐기+폐기, 정정+정정, 취소+취소의 8쌍을 실제 경쟁시켰다. 초과 차감·lost update·중복 취소 없이 완료했고 관찰된 deadlock은 0건이다. runner: `Invoke-IM1B4AConcurrency.ps1`.

