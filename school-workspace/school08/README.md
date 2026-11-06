# SCHOOL-08 누적 Workspace 안정화 후보

기준 SCHOOL07 `282b6bcd905584bd0504f65d297133a3d563611d`. 독립 worktree/feature에서 수행했다. SCHOOL05+ACCOUNT02B 기존 Windows 통합을 다시 만들지 않는다. 새 업무 기능·역할 정책을 추가하지 않으며 운영 Supabase에 연결하지 않는다.

## 로컬 재현

정확한 부모 SHA를 새 checkout에 준비하고 패키지 delta를 상대경로 복원한다. Node lock 의존성, Python3, Docker Unix socket, PostgreSQL17 pinned image, OpenSSL, `/usr/bin/chromium` 필요.

```sh
python3 school-workspace/school08/tools/check_static.py
SCHOOL08_REGRESSION=1 SCHOOL08_FLOW=1 SCHOOL08_BROWSER=1 \
 bash school-workspace/school08/run-local.sh > /tmp/school08.log 2>&1
```

컨테이너 network:none / 포트 없음 / tmpfs, 이름 충돌 시 거부, 본인이 생성한 ID만 제거한다. 운영 DSN/호스트를 받지 않는다. 기존 테스트 adapter를 재사용할 때 **본인 컨테이너만** 기존 테스트 이름으로 잠시 rename한다. 다른 SCHOOL 테스트와 동시 실행하지 않는다. Auth 사용자/학교/permission은 합성 fixture뿐이다. 인증·암호화·Preload는 MOCK이며 실제 LOCAL DB / LOCAL POSTGREST / Chromium 결과와 Hosted/Windows를 구분한다.

## 하나의 설치 후보

1. `sql/install-candidate.sql`가 직접/local 세션을 확인하고 신규이면 **frozen S06 foundation**을 사용한다.
2. Auth 최소권한이 외부에서 승인·제공되어야 한다. 테스트만 S06 local-auth-capabilities fixture 사용. 운영에 그 fixture를 적용하지 않는다.
3. CLI 생성 `supabase/migrations/*_cumulative_workspace.sql`가 S06 core→S07 Inventory를 **같은 트랜잭션**으로 설치한다. 원본에서 바꾸는 것은 최상위 BEGIN/COMMIT 제거뿐이다. 기존 부모 파일·장부를 수정하지 않는다.
4. 새 S08 release/54 RPC 장부가 전체 구조와 사양을 검증한다. **39+15 모두 CLOSED**로 완료된다. 반복 시 frozen 부모 파일을 다시 실행하지 않고 누적 후보의 checksum/지문/Auth capability를 검증한다.
5. 명시적 격리 QA에서만 `sql/activate-local.sql`: 정확히54개 public invoker/validated private purpose 진입점만 authenticated EXECUTE. 실제 production feature gate를 열지 않는다.
6. `sql/close-local.sql`:54개 전체 원자적 차단, 업무/거래/감사 데이터 삭제 없음. 정상 close/replay/reopen 검증. 드리프트는 공개/설치를 거부하고 긴급 차단 후 closed_unverified로 남긴다. 변조된 구조를 자동 정상으로 채택하지 않는다.

entry는 psql의 상대경로 `\ir`를 사용한다. 실행 세션은 database=school01a/current_user=session_user 및 isolated GUC가 필요하다. **이 조건 자체는 프로젝트 신원의 증명이 아니다. 본 로컬 runner 이외의 운영 접속에 사용하지 않는다.** foundation-only 상태에서 Auth capability가 없으면 앱 설치는 실패하고 foundation만 남는다. 원인 검토 후 재실행한다. 앱 후반 실패를 주입해 core/Inventory 전체 DDL rollback을 실제 확인했다.

S08 없는 기존 S06/07 앱 DB의 자동 adoption/데이터 이전은 거부한다. 해당 DB는 삭제/덮어쓰기하지 말고 별도 호환 업그레이드 검토가 필요하다. 이번 후보는 아직 Workspace가 없는 빈 격리 DB를 대상으로 한다. 기존 managed 프로젝트도 실제 설치 전 별도 승인/호환 검증이 필요하다. S07 local-only guard를 유지했으므로 Hosted 적용 파일로 확정하지 않는다.

부모 S06/07 frozen 설치/공개 스크립트는 S08 설치 후 직접 재실행하지 않는다. 새 전체 지문에서 부모 장부는 역사적 증거이며 누적 lifecycle은 S08만 담당한다. 운영에서는 별도 승인된 누적 배포 버전/Managed Auth 권한 가능성 확인 후 전환해야 한다.

## 코드 변경 범위

학교/업무/일정/인수인계/재고 테이블과 권한 의미는 원본 그대로. 추가 DB 개체는 private 누적 장부2개뿐이다. 앱 변경은 재고 화면의 `s.item` optional guard 두 곳이다. Main/Preload/DTO/Auth 및 기존 Dashboard/Dock/UI는 다시 작성하지 않았다. 개인 데이터 자동 업로드/동기화/서버 의존을 추가하지 않았다.

## 결과 해석

원본 Windows Actions41978328480/head142c2d9 success 및 두 artifact 메타데이터를 GitHub에서 확인했다. DPAPI/로그아웃/재실행/GUI/종료 PASS는 그 Source의 역사적 증거로 보존한다. 새 Source에 승계하지 않는다. 이번 WINDOWS REAL/HOSTED는 NOT RUN이다.

루트13 타입 오류와 Finance 고정 리소스 기대값 실패1건은 동일 S07 기준에서 확인되는 기존 문제. S07 nullable 타입 오류1건은 이번에 수정했다. xlsx 공식 CDN403을 우회/버전 대체하지 않는다. Cargo는 설치되어 있으나 기본 PATH/HOME이 맞지 않았고 command-scoped CARGO_HOME/RUSTUP_HOME으로1.99.1 확인했다. Rust 변경이 없어 native/Tauri 빌드는 재실행하지 않았다. 전체 Electron/Portable PASS가 아니다.
