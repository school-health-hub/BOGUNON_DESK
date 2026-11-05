# SCHOOL09C Authz 결정 및 격리 검증

권고 A2: 비소유 Workspace 실행 역할 + Auth-owned boolean bridge. 운영 실현성 NOT VERIFIED,
최초관리자 정책 NEEDS DECISION, 운영 적용 BLOCKED. 실제 Hosted/로그인/운영 설정 변경 없음.

기준 통합39c775c, 기반 SCHOOL09A/B c41b60bf8da3537104dfdb7ba8a525fa0983de7d.
이전 feature 브랜치와 제품 소스/기존 SQL을 수정하지 않는다.

## 상대경로 재현

저장소 루트에서 Python3/Bash/rg/Docker local socket 및 lockfile 일치 Node dependencies가 필요하다.

```bash
python3 school-workspace/school09c/tools/verify-inputs.py
python3 school-workspace/school09c/tools/build-local-candidate.py
bash school-workspace/school09c/run-local.sh
```

runner는 network:none, 포트 미공개 PG17.6 tmpfs와 pinned PostgREST13.0.4를 사용한다.
합성 Auth 테이블·사용자·JWT만 사용하며 외부 DSN 입력은 받지 않는다. 생성한 container만 종료 때 제거한다.
기존 S08 CLOSED를 설치한 뒤 새 one-shot patch를 적용한다. 원본 테이블/함수 보호와54서명 호환을 검사한다.
S09C 결과만 evidence/에 기록한다. `SCHOOL09C_REGRESSION=0`은 집중 진단용이며 전체 회귀 재실행이 아니다.
공유 Auth session 원문 SELECT는 Workspace/client 역할 모두 제거, private boolean만 사용한다.
Bootstrap operator와 증빙/동의는 **합성 fixture**이며 실제 재직/위임 확인을 완료했다는 뜻이 아니다.

## 파일

- DECISION.md: A/B/C 비교·권고·RLS/DEFINER 경계·보존된 세션 의미
- POLICY_DECISIONS.md: 최초관리자 독립검증 초안·개인정보/보존 결정표
- OAUTH_AND_09D_GATES.md: Google/Main/Web 요구사항·운영 승인 단계·중단/복구
- supabase/migrations/: CLI가 생성한 파일명의 LOCAL 실험 SQL, 운영용 아님
- sql/auth-bridge.sql: 무인자 boolean2개, ws_reader raw Auth SELECT 철회, private helper2개 교체
- sql/bootstrap-control.sql: 운영자 allowlist/독립 승인·감사·멱등성의 비공개 control plane
- sql/activate-isolated.sql: QA에서만54목적 RPC+operator 명령을 명시 공개, PUBLIC/anon 비공개 유지
- sql/hosted-readonly.sql: ChatGPT 추가 감사에 전달할 SELECT
- tests/: 실제 SQL·로컬 HTTP 및 원본 S01~04 회귀 wrapper

원본 S08 fingerprint/lifecycle는 새 실험 patch를 drift로 거부해야 한다. 장부를 덮어써 활성화하지 않는다.
09D에서 승인된 새로운 누적 설치본·minimum capability checker·release lifecycle를 검증해야 한다.
Electron/Web/DPAPI/UI 소스 변경0이므로 제품 빌드·Windows/Chromium은 이번 NOT RUN이다.
