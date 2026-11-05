# 자율 수정 및 재검증

| 결함/제약 | 재현·원인 | 실질적 수정 시도 | 결과 |
|---|---|---:|---|
| CLI 기본 상태 경로 쓰기 실패 | readonly HOME에 CLI 상태 작성 | 1: 지원되는 SUPABASE_HOME을 작업 디렉터리로 지정 | CLI3.0.0 migration new 성공. HOME/권한 정책 변경 없음 |
| 신규 ACL 정리 DO block 실패 | PL/pgSQL record 변수 a가 pg_attribute SQL alias a를 가림 | 1: ACL loop record를 acl_item으로 분리 | 빈 DB 신규 설치·재실행·전체 회귀 PASS. 원래 실패 로그 evidence/attempts/record-alias.log |
| public 보존 비교 불일치 | jsonb_agg에 정렬이 없어 카탈로그 물리 조회 순서 변화가 거짓 차이 생성 | 1: 관계/Auth 정렬키 고정, 차이 진단을 JSON으로 개선 | 동일 보호 대상 정의/ACL/개인 행 실제 비교 통과. 보존 항목 제거 없음 |
| 루트 build 타입 오류 | 기준 통합에서도 동일13개 | 0: 범위 밖 수정 안 함 | 기준/후보 오류목록 완전 동일, 신규0 |
| Electron/확장 strict xlsx 없음 | 기존 재사용 cache에 기준 lock의 SheetJS 미설치; 공식 CDN HTTP403 | 1: 정확한 공식 locked URL 접근 확인 | 환경 의존성 BLOCKED. 버전 대체/권한 우회/제품 수정 없음. 기준 Electron도 같은 import 실패 |

설치 사양에는 기능 의미 변경 없이 체크섬/구조 지문, 충돌 거부, RPC 기본 CLOSED, 별도 공개/비파괴 차단, default 함수 ACL 최소화, Auth 최소권한 전제 확인을 추가했다. 원본 SQL5개와 제품 코드에는 수정이 없다. 같은 명령을 근거 없이 세 번 반복해서 성공으로 취급하지 않았다.

첫 전체 회귀 후 카탈로그 inventory 증거 수집과 결과 LOCAL POSTGREST 분류를 추가해 빈 DB부터 다시 실행했다. 반복 실행 횟수는 고유 시나리오 수에 합산하지 않는다. 불변조건34/기존 회귀/새 설치·REST 검증은 별도 표로 보고한다.
