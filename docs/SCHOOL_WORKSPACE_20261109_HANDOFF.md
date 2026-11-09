# SCHOOL WORKSPACE 2026-11-09 인계

## 1. 기준과 판정

- 검증 Source SHA: `0a972cd6812927ff01415df445fc31e212397ed5`
- 브랜치: `integration/electron-feature-baseline`
- 검증 당시 로컬/원격 SHA: 일치, divergence `0/0`, 작업 트리 clean
- 제품 코드 최종 상태: 루트·Electron 빌드 PASS, SCHOOL strict PASS, Electron 회귀 `991 PASS / 0 FAIL / 3 SKIP`
- 최종 기능 판정: **CONDITIONAL**. 관리자 UI와 인수인계 수정은 PASS다. 공동 일정은 수정·권한 차단·재접속·취소 이력 보존까지 PASS지만 물리 삭제는 현재 계약에 없어 BLOCKED다.
- 이 문서를 추가하는 후속 커밋은 QA Source SHA를 변경하지 않는다.

합성 로컬 QA PASS는 운영 DB 검증, 운영 배포 승인 또는 실제 사용자 계정 검증을 의미하지 않는다.

## 2. 2026-11-09 완료 범위

| 단계 | 결과 | 소스/증거 |
|---|---|---|
| UI/UX Pass 1 | PASS | commit `299e9a3`; `.omo/evidence/school-workspace-ui-ux-pass-1/` |
| UI/UX Pass 2 | PASS | commit `7272154`; `.omo/evidence/school-workspace-ui-ux-pass-2/` |
| Build Stabilization | PASS | commit `6328428`; `.omo/evidence/school-workspace-build-stabilization/` |
| Electron Regression Triage | PASS | commit `b117da7`; 최종 재실행은 991/0/3, 별도 독립 로그 폴더는 남지 않았으므로 재현 명령으로 확인 |
| SCHOOL DB Stabilization | PASS | commit `3b0da5d`; 관련 DB/타입 하네스는 Git 추적, 별도 독립 증거 폴더는 남지 않음 |
| Final Integration QA | CONDITIONAL | `.omo/evidence/school-workspace-final-integration-qa-20261109/` |
| Final QA Unblock | PASS(지원 계약 범위) | commit `b41b58f`; `.omo/evidence/school-workspace-final-qa-unblock-20261109/` |
| UI Gap Closure | CONDITIONAL | commit `0a972cd`; 위 폴더의 `ui-gap-closure-final/` |

## 3. 최종 기능 QA

- 학교 검색·선택·가입 요청·승인/반려·승인 후 접근: PASS
- 공동 업무 생성·담당·상태 변경·공유·재조회: PASS
- 공동 일정 생성·수정·공유·무권한 변경 차단·재접속: PASS
- 공동 일정 취소: PASS. DB 행은 `CANCELLED`로 남으며 목록에서 물리 삭제되지 않는다.
- 인수인계 작성·수정·후임 조회·revision별 읽음 상태·재접속: PASS
- 공동 물품 등록·수량 흐름·계정 공유·학교 격리·오프라인 실패 표현: PASS
- 보건지원강사 조회·입력·출력 계약: PASS
- 가입 승인/반려, 역할·유효기간·정지·회수와 계정별 즉시 반영: PASS
- Trusted MFA 미구성 관리자 추가·이관: `CLOSED`, 동작 비활성 유지
- 실제 Windows Electron BrowserWindow → IPC → SCHOOL 서버 → PostgreSQL 17.6 → 다른 합성 계정 재조회: PASS
- 실제 운영 DB, OAuth, 실계정, 개인정보: 사용하지 않음

## 4. Electron 회귀 기준

최종 단독 실행 결과는 `151` test files, `991 PASS / 0 FAIL / 3 SKIP`이다. 병렬로 다른 빌드를 수행하던 최초 실행에서는 기존 5초 제한 테스트 2건이 시간 초과했으나, 해당 16개 테스트의 단독 재실행과 부하 없는 전체 재실행은 PASS했다.

```powershell
npm ci
npm run build
npm run electron:p0:build
npm run electron:p0:test
npx vitest run school-workspace/admin-mfa/*.test.ts `
  school-workspace/school02/tests/trusted-mfa-ui.test.tsx `
  school-workspace/school02/tests/trusted-mfa-flow.test.ts `
  school-workspace/school02/tests/membership-expiry.test.tsx `
  --no-file-parallelism --maxWorkers=1
```

확인한 학교 타입 설정은 SCHOOL02·03·04·05, integration, admin-mfa이며 모두 `npx tsc -p <경로>/tsconfig.json --noEmit`으로 PASS했다.

## 5. PostgreSQL 17.6 격리 QA

- 이미지: `postgres:17.6-bookworm`
- 컨테이너: QA 실행 중에만 `bogunon-school05-pg` 사용
- 네트워크: `--network none`, host port binding 없음
- 데이터: 합성 학교·계정·업무만 사용
- 설치: 누적 SCHOOL08 54 RPC를 격리 설치하고 기본 `CLOSED`를 검증한 뒤 QA 전용 `activate-local.sql` 적용
- Instructor SQL은 누적 54 RPC 확인 이후 별도 fixture로 적용
- 요청 경로: Windows Docker Desktop named pipe + 지속 `psql` 세션
- 종료: 컨테이너와 QA Electron 프로세스, `td2-portable-*` 임시 루트 제거 완료

