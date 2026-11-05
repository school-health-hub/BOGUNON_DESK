# 운영 적용 전 체크리스트 — 이번에는 실행하지 않음

- 프로젝트 xxownwxxajzrviuvvfiu/Sydney 및 운영자/환경 신원을 별도로 확인한다. GUC나 DB 이름은 실제 프로젝트 신원 증명이 아니다.
- 승인 변경번호·담당자·변경 창, 백업/PITR/복원 권한·최근 복원 증거·복구 목표 확보. 백업 생성/복원도 이번에 실행하지 않았다.
- ChatGPT READ-ONLY 감사로 현재 스키마/역할/함수 이름 충돌, public 기존 정의/ACL/RLS, Auth 소유자/RLS/최소 열 권한·SET ROLE 가능성, PostgREST 노출을 확인한다. 과거232 RLS/20 SD/19 경고를 최신 값으로 단정하지 않는다.
- ws_owner/runtime/authz_reader NOLOGIN/NOBYPASSRLS 및 비소유 실행 경계. Managed auth.sessions id/user_id/created_at/not_after 최소 열 권한의 실현성은 NOT VERIFIED. 불가하면 STOP, postgres/service_role 요청 우회나 RLS 완화 없음.
- 현재 S08 후보는 local-only다. 운영 적용 전에 승인된 별도 누적 배포 버전·managed 호환 검증이 필요하다. local Auth fixture/합성 학교/개별 permission fixture를 운영에 적용하지 않는다.
- 최초 관리자 검증 책임·신뢰 directory·국외 저장 고지·보존기간·운영 백업 책임 등 기존 정책 Gate를 확정한다.
- 변경 승인 후에만 foundation→외부 Auth Gate→atomic cumulative app→54 CLOSED 검증. 적용 전후 기존 public 정의·권한 비교. 실제 적용은 이번에 하지 않았다.
- 별도 승인된 Hosted 테스트 계정/실세션/JWT/회수/Origin/CSRF/PKCE/redirect 테스트 계획, 종료·데이터 처리 책임을 먼저 정한다. 이번에는 실제 계정 생성/로그인 없음.
- DB RPC 공개와 product production Gate는 별개 승인. 사용자/학교 멤버십 서버 인가를 UI flag로 우회하지 않는다. Hosted/보안/Windows Gate 전 production 기본 비활성 유지.

## 실패·복구

foundation만 있는 상태: Auth/권한 선행조건 검토 후 같은 후보 재실행. 외부 역할/스키마 충돌을 삭제해서 해결하지 않는다.
앱 중간 실패: core+Inventory+S08 장부 전체 rollback. 합성 테스트에서 inventory 직전 오류를 주입해 확인했다. foundation은 남고 사업 데이터가 부분 생성되지 않는다.
설치 후 문제: 전용 cumulative close로54 purpose endpoints 모두 차단 → product Gate 비활성 유지 → metadata/evidence 보관 → 승인된 새 호환 버전 검토. DROP/DELETE/CASCADE와 데이터 자동 되돌리기는 제공하지 않는다.
드리프트: install/activation 거부, emergency close는 데이터를 유지하고 closed_unverified로 남긴다. 변형된 구조를 현재 정상 지문으로 자동 재설정하지 않는다. 검토된 복구/새 migration이 필요하다.
원래 S06/07 앱 DB 자동 upgrade/adoption은 미지원이다. 알 수 없는 설치 상태는 거부하며 기존 데이터를 덮어쓰지 않는다. 별도 승인된 데이터 보존 업그레이드 설계가 필요하다.

## 현 단계 미검증

Hosted Auth/JWKS/실제 refresh/logout·회수·auth.sessions 생명주기, managed 권한 부여, hosted PostgREST, 기존 SD19 내부 인가·신규 스키마 도달성, 운영 비용/복구 SLA, 실제 Windows 새 Source. 이 항목들을 로컬 역할 전환/HS256/Chromium 결과로 PASS 처리하지 않는다.
