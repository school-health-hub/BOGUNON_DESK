# 운영 적용과 실계정 시험 체크리스트

## 현재 허용 범위

로컬 설치/검증/복구 후보와 인계 패키지만 완료한다. 아래 체크박스는 승인으로 간주하지 않는다.
GATES.json의 VERIFIED에는 반드시 LOCAL 또는 과거 사용자 전달 Hosted READ-ONLY 범위가 붙는다.
추가 Hosted SELECT는00만 승인된 ChatGPT 경로로 수행한다. 인증정보/세션행/원문 개인정보는 요청하지 않는다.

## 운영 설치 전 — 모두 별도 확인/승인

- [ ] 실제 endpoint가 BogunOn xxownwxxajzrviuvvfiu/Sydney인지 기존 관리 화면·접속 경로로 확인. GUC marker만으로 확인하지 않음.
- [ ] current_user=session_user=postgres, NOSUPERUSER, CREATEROLE/DB CREATE/public CREATE grant option/새 소유 역할 SET 확인.
- [ ] 기존 Auth USAGE·sessions4열 SELECT·uid/jwt EXECUTE·users.id REFERENCES 확인. 부족하면 자동 GRANT하지 않고 BLOCKED.
- [ ] Hosted의 Workspace FK 생성/owner 이관과 제한 postgres SECURITY DEFINER 설치가 허용되는지 확인.
- [ ] 새 schema/role/function 충돌 없음과 기존 public RLS/함수/개인 테이블의 최신 기준선 확인. 과거232/20은 최신 보증이 아님.
- [ ] 기존20 SECURITY DEFINER/19 경고의 현재 본문·내부 인가·동적 SQL과 신규 schema 도달성 READ-ONLY 감사.00의 문자열 flag만으로 안전 판정하지 않음. 기존 EXECUTE는 일괄 변경하지 않음.
- [ ] creator TABLE/SCHEMA/FUNCTION 기본 권한 목록과 새 객체 hardening 검토. 기존 global default ACL은 변경하지 않음.
- [ ] public Data API 노출·활성·캐시/실행 권한 확인. workspace/private/Auth bridge/bootstrap은 노출하지 않음.
- [ ] 백업 시점·복구 담당자·복구 소요시간/절차·복구 연습 증거 승인.
- [ ] 정확한 Source SHA/SQL SHA-256과00→01→02 순서 검토 및 사용자 별도 운영 적용 승인.

## 승인 후 설치 절차의 기술 계약 — 여기서는 미실행

- 한 direct session에서 ON_ERROR_STOP, 제공된 단일 transaction SQL 사용. statement를 잘라 auto-commit하지 않는다.
- public54 및 private54/초기 bootstrap은 CLOSED. 운영 활성화 SQL은 이 패키지에 제공하지 않는다.
- 중간 오류는 전체 rollback, 원인 확인 후 동일 해시의 fresh 후보로 재시도. 임의 IF NOT EXISTS/GRANT로 우회하지 않는다.
- postflight에서 owner/RLS/ACL/FK/54 서명과 원래 public 데이터/구조 불변을 비파괴 확인.
- postflight 실패나 metadata drift 시 제품 Feature Gate CLOSED 유지. 확인되지 않은 상태를 PASS로 표시하지 않는다.
- 새 privilege 노출/장애 시 정해진54쌍 emergency close로 차단. 데이터 삭제 없음, 정상 지문으로 다시 저장하지 않음.
- emergency 상태는 closed_unverified. installer와 QA activation도 재개하지 못함. 원인·owner/권한을 검토한 별도 복구 계획 필요.
- 대상 함수가 없거나 신뢰한 비BYPASS 소유 역할과 다르면 복구도 중단. 임의 postgres 소유 전환/권한 확대 금지.
- rollback 목적으로 기존/신규 데이터·스키마를 자동 DROP/TRUNCATE하지 않는다. 의존/보존 자료가 있으면 삭제 DDL은 별도 결정.

## 실제 인증 시험 — 별도 승인 전 NOT RUN

- [ ] Google provider·승인 redirect·Electron PKCE callback·Web BFF/영구 세션 저장소 설정 검토.
- [ ] token/JWKS·sub/session_id·request.jwt.claims 및 auth.uid/jwt 의미 일치 확인. user_metadata 인가 금지.
- [ ] 승인된 시험 계정/학교/기간/기록/정리 계획과 개인정보 처리 동의 승인.
- [ ] 두 세션을 구별해 current/global logout·회수·refresh 실패·user 삭제·not_after 후 다음 RPC 차단 확인.
- [ ] 멤버십 정지/만료·학교 전환·미승인·교차 학교·지원강사 권한 상한 실계정 부정 시험.
- [ ] Renderer token 비노출·Windows DPAPI·Web HttpOnly/Secure/CSRF 경계 확인. 합성 JWT로 대체하지 않음.
- [ ] 이 결과와 보안 Advisor/접근 기록/복구 결과를 검토한 뒤 별도 Feature Gate 활성화 승인.

## 운영 정책 결정 — 미승인 유지

| 결정 | 필요한 내용 | 현재 |
|---|---|---|
| 최초 관리자 | 실재직/학교 위임 검증 책임 기관·담당자 | BLOCKED |
| 독립 승인자2인 | 다른 실계정/DB principal, 자기/대상자 승인 금지, 대리/휴직·분실 절차 | BLOCKED |
| 증빙 최소 수집 | 필요한 증빙 종류, 식별/위임 확인, 주민번호·학생 자료 제외 | BLOCKED |
| 증빙 보존/삭제 | 기간·접근자·암호화·삭제 시점/증거 | BLOCKED |
| 학교 업무 기록 | 학교 소유권·보존기간·학교 탈퇴/관리자 부재 처리 | BLOCKED |
| 전근/퇴직/계약 종료 | 계정 보존과 학교 멤버십 회수, 기록 작성자 tombstone·관리자 이관 | 별도 운영 승인 필요 |
| 감사/국외 저장 | 감사 접근 범위, 보존·백업·Sydney 저장 이용/고지 근거 | BLOCKED |

미결정 기간이나 담당자를 임의로 확정하지 않는다. 실제 재직 확인을 합성 bootstrap fixture로 대체하지 않는다.
main/통합 병합·운영 배포·Windows EXE 변경은 이 단계의 권한이 아니다.
