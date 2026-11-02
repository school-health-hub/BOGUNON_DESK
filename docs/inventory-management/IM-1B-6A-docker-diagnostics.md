# IM-1B-6A Docker 진단

## 확인된 사실

- Docker Desktop 4.92.0 / Engine 29.8.0은 진단 시작 시 응답했다.
- `inventory_qa` 컨테이너와 네트워크는 없었지만 `supabase_db_inventory_qa`, `supabase_edge_runtime_inventory_qa`, `supabase_storage_inventory_qa` 볼륨은 프로젝트 라벨과 함께 보존되어 있었다.
- 56320–56327 포트에는 시작 전 listener가 없었다.
- 기존 `bogunon` DB/Auth/Kong 등은 실행 상태였으며 변경하지 않았다.
- Docker Desktop 로그에는 이전 Inventory start가 진행되는 동안 DB 컨테이너와 볼륨 cleanup이 겹친 흔적이 있었다. start/reset/cleanup 경쟁 상태가 부분 스택을 만든 가장 강한 증거다.
- 첫 전체 스택 시작에서는 DB/Auth/Kong이 정상화됐으나 Analytics, Vector, Storage, pg-meta, Studio가 오래 unhealthy 상태였고 Realtime은 system memory high-watermark를 기록했다.
- 호스트 C: 여유 공간은 약 9.09 GiB(약 2%), 물리 메모리 여유는 약 1.36 GiB(약 8.6%)였다. 리소스 압박은 전체 스택 지연의 기여 요인이다.

## 반박되거나 미확인인 원인

- 시작 전 포트 충돌은 관찰되지 않았다.
- clean reset에서 모든 Inventory migration이 정상 적용됐으므로 migration 실패는 재현되지 않았다.
- DB는 첫 시도 중 실제로 연결 수락 상태까지 도달했다. PostgreSQL 자체 초기화 실패가 지속 원인은 아니었다.
- 첫 시도 종료의 exit 137은 명시적 중단 후 프로젝트 cleanup과 시간상 일치하며 `OOMKilled=false`였다. OOM kill로 단정하지 않는다.

## 보안 주의

진단 출력에 로컬 개발 자격증명이 포함될 수 있어 원문 로그를 파일이나 문서에 저장하지 않았다. 이 문서에는 값이 아닌 구성 이름과 결과만 남겼다.
