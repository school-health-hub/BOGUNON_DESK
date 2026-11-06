# SCHOOL-07 공동 물품·유효기간 관리

판정: 로컬 합성 검증 후보. 운영 Supabase·실제 Windows 연결은 미검증이다.

기준 SCHOOL06 `eca3ef6bcb62bd2a78526e4c12a02e8db5f381c6`, 통합 `243ae95e69483dfbe8d2438c41f858577d748048`. 독립 `feature/school-07-shared-inventory`. SCHOOL06과 개인 Inventory 코드는 보존한다.

## 로컬 재현

정확한 Git 기준 또는 최종 Source SHA를 새 디렉터리에 checkout한다. 기본 checkout 위에 ZIP의 변경 파일만 상대경로로 복원한다. 기존 작업 트리 위에 덮어쓰지 않는다. `package-lock.json`에 맞는 Node 의존성, Python3, Docker Unix socket, Chromium, OpenSSL이 필요하다.

```sh
python3 school-workspace/school07/tools/check_static.py
SCHOOL07_REGRESSION=1 SCHOOL07_TS_TESTS=1 SCHOOL07_BROWSER=1 \
  bash school-workspace/school07/run-local.sh > /tmp/school07-local.log 2>&1
```

PostgreSQL17.6 pinned digest, network:none, 외부 포트 없음, tmpfs DB. 기존 동명 컨테이너는 거부하고 자신이 생성한 ID만 정리한다. 원래 SCHOOL02/03/04/05 테스트의 컨테이너 이름을 사용하기 위해 **해당 실행이 소유한 컨테이너만** 잠시 rename하며 다른 테스트와 동시 실행하지 않는다. DB URL/운영 호스트 인자를 받지 않는다.

로컬 BFF는 명시적 synthetic 모드·loopback HTTPS·HttpOnly/Secure/SameSite cookie·Origin/CSRF 검사를 사용한다. 테스트 인증 발급자·세션 저장소는 합성이며 운영용이 아니다. P0 Renderer 검증은 Chromium + 모의 Preload→실제 local BFF/DB 경로다. Windows Electron GUI 또는 Hosted Supabase PASS가 아니다.

## 설치 순서와 SCHOOL06 계약

1. 원본 SCHOOL06 foundation → 테스트 Auth 소유자 최소권한 fixture → core. 이 단계의 core39 RPC는 CLOSED 확인.
2. **격리 QA에서만** 원본 SCHOOL06 명시적 activation. 기존 인증/학교 UI가 이 계약을 사용한다.
3. CLI `migration new shared_inventory`로 생성한 `supabase/migrations/*_shared_inventory.sql` 적용. SCHOOL07 신규15 RPC도 기본 CLOSED.
4. 격리 QA에서만 `sql/activate-local.sql`. 별도 child release ledger로 checksum/전체 구조 지문을 확인한 뒤 신규15 RPC만 공개.
5. 문제 시 `sql/close-inventory.sql`: 신규15만 차단, 업무 데이터·거래 이력 삭제 없음. 전체 Workspace를 닫으려면 보존된 SCHOOL06 차단 절차도 별도로 검토한다.

SCHOOL06 원본·설치 장부·체크섬은 바꾸지 않는다. S07은 명시적 자식 확장이며 자기 장부 `workspace_private.s07_install_manifest`를 둔다. 최초 설치는 부모 구조 일치를 요구하고 동일 child/구조는 재실행 no-op. public 신규 wrapper와 private 함수/ACL·테이블·RLS·FK·인덱스·역할까지 지문에 포함한다. 드리프트 시 재실행/공개를 거부하며 emergency close는 closed_unverified로 보존한다. 정상 close→재실행→재공개도 검증한다.

확장 후 **옛 SCHOOL06 frozen core를 재실행하면 드리프트로 거부되는 것이 의도된 동작**이다. 부모 지문을 새 구조로 자동 덮어쓰지 않는다. 이 사실을 Hosted 설치 호환성 PASS로 확대하지 않는다. 운영 적용 전 별도 승인된 누적 release/관리형 Auth·GRANT 검토가 필요하다. 이번 S07 migration/activation은 local-only guard이며 운영 적용 파일로 확정하지 않았다.

## 데이터·권한

