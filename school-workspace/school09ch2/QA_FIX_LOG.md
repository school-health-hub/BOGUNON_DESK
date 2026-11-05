# H2 자율 QA·수정 기록

| 결함/개선 | 원인·재현 | 최소 수정·검증 | 실질 수정 |
|---|---|---|---:|
| provider guard에서 private namespace42501 | Auth-side principal에게 Workspace namespace USAGE를 주지 않았는데 to_regprocedure(text)로 private 함수를 조회 | pg_proc/namespace/OID 기반 signature 비교로 바꿈. 불필요 USAGE를 부여하지 않음 | 1 |
| 생성 SQL bool 토큰 붙음 | 강화한 preflight에서 falseAND가 한 토큰이 됨 | boolean 뒤 공백을 명시, 전체 새SQL 재검증 | 1 |
| 변경된 함수/RLS 설정 채택 위험 | 본문만 비교하면 flags/설정 변경을 정상 baseline으로 채택할 수 있음 | 기존 full definition marker+SHA/owner/설정/반환/역할·FORCE RLS 확인, 변조 부정 테스트 | 1 |

오류를 발견해도 중간 승인 없이 원인을 분석하고 수정·재검증했다. 같은 결함3회 상한 이내다.
attempt*.log는 실패 증거이며 PASS에 포함하지 않는다. 마지막 결과는 LOCAL DB23/HTTP15/MOCK1, FAIL0이다.
같은 목표에 대한 검사 반복 횟수를 고유 시나리오로 합산하지 않는다.
기존177/23/26 스위트는 SHA·원본 해시로 재사용하고 반복하지 않았다.

새 설치 규약에는 비슈퍼·비BYPASS·NOINHERIT 실제 LOGIN 두 개를 사용했다.
Auth-side/Workspace-side 서로의 역할로 SET할 수 없음을 확인했고, 활성화/폐쇄도 실제 function owner로 수행했다.
provider/중간 CREATE/최종 binding 실패 rollback·resume/no-op·drift 폐쇄를 검증했다.
API는 실제 local PostgREST13.0.4 + 합성HS256/Auth다. Hosted/OAuth/Windows가 아니다.

추가 강화: client의 privileged role membership 사전 거부, helper에 남은 예기치 않은 EXECUTE 제거, PostgREST 시작 실패 시 서명재료 예외출력 차단을 구현·검증했다. 각각 실질 수정1회.
