# INT-5C-5 학교 PC 인계 — 2026-10-30

## 재개 지점과 승인 범위
Repository: https://github.com/school-health-hub/BOGUNON_DESK.git
Branch: codex/int5c5-finance-hover-contrast
CSS 구현 커밋: 1a95ee500e5cbfed8d6c5e4162cd70968698d56f
기준 제품: 32d40c1769b587f917416f17bc588d7e62d7084f
보호된 integration: d6b44aaeea1f0c027ade05ef34070bb888a66ece
이 문서가 포함된 브랜치의 최종 인계 HEAD는 git rev-parse HEAD로 확인한다. CSS 구현 커밋과 문서 체크포인트를 구분한다. 최종 전체 HEAD는 집 PC 종료 보고에도 기록한다.

오늘은 CSS 한 건과 인계 보존까지만 완료했다. 내일의 Windows CI/controller 변경·dispatch·integration 반영은 계획이며 오늘 자동 실행하지 않았다. 추가 개발을 시작하기 전에 학교 PC 상태와 해당 실행 승인 범위를 확인한다.

## 구현과 검증의 분리
- 실제 제품 변경: src/my-finance/finance.css 한 줄 추가.
- selector: .finance-screen :is(.finance-area-tabs,.finance-phase2-tabs) button:not(.is-active):hover:not(:disabled)
- enabled 비선택 hover 글자색만 #34445d로 변경. Finance 기존 기본 버튼 글자색 재사용, 배경 #eef3f9 그대로.
- 기존 실제 computed 값 #617187/#eef3f9 =4.460370414981981:1.
- 새 소스 색상의 정적 WCAG sRGB 계산 =8.833525799976249:1 (목표5.0 이상).
- 새 SHA의 실제 computed style/화면 대비: NOT RUN. 정적 계산을 실화면 PASS로 표시하지 않는다.
- 선택 기본/hover/focus는 selector에서 제외, outline 규칙 그대로. 이전 SHA에서9.545947620992006:1이었으나 새 SHA 검증 결과로 재사용하지 않는다.
- 비선택 기본/focus(hover 없음), disabled, 레이아웃·폰트·문구·전역 토큰 변경 없음.
- Purchase 정산 select, 공문 도움말, Finder 접근성, Dashboard, 데이터/암호화/저장/IPC 변경 없음.
- diff --check, 전체 한 줄 diff 검토, 변경 CSS 전체 비밀값 패턴 검사: PASS/0건. 두 독립 정적 검토 차단 지적 없음. 전용 secret/PII scanner의 완전 탐지를 주장하지 않는다.
- TypeScript/집중 테스트/build/전체 회귀/6상태×4viewport 새 캡처: NOT RUN. RAM 약0.83GiB/C: 약84MiB로 로컬 실행하지 않았다.

## 필요한 자료 및 보존 경로
|의존 자료|분류/복원 방법|
|---|---|
|제품 소스·테스트·package/lock·설정 예시·DESIGN.md|이 전용 브랜치에서 tracked and pushed 확인 대상|
|현재 판단·다음 단계·정적 대비|이 문서 및 contrast-static.json, 비밀값 없는 Git 인계 패키지|
|직전 Windows CI/controller|codex/int5c3-windows-qa, SHA6b209139adde3aa1c5d502c9a2f05c03e07c42bb; tracked/pushed|
|직전 실제 화면40장/DOM40개/로그/cleanup/해시/provenance|아래 GitHub Artifact 원본 ZIP. 집 PC에서 다운로드 및 ZIP/101파일/40이미지 hash 검증 완료|
|집 PC 인덱스·merge·dirty 상태 조회 기록/프로세스 목록|집 PC E:의 int-5c-5/control에만 보존. 학교 재개 실행에 필요한 입력 아님. 원격에 개인정보가 포함될 수 있는 전체 작업 목록을 올리지 않음|
|INT-5C-1~5C-4 로컬 분석 보고서|집 PC E: 원본 보존, 전체 복사하지 않음. 다음 Finance 검증에 필요한 결론은 이 문서에 수록. 원본 보고서/다른 기능 작업을 학교에서 전체 복구했다고 주장하지 않음|
|node_modules/cache/dist/브라우저/임시 profile|이전 PC의 파일·링크가 필요하지 않음. 승인된 원격 일회성 러너에서 lockfile 기반 재생성. 기존 공유 링크를 복사하지 않음|
|secrets/운영 계정/실데이터|필요 없음. GitHub Artifact 접근/추후 dispatch용 개인 GitHub 인증은 학교 PC에서 gh auth status로 확인, 토큰 복사/출력 금지|

직전 Run40935724983: https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/40935724983
Artifact12924692556: https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/40935724983/artifacts/12924692556
ZIP SHA256: 8782a6832dd8889887ad39fc1607815ad57f57fc7da82a6c6926de270dcbef0d
만료: 2026-11-05T19:01:20Z (만료 전 내려받아 보존; 만료 후 집 PC E: 원본의 별도 승인된 전송 필요).
원본 내부 SHA256SUMS.txt 101파일, captures.json 40이미지 해시 검증, 불일치0.
집 PC 원본: E:/BOGUNON_DEV/qa-output/int-5c-4/artifact.zip 및 artifact/.
이 Artifact는 제품32d40c의 변경 전 근거다. 1,556 PASS/52집중 PASS/TypeScript/build PASS도32d40c 결과이며 새 SHA 결과가 아니다.
기존 화면에서 선택Finance9.546 PASS, 비선택hover4.460 FAIL, Purchase4상태/공문줄바꿈/보이는Dashboard smoke는4viewport PASS. NativeFinancePhase2는snapshot 부재로NOT RUN. 이번40장 원본은 수정하지 않았다.