- 학교 공유 items/lots/movements/locations 네 테이블 및 private 설치 장부. 학교 복합 FK, membership epoch, version, request_id, audit 계약 사용.
- 최대 소수3자리, 0~1,000,000,000 수량. 수량을 단순 덮어쓰는 API 없음. 조정은 새 거래로 기록한다.
- 입고 새 lot는 expected_version0, 기존 lot 변경은 해당 lot version 필수. 물품 메타데이터/위치는 각각의 version 사용.
- 같은 학교 기존 advisory lock과 lot FOR UPDATE로 거래 직렬화. 서로 다른 lot의 학교 전체 직렬화는 소규모 MVP 선택이며 처리량 확장 때 별도 검토한다.
- Admin/Teacher는 물품·위치 관리/거래. Assistant 기본 재고 조회·현재 epoch 본인 거래 이력만; explicit inventory.receive/use allow + own scope인 경우에만 **본인 명의** 기록. deny 우선. Assistant의 inventory.manage/adjust/dispose allow를 억지로 넣어도 역할 상한을 넘지 못한다.
- 개별 권한 부여 UI/운영 관리 RPC는 이번에 새로 만들지 않았다. 검증된 운영 권한 부여 절차 전에는 지원강사 쓰기 기본 차단. 합성 fixture의 allow를 실제 승인으로 간주하지 않는다.
- pending/정지/만료/계정·세션 회수는 RPC마다 현재 상태로 검사한다. 원시 테이블/private dispatch 직접 접근 없음. 새 공개 함수는 invoker, private 목적별 진입은 ws_runtime definer, authz reader는 비소유 NOBYPASSRLS.

## 재고·유효기간

Asia/Seoul 오늘 날짜 기준, 유효기간 **당일까지 사용 가능**, 어제 이전 만료. 임박은 오늘~30일 inclusive. 31일은 제외. 서버 상수 계층 `s07_soon_days()`로 분리했으며 학교별 실제 설정 UI는 후속 범위다.

전체 보유는 모든 lot 합계. 비활성 보관 물품은 전체 보유를 유지하고 사용 가능/임박0, 전체를 사용 불가로 표시한다. 사용 가능은 AVAILABLE 및 미만료/유효기간 없음만 합산. 만료·UNUSABLE은 사용 불가, 폐기는 명시적 음수 거래로 잔량을 줄인다. STATE 거래는 수량 변화0으로 사용 가능 상태 변경 이력을 기록한다. 자동 차감/자동 폐기 없음. 부족 여부는 사용 가능 수량<최소 수량이다. 임박 수량은 사용 가능한 lot만 포함한다. 만료와 UNUSABLE 표시는 겹칠 수 있으므로 두 값을 합쳐 전체 수량에서 빼지 않는다.

빠른 유효기간 순으로 lot 표시, null은 뒤에 표시. 기존 lot의 유효기간/입고일을 입고 요청으로 몰래 변경하지 못한다. 날짜 무한대는 거부한다. 운영 사유80자, 이름80/분류40/규격100/단위12자. 학생/상담/투약/처치/개인인증정보 패턴을 서버에서 거부하지만 탐지는 완전하지 않다. 긴 자유 서술·첨부·학생 연결은 없다. 차단한 원문은 receipt/audit/AI로 전달하지 않는다.

목록은 학교당 최대500개, 이력은 물품별 최근100개다. MVP 검색/카테고리·알림 필터는 로드된 목록 기준이며 더 큰 학교 재고에는 서버 pagination/search 연결 확장이 필요하다. 단위가 다른 수량을 합산하지 않도록 상단 요약은 물품 종수, 각 카드/lot는 실제 수량을 표시한다.

## 제품 경계

기존 우리 보건실에 공동 물품관리 탭 추가. 개인 Inventory 화면/파일 형식/암호화/백업/저장 경로는 변경하지 않는다. 공통 DTO와 전용 Preload11개 메서드만 추가했으며 범용 SQL/HTTP/RPC IPC는 없다. Main의 sender/frame/origin 및 production synthetic 차단 유지. 세션·계정·학교 전환 시 coordinator/store generation과 abort로 정리한다. offline queue/디스크 cache/자동 업로드 없음.

회귀·브라우저·원본 보호 해시·빌드 비교는 `evidence/`, `reference/` 참조. 운영 Supabase/Windows는 NOT RUN. 전체 Electron은 기존 xlsx 미설치/공식 CDN403 환경 제한을 포함해 별도 판정한다.
