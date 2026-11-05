# 해결한 기술 경계와 남은 외부 조건

## 실제 구현한 안전한 다른 경로

이전 경로는 단일 installer가 Auth owner와 Workspace owner 양쪽으로 SET할 수 있어야 했다.
H2는 Auth-side transaction과 Workspace-side transaction을 분리한다.
Workspace installer는 Auth owner로 SET할 수 없어도 helper를 연결하고 owner-aware 활성화·폐쇄를 수행한다.
Auth-side installer도 Workspace owner/reader로 SET할 필요가 없다. 두 LOGIN 모두 로컬에서 NOSUPERUSER/NOBYPASSRLS/NOINHERIT로 시험한다.

Runtime의 신뢰 경계는 A2 그대로다. 기존4본문의 SHA-256을 보존하고 public54의 서명·본문·소유자를 바꾸지 않는다.
변경한 것은 설치 권한/의존성·실패 복구·새 release lifecycle이며 인증/학교 정책을 약화하지 않는다.

- Auth provider 단계 실패: transaction rollback, schema/새 권한 없음, public54 CLOSED 유지.
- provider 성공 후 binding 실패: bridge만 남고 Workspace helper/임시 CREATE/ledger 변경 rollback. 모든 RPC CLOSED.
- binding 재시도: 동일 provider hash/OWNER/ACL·기존 function body/설정/RLS/역할을 검사한 뒤 진행.
- complete replay: release version·metadata fingerprint 검증 후 no-op. 기존 S08 장부는 재기록하지 않음.
- 활성화: 각 public/private 함수의 실제 owner role로만 GRANT. Workspace installer의 Auth SET 불필요.
- 폐쇄: 데이터 삭제 없이54쌍 REVOKE. 정상 지문은 closed, 변조는 closed_unverified. drift를 정상으로 자동 채택하지 않음.

임시 reader CREATE는 동일 미커밋 transaction 안에서만 부여·회수하고 실패 시 rollback한다.
PUBLIC/anon·불필요 default EXECUTE는 생성 transaction 안에서 차단한다.
metadata 지문은 drift 탐지용이며 보안 서명 대용이 아니다. 파일 무결성은 SHA-256 manifest로 보장한다.

## 중요한 설치 범위

H2는 **검토된 CLOSED core 위의 A2 layer**다. 테스트 base 준비는 이전 S08/local fixture를 사용한다.
기존 base installer의 Auth4열 prerequisite는 로컬 legacy fixture에만 제공하고 provider 단계에서 철회한다.
H2 scripts는 그 SELECT를 새로 GRANT하지 않는다. 성공 후 Workspace/client의 auth.sessions 원문 SELECT는0이다.
처음부터 원시 Auth grant 없이 전체 fresh core를 설치했다는 주장은 하지 않는다.

운영 Workspace roles/RPC가 아직 없으므로 실제 배포는 이 네 파일을 바로 적용하는 것으로 끝나지 않는다.
09D에서 승인된 foundation/Auth FK·helper EXECUTE·새 A2 capability checker/fresh core 조합과 누적 fingerprint를 검증해야 한다.
이를 해결하려고 old4열 SELECT를 운영에 먼저 주거나 S08 ledger를 덮어쓰지 않는다.
이 선행조건과 Auth-side 지원이 확인되기 전 production eligible=false를 유지한다.

## 대안 판단

1. **Trusted BFF**: 특정 session_id의 live 상태를 매 요청 확인하고 직접 RPC 우회를 막는 gateway까지 있어야 한다.
   동일UID의 다른 세션이 살아 있는 것만 확인하는 방식은 폐기한 세션을 구별하지 못한다.
   이번 실제 HTTP 시험은 UID가 계속 존재하는데도 폐기한 세션만 거부되는 것을 확인했다.
   이 반례를 actual getUser의 동작이라고 주장하지 않는다. Hosted 공식 endpoint의 정확한 의미는 NOT VERIFIED다.
2. **별도 제한 verifier 계층**: 지원되는 Auth 상태 관측 경로가 먼저 확인돼야 한다.
   새 역할 이름을 붙여 Auth 원문 SELECT 금지를 우회하거나 service_role 요청으로 전환하지 않는다.
3. **공식 지원 Auth/세션 경로**: User sessions 문서는 session_id와 Auth session을 설명하지만,
   custom Auth-owned function의 설치/위임을 서비스가 지원한다는 승인 증거는 아니다.
   지원되는 provider-side 설치 경로가 있으면 H2 분리를 적용할 수 있다. 그 존재를 로컬 success로 대신 증명하지 않는다.

따라서 runtime 정책이 달라지는 BFF/gateway 대안은 분석 대상으로만 남기고 운영 설치 목록에 넣지 않았다.
JWT-only·캐시 TTL·현재 사용자 존재 확인만으로 회수 검사를 대체하지 않는다.

## 외부 확인 및 승인

- ChatGPT가 Q1~Q10 및 H2 추가 SELECT를 각 승인된 실행 경로에서 READ-ONLY 확인.
- Workspace deploy principal의 ws_owner/runtime/reader SET와 역할/스키마/FK 준비 권한.
- 별도 Auth-side principal이 custom private 함수를 Auth owner로 만들고 위임할 수 있는지, Managed 업그레이드/복원 정책.
- 실제 GoTrue logout/세션 정리·JWT/JWKS·Data API/redirect/provider 동작은 별도 승인 시험 전 NOT VERIFIED.
- 최초관리자 검증 책임·독립2담당자·증빙·보존·국외저장/복구 승인안은 기존 미승인 상태 유지.

운영 GRANT/DDL/DML·실계정 시험·배포·main/통합 병합은 이번 승인 범위가 아니다.
