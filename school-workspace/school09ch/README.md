# SCHOOL09C-H Hosted Auth 권한 실현 가능성 검증

판정 BLOCKED 유지. Hosted 자체에서 새 함수 설치·RPC 실행은 하지 않았다.
상세 대조: REPORT.md, HOSTED_FEASIBILITY.md, ROLE_AND_INSTALL_MATRIX.md.
추가 Hosted 검사는 sql/hosted-capabilities-readonly.sql의 SELECT만 ChatGPT에 전달한다.
정책 승인안은 OPERATIONS_APPROVAL_FORM.md이며 현재 미승인이다.

## 상대경로 재현

저장소 루트에서 Python3/Bash/rg/Docker 로컬 소켓을 사용한다. Node/제품 빌드는 필요 없다.

```bash
python3 school-workspace/school09ch/tools/verify-inputs.py
python3 school-workspace/school09ch/tools/build-candidate.py
bash school-workspace/school09ch/run-focused.sh
```

PG17.6 image digest와 network:none/포트 미공개/tmpfs는 runner에 고정돼 있다.
외부 DB URL/프로젝트 키/실제 계정을 입력받는 경로는 없다. 생성한 컨테이너만 종료 시 삭제한다.
베이스 S08을 합성 Auth fixture로 만든 뒤, 서로 다른 권한을 가진 synthetic installer LOGIN을 만들고
genuine non-superuser DB 연결로 실패/성공 조건을 시험한다. 이는 Hosted 역할을 복제했다는 뜻이 아니다.
Auth SET가 있는 성공 profile은 가정한 능력의 존재를 로컬에서 증명할 뿐, 운영에 해당 membership을 GRANT하라는 지시가 아니다.

## 재사용

09C 기준 a16245d878784aa2bdb06e2a339356956f9720e5의177 DB·23 PostgREST 증거는 그대로 보존한다.
focused26을 그 숫자에 합치거나, 반복 실행을 새 고유 시나리오로 세지 않는다.
원본 Auth/private 함수 본문4개, public54 계약, 기존 제품/Electron/DPAPI/개인 자료·원본 migration을 수정하지 않는다.
새 설치 후보는 설치 role 문맥/guard만 바꾸며 LOCAL-only다. 기존 S08 release fingerprint를 다시 쓰지 않는다.

## 미지원/실패 시

Auth owner SET/DB CREATE/객체 권한/관리형 정책을 확인할 수 없으면 CLOSED 유지.
postgres/service_role·광범위 Auth GRANT·RLS 해제로 우회하지 않는다.
기존177/23은 이전 SHA의 LOCAL 증거이며 실제 Hosted Auth·PostgREST·로그아웃 PASS가 아니다.
