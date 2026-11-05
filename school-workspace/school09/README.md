# SCHOOL-09A/B Hosted preflight

이 패키지는 운영 설치 승인이나 Hosted PASS가 아니다. 운영 Supabase에는 연결하지 않는다.
기준: `39c775cdd11509fdc6bc930ef62990acdd1e1315`, branch `feature/school-09-hosted-preflight`.

## 재현

저장소 루트에서 실행한다. Cloud 절대경로에 의존하지 않는다.

```bash
python3 school-workspace/school09/tools/verify-inputs.py
bash school-workspace/school09/tests/empty-metadata.sh
bash school-workspace/school09/run-local.sh
```

Python3, Bash, rg, Docker 로컬 소켓, Node 및 lockfile과 일치하는 기존 node_modules가 필요하다.
표준 `npm ci`가 환경 정책으로 실패하면 우회/버전 교체하지 말고 의존성 미충족으로 분리한다.
PG17.6와 PostgREST13.0.4 이미지 digest는 runner/tests에 고정되어 있다. PG는 network:none,
외부 포트 없이 tmpfs에서 실행하며 종료 시 해당 실행이 만든 container만 삭제한다.
외부 DSN·운영 키를 받는 옵션은 없다. JWT 서명키는 메모리에만 둔다.
`SCHOOL08_REGRESSION=0`은 installer 진단용 축소 실행이며 전체 회귀 PASS가 아니다.

SCHOOL08 installer/domain 테스트는 입력 SQL을 그대로 읽는다. SCHOOL09 wrapper가 결과 저장 위치·소유 container 이름만 바꾸고 새 보안 probe를 추가한다.
새 기능 또는 SQL migration은 만들지 않았다. 이전 evidence 디렉터리와 product 파일은 수정하지 않는다.
S02/03/04 회귀는 기존 실제 DB 테스트와 MOCK 인증을 함께 사용한다. UI 재검증으로 세지 않는다.

## 자료

- `sql/hosted-readonly.sql`: ChatGPT에 전달할 카탈로그 SELECT. 운영 실행은 이 작업에서 하지 않는다.
- `sql/postinstall-readonly.sql`: 향후 승인된 설치 후 비파괴 카탈로그 검사. RPC 실행/활성화 없음.
- `reference/rpc-signatures.json`: 실제 PG17 카탈로그에서 추출한 공개/내부 54쌍.
- `evidence/catalog-active.json`: 함수 body/owner/ACL/설정, RLS/제약/역할/열 권한의 로컬 증거.
- `reference/function-call-edges.json`: 보수적인 본문 참조 그래프. pg_depend만으로 PL/pgSQL의 전체 도달성을 증명할 수 없다.
- `INSTALL_AND_RECOVERY.md`: 정확한 로컬 설치 순서 및 Hosted 중단 조건.
- `AUTH_API_REVIEW.md`, `REPORT.md`: 검증 수준과 미해결 Gate.

## 변경 범위

`school-workspace/school09/**`만 추가한다. Electron, DPAPI, 개인 Inventory/일정/Finance,
기존 migration·SECURITY DEFINER 함수는 변경하지 않는다. Windows Actions42046879758의 PASS는
통합 SHA39c775c의 역사적 증거이며 이번 새 SHA의 Hosted/Windows PASS로 승계하지 않는다.
