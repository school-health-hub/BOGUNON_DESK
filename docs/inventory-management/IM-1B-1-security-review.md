# IM-1B-1 보안 검토

## 검증 결과

- 신규 table: 4개
- RLS enabled/forced: 4/4
- policy: 6개
- PK/FK/UNIQUE/CHECK constraint: 22개
- anon item SELECT privilege: false
- authenticated item SELECT privilege: true
- authenticated lot UPDATE privilege: false
- authenticated membership UPDATE privilege: false
- `medication_*` local table 생성·변경: 0개

anonymous key 값은 출력·저장하지 않고 CLI의 local status를 메모리에서만 읽어 Data API 요청에 사용했다. `GET /rest/v1/inventory_items`는 HTTP 401로 거부됐다.

## 위협별 결과

| 위협 | 방어 | 결과 |
|---|---|---|
| 임의 school ID | active membership helper + RLS | PASS |
| 타학교 item/lot | RLS + composite FK | PASS |
| instructor 관리자 쓰기 | column GRANT + role RLS | PASS |
| membership 권한 상승 | client DML 권한 없음 | PASS |
| 비활성 membership | 매 요청 DB 조회 | PASS |
| user metadata 위조 | metadata 미사용 | PASS |
| anon/PUBLIC helper 호출 | EXECUTE 회수 | PASS |

## 제한

Windows local Docker는 서비스를 `0.0.0.0`에 publish한다. 검증 후 `inventory_qa` stack만 중지한다. 운영 project 접근, 실제 JWT E2E, 운영 Data API 설정, backup/PITR은 확인하지 않았다.

clean reset 후 부가 Storage service가 일시적으로 unhealthy였으나 DB/RLS/Data API 검증에는 영향을 주지 않았다. Storage 기능은 이번 범위에서 PASS로 판정하지 않는다.