Git으로 복원되는 주요 파일:

- `scripts/qa/school05-build-persistent-docker-provider.mjs`
- `scripts/qa/school05-persistent-docker.ts`
- `scripts/qa/school05-windows.mjs`
- `scripts/qa/school08-native-pg.ps1`
- `school-workspace/school08/sql/install-candidate.sql`
- `school-workspace/school08/sql/activate-local.sql`

기존 PostgreSQL 17 이상이 설치된 Windows에서는 외부 서비스 설치 없이 다음 네이티브 QA 진입점을 쓸 수 있다. QA 전용 임시 루트와 증거 경로를 먼저 설정해야 한다.

```powershell
$env:TD2_ROOT = Join-Path $env:TEMP ("td2-portable-" + [guid]::NewGuid())
$env:TD2_EVIDENCE_ROOT = Join-Path $env:TD2_ROOT "evidence"
New-Item -ItemType Directory $env:TD2_EVIDENCE_ROOT -Force | Out-Null
pwsh -NoProfile -File scripts/qa/school08-native-pg.ps1 -Action Start
# 검증 후, 같은 셸에서:
pwsh -NoProfile -File scripts/qa/school08-native-pg.ps1 -Action Stop
```

Docker 경로를 재사용할 때도 반드시 PostgreSQL 17.6, `--network none`, 무포트, 54 RPC 기본 CLOSED 확인, QA 전용 활성화 순서를 유지한다. 비밀번호 값은 문서나 증거에 기록하지 말고 실행 시 임시 생성한다.

## 6. 보안·권한 계약

- 일반 Workspace Gate는 기본 `CLOSED`다.
- Trusted MFA 서버·DB 권한이 없는 관리자 추가·이관은 `CLOSED`다.
- 클라이언트 UI 표시나 QA 플래그로 서버 권한을 대체하지 않는다.
- RPC, SQL, DB schema, 인증 및 서버 권한 정책은 UI Gap Closure에서 변경하지 않았다.
- 일정의 삭제 동작은 `ws_v1_cancel_event`에 의한 `CANCELLED` 이력 보존이다. 물리 삭제가 필요하면 별도 제품·RPC 계약 승인이 필요하다.

## 7. 남아 있는 NOT RUN

- 운영 Supabase/운영 PostgreSQL 연결
- 실제 Google OAuth와 실계정
- 운영 Trusted MFA 배포 및 관리자 이관 실행
- 실제 학생·교직원 데이터
- 물리 프린터 출력과 native save dialog
- 최종 UI Gap Closure의 설치형 Portable 패키지 실행: 최종 증거는 실제 Windows Electron BrowserWindow이지만 `packaged:false`; packaged runtime은 NOT RUN
- 집 PC에서 이 로컬 증거 archive 복원: 아직 전송 경로가 승인·검증되지 않아 NOT RUN

## 8. 학교 PC 증거 인벤토리

`.omo/`는 `.gitignore` 대상이다. 아래 증거 455개, 55,234,951 bytes는 Git clone으로 복원되지 않는다.

| 경로 | 파일 | bytes | tree SHA-256 |
|---|---:|---:|---|
| `.omo/evidence/school-workspace-build-stabilization/` | 35 | 6,848,567 | `55ce06d64bfce5ba6d8ecb53ba56fc4666a5d3917b4327dc3ca719ad0fe76cc4` |
| `.omo/evidence/school-workspace-captures-20261109-095212/` | 12 | 1,756,299 | `98276c011eee2407ca304a930c55899e2480d53868c83b437798ae3842fbfc98` |
| `.omo/evidence/school-workspace-final-integration-qa-20261109/` | 45 | 7,294,693 | `48e7fa40ba01d127db15908a767c5b5b4c2997c7a35b98bd0e881f5e98990ca3` |
| `.omo/evidence/school-workspace-final-qa-unblock-20261109/` | 232 | 15,840,098 | `c4701c073a8dfa07f95a99de8f69521591d3839258c79d6bcd527eb2f2daf970` |
| `.omo/evidence/school-workspace-ui-ux-pass-1/` | 31 | 5,109,411 | `d8808182d5c4d749d8b9e0ac43850733d86e5b95122d30ed07d86f859f3bbaac` |
| `.omo/evidence/school-workspace-ui-ux-pass-2/` | 100 | 18,385,883 | `d7c79873c5369276c2190e8d353a87f01d679b33059247a774c40e1347b100fd` |

Tree SHA는 경로별 `SHA256-MANIFEST.tsv` 항목을 정렬해 다시 SHA-256한 값이다. 원본은 삭제하거나 수정하지 않았다.

## 9. 백업 상태

기존 학교 PC 로컬 QA 보관 루트에 비파괴 복사본을 만들었다.

