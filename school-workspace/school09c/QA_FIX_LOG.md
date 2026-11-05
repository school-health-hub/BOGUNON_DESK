# 자율 수정 기록

| 결함 | 원인/재현 | 최소 수정 | 실질 시도 |
|---|---|---|---:|
| 새 계정 bootstrap fixture가 invalid_target | fixture가 account UUID를 고정값으로 가정했으나 ws_v1_bootstrap은 서버 UUID를 생성 | 실제 Auth UUID→account 조회값으로 테스트 연결 | 1 |
| operator receipt replay 실패 | PL/pgSQL 함수이름.command 로 local payload를 수식한 것이 FROM relation으로 해석됨 | 로컬 변수 payload_value로 명확화, command/JSON 비교 계약 유지 | 1 |
| creator default ACL의 추가 실행역할 | 실험 bootstrap 함수 생성자가 postgres라 simulated_default_client EXECUTE 상속 가능 | owner 이외 모든 초기 EXECUTE 제거, Auth bridge는 owner/reader만 허용. 카탈로그 부정 검사 추가 | 1 |
| CLI 기본 설정 경로 읽기전용 | HOME 아래 설정 디렉터리 생성 실패 | 지원되는 command-scoped SUPABASE_HOME을 독립 경로로 지정; HOME 변경 없음 | 1 |

최초2개 실패 로그는 evidence/attempt*.log에 남겼다. 실패를 PASS로 세지 않는다.
RLS/역할 상한/즉시회수 의미는 변경하지 않았다. 원본 migration·제품 파일·기존 운영 DEFINER 변경0.
Auth private interface 교체는 사용자가 요청한 격리 설계 실험이며 실제 운영에 적용하지 않았다.
최종 source SQL(지문 guard/ACL 정리/실패 rollback 포함)을 대상으로 full S01~04 회귀를 재실행한다.

bootstrap의 NULL expected_version을 별도 재현했다. SQL의 `ev<>0` 비교는 NULL에서 true가 되지 않아
필수 버전 검사를 통과할 수 있었다. `ev IS NULL OR ev<0`를 먼저 거부하도록 최소 수정했고
새 부정 테스트로 재검증한다(이 결함 수정1회). 실패 증거는 version-reproduce.log다.
Auth 함수/기존54 RPC는 이 수정의 영향이 없어 동일 SQL의 S01~04 회귀99를 재사용하고,
bootstrap·Auth 경계·Inventory31·실제 PostgREST23을 다시 실행한다.

카탈로그 export의 policy 필터가 기존 두 Workspace schema만 포함해 bootstrap-control의4정책을 빠뜨린 것을 수정했다.
기존 active snapshot은 workspace-scope로 이름을 명시했고, 별도 fresh CLOSED export에서 전체4schema
92정책/159함수/36table/54 CLOSED를 검증했다(메타데이터 범위 수정1회). 사업 SQL/권한은 변경하지 않았다.

별도 catalog exporter가 PG 시작을 기다리다 실패했다. 첫 가설로 stdout/stderr를 합쳐 진단한 뒤,
실제 로그에서 Python subprocess 인수에 shell용 따옴표가 전달되어 listen_addresses가 잘못된 것을 확인했다.
`listen_addresses=`로 수정했다(서로 다른 수정2회, 총실행3회 상한 이내).
네트워크 none/미공개 포트 설정은 유지했고 운영 접속으로 우회하지 않았다.
