# A2가 지원되지 않을 때의 대안과 변경 영향

이번에 대안을 운영 권한으로 자동 채택하지 않는다. 현재 보안 의미를 유지하는 지원 경로가 확인되지 않으면 BLOCKED를 유지한다.

| 대안 | 필요한 검증·권한 | 기존 코드 영향 | 즉시 회수·불변조건 판단 |
|---|---|---|---|
| 서비스 제공자가 승인한 Auth-owner 별도 설치 | 서비스 측 승인된 설치 신원·custom owner 지원 정책, bridge 선행 설치/권한 증거 | public54 유지 가능, Auth 단계와 Workspace 단계 설치 계약/실패 복구 재정의 | 실제 지원 경로 존재 여부 미확인. 일반 배포자에게 Auth owner SET를 새로 주는 우회 아님 |
| 서비스 제공자가 지원하는 제한 session-live 검증 primitive | Auth 서비스가 특정 UID/session_id의 현재 유효성을 보장하고 제한 호출을 지원한다는 계약 | reader 내부 verifier 교체, public54 유지 가능 | 실제 지원 기능이 확인되지 않았음. 존재하지 않는 API/함수를 만들어 쓰지 않음 |
| Trusted 서버의 매 요청 session 검증 + 목적별 DB gateway | 현재 세션을 검증하는 공식 Auth API의 실제 버전/동작, 비슈퍼·비BYPASS gateway 역할, 서버 저장소/키관리/운영 | Electron/Web transport, 공개 EXECUTE 역할/서버 전용 진입점, session helper와 freshness proof 변경 | getUser/JWT 서명 검증만으로 회수 보장을 단정하지 않음. 같은 UID의2세션+signOut 시험 필수 |
| 별도 제한 검증 계층 | 제공자가 허용한 세션 상태 관측 경로·좁은 boolean 인터페이스·분리된 운영 책임 | 새로운 adapter/검증 계약, raw table 비공개·live 멤버십 유지 | 새 역할 이름만 바꿔 Auth SELECT 금지를 회피하지 않음. 원시 열 SELECT가 필요하면 현재 계약 변경 승인 필요 |
| Workspace 자체 revocation ledger만 사용 | 앱에서 발생하는 logout/정지 기록 | 비교적 작음 | 다른 Auth client의 로그아웃/전역회수를 알 수 없어 단독 대체로 채택 불가 |
| JWT expiry까지 허용/짧은 캐시/TTL proof 재사용 | 설정 변경 | 작을 수 있음 | 현재 요구하는 다음 요청 회수 의미를 약화하므로 자동 채택 금지 |

## Trusted 서버 대안의 우회 방지

BFF가 검증한 뒤 동일 user JWT로 공개 RPC를 호출하는 것만으로는 클라이언트의 직접 Data API 호출을 막지 못한다.
이를 선택하려면 목적별 함수의 실행권한/서버 전용 gateway 경계를 함께 설계해야 한다.
일반 요청을 service_role로 실행하거나 authenticated에 원시 table DML을 주는 대안은 제외한다.

서버가 받은 UID/session_id·목적 명령·payload/request_id를 매 요청 검증에 묶고, nonce/세대/취소를 강제해야 한다.
필요하다면 public54 서명은 유지하더라도 실제 호출자 권한과 transport 계약은 달라진다.
사용자가 설정할 수 있는 header/GUC·user_metadata를 서버 검증 증거로 신뢰하면 안 된다.
짧은 유효기간 서명 proof도 logout 전에 발급된 것을 재사용하면 즉시 회수를 보장하지 못한다.
이미 진행 중인 요청과 새로운 요청의 경계를 분명히 하고, 세션 상태 확인 결과를 캐시로 대체하지 않는다.

공식 getUser 등의 endpoint가 현재 Hosted에서 session_id 삭제까지 확인하는지는 별도 검증이 필요하다.
확인 없이 ‘항상 확인한다’ 또는 ‘절대 확인하지 않는다’로 단정하지 않는다.
Auth 내부 역할 위임이 불가능하면 이 지원 가능한 API 경로를 먼저 실증하되, 이번에는 운영 호출하지 않는다.

## 대안 승인 후 필요한 검증 범위

- Electron Main/Preload token 경계와 Web BFF HttpOnly/CSRF/Origin/refresh/CAS·분산 세션.
- 동일 UID 다중세션, 개별/전역 logout, 사용자 삭제, expiry/refresh·외부 client 회수.
- 클라이언트 직접 RPC/조작 role/header/proof replay/명령변조 거부, 서버 장애 시 fail closed.
- 기존54 목적별 계약, live school membership/epoch/권한 회수·동시성·멱등성/감사.
- 기존177 DB·23 로컬 API의 영향받는 범위와 실제 Hosted 부정 시험, Windows 영향 QA.

이 영향은 현재 A2의 작은 설치 문맥 수정과 다르다. 별도 인증·권한 계약 승인 없이 구현하거나 활성화하지 않는다.