- 복사 디렉터리: `C:\Users\sehwa\Documents\BOGUNON_DESK_QA\SCHOOL_WORKSPACE_20261109_HANDOFF_0a972cd\`
- archive: `C:\Users\sehwa\Documents\BOGUNON_DESK_QA\SCHOOL_WORKSPACE_20261109_HANDOFF_0a972cd.zip`
- archive 크기: 48,756,970 bytes
- archive SHA-256: `998DAA096E5A7C8A498FAB65435EA8D94D98B8ED88F7A224536504E26B6CF089`
- 파일별 인벤토리: 복사 디렉터리의 `SHA256-MANIFEST.tsv`
- manifest SHA-256: `0111C0FE72850C39B26BB5A5C641535A8E50D409A8A052B8CBC761C01C895BA2`
- 복사 대상: SCHOOL 증거 455개 + 관련 `.omo/plans`/`.omo/drafts` 4개 = 459개, 55,254,432 bytes
- 원본/복사본 파일 SHA 불일치: 0

이 복사본도 현재 학교 PC 로컬에만 있다. GitHub 저장소는 PUBLIC이며 이 증거는 업로드하지 않았다. 저장소 Actions artifact 기본 보존은 현재 90일이지만 기존 workflow는 더 짧은 보존기간을 사용할 수 있고, `0a972cd`에 결합된 이번 로컬 증거 artifact는 없다. Actions artifact를 영구 백업으로 간주하지 않는다.

전용 secret scanner는 설치되어 있지 않았다. 전체 의도 패키지의 텍스트에 대해 개인키, JWT, GitHub/AWS/Google 키, Bearer, 비밀번호 할당, Supabase service-role, 이메일 및 access/refresh token 패턴을 최선형 검사했으며 발견 0건이었다. “실명” 2건은 모두 “실명과 연락처는 입력하지 않습니다”라는 UI 문구였다. PNG/PDF/XLSX 같은 바이너리는 패턴 검사 한계가 있으나 합성 fixture로 생성됐고 실제 계정·운영 DB는 사용하지 않았다. 잔여 위험 때문에 공개 저장소에는 올리지 않는다.

## 10. 집 PC 복원

### Git으로 복원

```powershell
git clone https://github.com/school-health-hub/BOGUNON_DESK.git
Set-Location BOGUNON_DESK
git switch integration/electron-feature-baseline
git fetch origin integration/electron-feature-baseline
git rev-parse HEAD
git rev-list --left-right --count HEAD...origin/integration/electron-feature-baseline
npm ci
```

검증 Source SHA `0a972cd6812927ff01415df445fc31e212397ed5`가 필요하면 `git switch --detach 0a972cd6812927ff01415df445fc31e212397ed5`로 고정한다. 정상 재개는 최신 브랜치 HEAD에서 수행한다.

확인한 학교 PC 버전은 Node `v22.23.3`, npm `10.9.9`, Electron `45.2.1`, Docker Desktop Engine `29.8.0`이다.

### Git으로 복원되지 않음

집 PC에서 위 archive를 승인된 보안 수단으로 받은 뒤 다음을 수행한다.

```powershell
$archive = '<승인된 전송 위치>\SCHOOL_WORKSPACE_20261109_HANDOFF_0a972cd.zip'
(Get-FileHash $archive -Algorithm SHA256).Hash
# 기대값: 998DAA096E5A7C8A498FAB65435EA8D94D98B8ED88F7A224536504E26B6CF089
Expand-Archive $archive -DestinationPath '<격리된 복원 폴더>'
# SHA256-MANIFEST.tsv를 사용해 각 파일 해시를 다시 비교한다.
```

학교 PC 절대경로는 provenance 기록일 뿐 실행 입력으로 재사용하지 않는다. 새 PC에서는 clone root, `%TEMP%` QA root 및 증거 출력 경로를 새로 계산한다.

## 11. 다음 작업 우선순위

1. 학교 PC의 ZIP과 `.sha256` 파일을 사용자가 승인한 비공개 전송 수단으로 집 PC에 복사하고 archive SHA를 비교한다.
2. 집 PC에서 Git HEAD/upstream, Node/Electron/Docker/PostgreSQL 17 조건을 확인한다.
3. 일정 물리 삭제가 실제 요구인지 결정한다. 필요하면 현재 `CANCELLED` 감사 이력 계약과 별도 승인된 설계를 먼저 작성한다.
4. 운영 전에는 별도 승인 아래 운영 DB 호환성·백업·복구, Trusted MFA 서버 권한, 실제 배포 경계를 검증한다.

## 12. 인계 판정

- Git 소스: 원격 복원 가능
- QA fixture·하네스: Git 복원 가능
- 원본 화면·실행 증거: 학교 PC 로컬 복사 및 SHA 검증 완료
- 집 PC 전달·복원: 미실행

따라서 현재 전체 인계 판정은 **BLOCKED**다. 차단 조건은 코드가 아니라 승인된 PC 간 전송 경로가 없어 원본 증거 archive가 집 PC에서 접근 불가능하다는 점이다. ZIP과 `.sha256`을 승인된 보안 수단으로 옮기고 집 PC에서 해시를 확인하면 이 조건을 해소할 수 있다.
