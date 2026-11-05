# A2 Hosted 실현 가능성 — BLOCKED 해소 근거 부족

결론: **현재 인계된 Hosted metadata만으로 A2 설치 가능/불가능을 확정할 수 없다.**
따라서 운영 적용 BLOCKED를 해소하지 않는다. 로컬 조건부 설치 성공을 Hosted 성공으로 확대하지 않는다.

## 검증된 사실과 추론 한계

| 인계된 Hosted READ-ONLY 사실 | 뒷받침하는 것 | 뒷받침하지 않는 것 |
|---|---|---|
| PostgreSQL17.6 | PG17 catalog/문법 검토 기준 | 이 배포 신원의 실제 DDL 실행권한 |
| users/sessions owner=Auth admin | A2가 사용할 읽기 신뢰 주체의 존재 | 다른 사용자가 그 역할이 되거나 그 소유 함수를 만들 수 있음 |
| Auth owner SELECT 있음 | 객체 수준 SELECT capability | FORCE RLS 하의 실제 행 가시성·함수 배포 지원 정책 |
| authenticated SELECT 없음 | 전달된 테이블 SELECT 제한 | 가능한 별도 column ACL까지 모두 없다는 새 검증 |
| ws_runtime / ws_authz_reader 없음 | 아직 새 역할 설치 전 | 역할 생성·SET·OWNER 배정이 허용됨 |
| postgres BYPASSRLS | 해당 역할에 row-policy 우회 속성이 있음 | SUPERUSER·Auth SET·schema/function OWNER 권한 |
| Workspace RPC 없음 | public 기능 미설치 | 모든 schema/호환 이름 충돌 부재·함수 생성 가능 |

이 값은 **사용자가 전달한 ChatGPT 조회 결과**다. Cloud C가 운영 프로젝트에서 직접 조회하지 않았다.
관측 시각이 별도로 제공되지 않아 현재 상태/변경 후 상태로 단정하지 않는다.

## 다음 추가 SELECT와 판정법

`sql/hosted-capabilities-readonly.sql`의 Q1~Q10을 **실제 배포에 사용할 실행 경로의 신원**에서 확인해야 한다.
별도 metadata 연결의 current_user가 배포자와 다르면 그 결과를 배포자 권한으로 대체하지 않는다.

| 쿼리 | 목적 | 결과의 의미 |
|---|---|---|
| Q1 | current_user/session_user/current_role, DB CREATE | 세 신원·실행 경로 확인. 기존 direct identity guard와 맞지 않으면 중단 |
| Q2~Q4 | Auth/Workspace 역할 MEMBER, inherited USAGE, SET 및 membership options | Auth owner SET=false면 그 신원으로 현재 A2 경로 불가. MEMBER=true라도 SET=false일 수 있음 |
| Q5 | Auth owner/RLS/FORCE·table/column ACL | SELECT true와 행 가시성은 구분. Workspace raw read0 검증 |
| Q6 | sessions→users FK·삭제 동작 | 계정 삭제와 세션 정리의 실제 제약 확인. API signOut 성공 증거는 아님 |
| Q7 | schema/함수 이름·소유권·설정·ACL | 충돌과 기본 권한 체크. 향후 생성 성공 증거는 아님 |
| Q8 | Auth owner의 비Auth schema 개체 목록 | 서비스 지원 정책 확인에 참고. 기존 개체 존재가 새 설치 허가는 아님 |
| Q9 | 함수 default ACL | PUBLIC 외 기본 EXECUTE도 같은 transaction에서 제거해야 함 |
| Q10 | 안전한 pgrst 설정 projection | actual Hosted gateway/Data API 설정은 별도 READ-ONLY 확인 필요 |

필요 조건이 모두 true여도 Managed 서비스의 DDL guard·Auth role 관리/업그레이드 정책이 새 Auth-owned 함수 위임을
허용하는지까지 증명하지 않는다. 서비스 제공자/운영자의 문서화된 지원 여부와 별도 승인된 설치 시험이 필요하다.
현재 해당 지원 증거는 NOT VERIFIED다. 이번에는 DDL을 실행해 시험하지 않는다.

## 유지보수 위험

- Auth 내부 table/column·session 생성/삭제/timeout 의미가 실제 서비스 버전에 의존한다.
- Auth schema 밖에 두더라도 소유자가 managed Auth role이므로 역할/복원/권한 관리 정책의 영향을 받는다.
- SQL 함수의 문자열 body는 모든 의존성을 pg_depend에 남기지 않는다. 업그레이드 호환성을 catalog dependency만으로 보장하지 않는다.
- Auth owner는 기존의 높은 권한을 가진다. 함수 변조 시 위험을 줄이려면 private schema·무인자 boolean·고정 search_path·동적SQL 금지·정의 hash·최소 EXECUTE를 유지해야 한다.
- Auth owner에게 Workspace content 권한을 추가하지 않는다. 앱/Renderer/BFF 일반 요청에는 Auth owner SET나 service_role을 부여하지 않는다.
- 미지원이면 실패를 숨기거나 JWT-only로 대체하지 않고 Workspace를 CLOSED로 유지한다. 개인 DESK 로컬 기능은 기존 분리 계약을 유지한다.

## 세션·PostgREST 검증 수준

로컬에서는 같은 UID의 서로 다른 session_id 두 개를 만들어 하나를 지웠을 때 그 세션만 거부되는 것을 확인한다.
이는 사용자 존재만 확인하는 구현과 구별되지만, **실제 Hosted 로그아웃 즉시 회수 PASS는 아니다**.
Hosted signOut scope/제거 시점, JWT 만료·회수, 사용자 삭제·FK, 관리형 timeout 정리 지연, 7일/최근10분 조건은 별도 검증이다.
Google 계정 선택과 강한 재인증은 동의어가 아니다. 최근 생성시각 조건을 MFA/재직 증거로 쓰지 않는다.

public54 INVOKER→private purpose→reader→Auth boolean 경계와 서버 live membership/epoch는 유지한다.
authenticated는 bridge EXECUTE나 schema CREATE를 갖지 않는다. Data API schema·실제 JWT/Gateway·schema cache·실제 RPC는 이번 NOT RUN이다.
이전 23개 로컬 PostgREST도 synthetic Auth/HS256 환경의 a16245d 증거로만 보존한다.

현재 Hosted에는 Workspace 역할이 아직 없으므로 기존09C patch의 기반도 설치되지 않았다.
로컬 profile은 미래의 승인된 foundation 이후 권한 조합을 비교하는 실험이며 현재 Hosted 역할의 복제본이 아니다.
새 역할 생성·membership/OWNER·Auth checker를 포함한 fresh 설치가 가능한지는 여전히 별도 검증 대상이다.

Q1의 current_user/session_user 불일치는 서비스 경로의 정상적인 role 전환일 수도 있다. 그 자체를 침해라고 단정하지 않는다.
다만 현재 LOCAL 후보의 direct identity guard와 맞지 않으므로 그 경로에는 그대로 적용할 수 없다.
09D에서 실제 승인된 신원 쌍·role 경로를 검토해야 하며, guard를 지우거나 GUC만 바꿔 운영에 실행하지 않는다.
