# SCHOOL-09D-1 Hosted 환경 확인 — BLOCKED

2026-11-06 KST. 이 단계는 Hosted 전환 확인이며 새 로컬 검증 프로젝트/설치/보안 시험을 시작하지 않았다.

## 실제 확인

- D0 원격 HEAD `65c5f01eea84263cb005e795aadf351b82c92ee9`, 통합 HEAD `39c775cdd11509fdc6bc930ef62990acdd1e1315` 재확인. 기존 결과/브랜치 보호.
- 현재 승인된 Supabase 연결의 projects 조회 결과는 TEAM BAERURI의 `baeruri` (`zbdnvdjleipnrprpwqyd`, Seoul, ACTIVE_HEALTHY)1개뿐이다.
- 이는 현재 연결의 가시 범위다. 다른 계정/조직에 테스트 프로젝트가 없다는 증거가 아니다.
- 배루리 프로젝트를 테스트로 재사용하지 않았다. 데이터/SQL/설정 조회·변경도 하지 않았다.
- BogunOn `xxownwxxajzrviuvvfiu`의 get_project 메타데이터 READ-ONLY 요청은 permission denied였다. 운영 SQL·migration·Auth 호출 없음.
- 이후 전달된 dashboard URL도 같은 운영 project ref다. URL은 현재 연결의 접근 권한을 부여하지 않는다. 브라우저 스킬 확인/도구 검색 후 이 세션에 탭/제어 도구가 없어 로그인된 브라우저 상태도 확인하지 못했다.
- 기존 소스의 공개 Supabase project URL 참조는 BogunOn뿐. 확인한 supabase/config.toml 및 .temp/project-ref 경로에는 연결된 QA ref를 찾지 못했다.
- 실행 환경에 준비된 별도 secret/outbound identity는0개. credential 파일·환경값·비밀번호/토큰을 열거나 요청하지 않았다.
- 원문 프로젝트/조직 discovery 결과와 축약 실행 환경 관측은 evidence.json에 보존한다.

## Hosted 시험 상태

| 항목 | 결과 |
|---|---|
| 현재 연결의 프로젝트/조직 메타데이터 discovery |확인 완료|
| 격리 Hosted QA 프로젝트 |현재 연결에서 미확보|
| Hosted SQL 설치·신원·owner·FK·54 RPC/CLOSED·ACL |NOT RUN|
| Hosted Data API·학교 격리·역할 회수·복구 |NOT RUN|
| 실제 Auth 계정·Google OAuth·만료/로그아웃/회수 |NOT RUN|
| 로컬 설치/보안 테스트 반복 |수행하지 않음|
| 새 프로젝트/유료 리소스/운영 변경 |0|

이번에 해결했다고 주장할 SQL/Auth 결함은 없다. 실제 Hosted 실행이 없으므로 결함 수정·통과를 추정하지 않는다.
D0의46 PASS는 로컬 근거로만 유지한다. Hosted PASS로 승격하지 않는다.

## 결정이 필요한 한 가지 — 전용 Hosted QA 프로젝트 확보

권고안: **BogunOn을 관리하는 지정 조직에서 `bogunon-workspace-hosted-qa` 전용 프로젝트1개를 생성·연결**한다.
Sydney `ap-southeast-2`, 운영/배루리와 다른 project ref, 실제 교직원·학생 자료 없는 합성 전용 환경이다.
그 조직은 현재 연결에 보이지 않으므로 적절한 Supabase 연결/조직 접근 권한도 필요하다.
이미 승인된 전용 QA 프로젝트가 있다면 새 생성 대신 그 프로젝트의 ref와 승인 범위를 연결한다.
어느 경우든 현재 보이는 배루리나 운영 프로젝트로 대체하지 않는다.

[Supabase 공식 요금표](https://supabase.com/pricing), 2026-11-06 확인:

- Free는 월$0로 표시되며 활성 프로젝트2개 한도, DB500MB,1주 미사용 시 pause가 있다. **해당 조직/계정의 무료 가능 여부·잔여 한도는 미확인**이다.
- 유료 조직에서는 별도 프로젝트가 자동 무료가 아니다. Pro는 월$25부터, 추가 프로젝트는 월$10부터로 안내된다. 실제 compute credit/시간·사용량·기능에 따라 달라진다.
- Free의 Social OAuth는 포함되지만 일부 고급 Auth session timeout/single-session 기능은 제한된다. 필요한 시험이 유료 기능을 요구하면 그 항목을 분리하고 별도 승인 없이는 업그레이드하지 않는다.
- 새 프로젝트는 전용 Postgres·스토리지·Auth 사용자/세션·Data API endpoint/키를 가진다. 무료 슬롯/리소스를 소비하며 별도 관리·시험 후 pause/정리 계획이 필요하다.

제안 승인 범위: **선택 조직·무료 한도를 확인해 추가 청구$0가 확정될 때만 생성**. 유료 전환/add-on/다른 GCP 리소스/운영 변경은 제외한다.
이 제안에 대한 명시적 승인 없이 create_project를 호출하지 않았다. 금액 불확실 시 비용을 승인된 것으로 간주하지 않는다.

## 확보 후 진행할 Hosted 순서

1. 별도 ref/조직/리전/요금·권한·합성 전용 여부를 메타데이터로 재확인.
2. D0의 운영 ref marker를 거짓으로 설정하지 않는다. QA ref에 명시적으로 결합한 별도 설치 profile/해시를 만들어 실제 대상과 대조한다.54 함수/보안 의미는 유지.
3. READ-ONLY baseline/Advisor/신원·Auth 최소권한·기존 객체 충돌 점검 후, 승인된 QA에서만 CLOSED 설치/owner/FK/공개54/ACL 검증.
4. 같은 QA의 합성 Auth 계정으로 실제 Data API·학교/역할 격리·회수·비정상 설치 복구를 시험.
5. Google 시험은 승인된 전용 OAuth client/redirect와 합성 시험 신원만 사용. 교직원 개인계정/운영 provider를 사용하지 않음.
6. 실패 시 최대3개의 실질적으로 다른 안전한 수정 및 영향 검사만 재실행. RLS/세션 회수/권한 상한을 낮추지 않음.

## 남은 운영 승인

Hosted 성공 후에도 운영 적용은 별도다. 최초 관리자 검증 책임·독립 승인자2인·증빙 최소 수집/보존/삭제,
학교 기록 보존·전근/퇴직·국외 저장 고지·백업/복구·실계정 시험 동의·운영 설치/Feature Gate 활성화 승인이 남는다.
현재 정책을 자동 승인하거나 main/통합에 병합하지 않는다.

## Git·판정

독립 `feature/school-09d1-hosted-discovery`에 확인된 discovery 증거와 이 전환 결정을 보존한다.
제품/SQL 수정 없음, 로컬 새 테스트 없음. 최종 SHA/원격 상태는 GIT_RECEIPT.json과 채팅 완료 보고를 따른다.
**최종 BLOCKED: 승인된 격리 Hosted 프로젝트와 해당 프로젝트에 접근 가능한 연결이 필요하다.**
