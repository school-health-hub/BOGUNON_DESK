# IM-1B-6A 복구 결과

## 수행한 조치

1. Git, Docker, 포트, 볼륨 라벨과 프로젝트 ID `inventory_qa`를 읽기 전용으로 확인했다.
2. 기존 래퍼로 전체 스택 start를 1회 시도했다. DB는 healthy가 됐지만 비필수 서비스 health 대기가 장기화돼 중단했고 CLI가 Inventory 스택만 정리하도록 했다.
3. 두 번째이자 마지막 복구 방식으로 DB, Auth, REST, Kong만 남기고 Realtime, Storage, Image Proxy, Mailpit, pg-meta, Studio, Edge Runtime, Analytics/Logflare, Vector, Supavisor를 제외한 최소 스택을 시작했다.
4. 최소 스택에서 DB `pg_isready`, Auth health, REST endpoint가 모두 정상임을 확인했다.
5. 프로젝트 라벨과 전용 볼륨 격리를 확인한 뒤 승인된 local clean reset을 1회 수행했다.

## 결과

- Supabase CLI: 2.121.0
- DB/Auth/Kong: healthy
- Auth/REST HTTP health: 200
- migration 6개 순차 적용: PASS
- 운영 프로젝트 link: 없음
- 운영 ref 또는 운영 자격증명 사용: 0건
- 기존 Inventory 볼륨 삭제: 0건

최소 스택은 이번 DB/RLS/RPC/JWT 검증에 필요한 서비스만 제공한다. Studio, Storage, Realtime 등 제외 서비스의 기능 검증을 의미하지 않는다.