## 학교 PC의 안전한 복원 예시 (기존 경로 재사용/덮어쓰기 금지)
학교 경로를 집 PC와 같다고 가정하지 않는다. 먼저 새 비어 있는 전용 경로를 선택하고 원격 HEAD를 조회한다. 아래 `<NEW_UNUSED_PATH>`는 실제 미사용 경로로 바꾼다.

```powershell
git ls-remote https://github.com/school-health-hub/BOGUNON_DESK.git refs/heads/codex/int5c5-finance-hover-contrast
git clone --single-branch --branch codex/int5c5-finance-hover-contrast https://github.com/school-health-hub/BOGUNON_DESK.git <NEW_UNUSED_PATH>
Set-Location <NEW_UNUSED_PATH>
git rev-parse HEAD
git status --porcelain=v1
git rev-list --left-right --count HEAD...origin/codex/int5c5-finance-hover-contrast
git diff 32d40c1769b587f917416f17bc588d7e62d7084f HEAD -- src/my-finance/finance.css
Get-Content docs/handoff/int5c5/contrast-static.json
```

HEAD는 종료 보고의 전체 SHA와 대조하고 status 비어 있음/divergence0·0을 확인한다. 학교 PC의 AGENTS.md/AGENTS.override.md도 확인한다. 학교 PC 실기를 이번 종료 점검에서 조작하거나 검증하지 않았다.

Artifact 복원(새 출력 경로, gh 인증 확인 후, 설치나 QA 실행 없음):
```powershell
gh auth status
gh run download 40935724983 --repo school-health-hub/BOGUNON_DESK --name int5c3-module-ui-frontend-32d40c1-40935724983-1 --dir <NEW_UNUSED_EVIDENCE_PATH>
```
받은 뒤 SHA256SUMS.txt와 captures.json을 검증한다. ZIP 자체를 받으면 위 ZIP digest와도 비교한다. Artifact가 만료되거나 접근 불가하면 이전 상태 비교 QA를 시작하지 말고 집 PC 원본의 승인된 전송을 준비한다.

## 다음 Windows CI/시각 QA 계획 (오늘 실행하지 않음)
Node22.23.3/npm10.9.9, 표준 windows-2022, worker1, 모든 단계 직렬. 운영 secrets/실데이터 없음. 새 제품 전체SHA를 고정하고 실제HEAD/lockfile불변 확인.
기존 workflow/controller는32d40c에 고정되어 있다. 새 SHA를 검증한 결과로 오인하지 않는다. 기존 workflow를 덮어쓰지 말고 새 QA 실행 방식 및 필요한 등록 승인부터 확인한다. 오늘 새 workflow는 작성하지 않았다.
1. npm ci --no-audit --no-fund
2. ./node_modules/.bin/tsc --noEmit
3. npm test -- src/my-finance/FinanceScreen.test.tsx src/my-finance/Phase2Workspace.test.tsx --maxWorkers=1 --no-file-parallelism
4. npm run build
5. 980×700/1280×720/1366×768/1440×900: 각각 선택 rest/hover/focus-visible, 비선택 rest/hover/focus-visible를 실제DOM과 이미지로 보존한다. 비선택hover5.0:1 이상, 일반text최소4.5:1. 반투명 배경은 실제 합성색을 측정하고 미측정null을PASS로 바꾸지 않는다. NativeFinancePhase2가 실제 표시되지 않으면NOT RUN.
6. 새SHA 전체회귀가 필요하면 같은Windows구조에서worker1로 실행한다. 이전1,556PASS를 새SHA 결과로 기록하지 않는다.
7. Purchase/공문/Dashboard/Finder는 코드불변과 필요한smoke를 확인한다. Artifact/provenance/이미지해시/cleanup 및 독립 화면 검토 기록을 보존한다.

## integration 반영 조건
새제품SHA의 필요한CI/build/실제6상태×4viewport/대비가 통과하고, Native미검증 범위를 명시한 승인이 필요하다. integration최신HEAD/clean/조상관계/승인diff만유입/다른worktree merge보호를 재확인하고 별도 반영 승인 후에만ff-only를 검토한다. 오늘 integration/main변경, PR, 배포는 하지 않는다.

## 종료 판정
구현은WIP보존, 실제화면은NOT RUN. Git동기화와 PC인계 판정을 구분한다. 집PC에서 새disposable clone과 의존자료의 비파괴inventory를 확인하고 최종결과를 종료보고에 기록한다. 학교PC의 인증/디스크/RAM/전역규칙은 수신 시 재확인한다. 다른 활성 세션/프로세스는 종료하지 않으며 그 작업 전체의 보존완료를 이 문서에서 보증하지 않는다. PC전체 종료/재부팅은 수행하지 않는다.