# IM-1B-4A 재시도 정책

재고 부족, 권한 거부, 멱등 충돌은 재시도하지 않는다. stale 정정은 최신 상태 재조회 후 사용자 의도로 새 요청한다. SQLSTATE `40P01` deadlock 및 `40001` serialization failure만 클라이언트의 유한 재시도 후보이며 동일 논리 요청 UUID를 유지하고 지수 backoff와 jitter를 적용한다. 클라이언트가 아직 없으므로 실제 자동 재시도 구현 완료를 주장하지 않는다.

