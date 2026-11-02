# IM-2A QA 결과

## 자동 검증

재시작 후 최종 작업물 기준으로 다음을 순차 실행했다.

| 검증 | 결과 |
|---|---|
| 집중 Vitest | PASS — 6 files / 77 tests |
| TypeScript `npx tsc --noEmit` | PASS |
| 전체 Vitest | PASS — 185 files / 1,253 tests |
| Production build | PASS — 2,155 modules transformed |
| `git diff --check` | PASS |
| ESLint | NOT AVAILABLE — 저장소 script/dependency 없음, 신규 설치 안 함 |

전체 회귀 후에는 CSS badge 정렬만 보완됐다. 그 뒤 집중 77 tests, TypeScript, production build, diff check를 다시 통과했다. 빌드의 500 kB 초과 chunk 경고는 기존 bundle 구조에 대한 비차단 경고이며 IM-2A에서 의존성/분할 구조를 변경하지 않았다.

## 테스트 범위

- 합성 selector: 총재고/가용재고, 임박 90일 경계, 만료일 당일, 만료·격리·0 잔량 제외
- adapter: 잘못된 ID/lot, 공백 사유, unsafe integer, 변환 overflow, 초과 사용·폐기, fresh clone
- UI: 목록, 검색, 필터 후 상세 대상 전환, 모든 상태 화면
- 업무 dialog: 입력 mapping/validation, preview-only 문구, Escape, 포커스 trap/restore
- registry/navigation: Toolbox health category, command palette, action ID, 기존 패널과 상호 배타성

## 브라우저 QA

최종 CSS revision의 유효 캡처는 `.omo/evidence/im-2a/screenshots-final-resume/`에 있다. 1440×900 및 900×680에서 panel/dialog가 viewport 안에 들어오고, 좁은 화면은 내부 세로 스크롤을 사용한다. 900px viewport에서 `scrollWidth=900`을 확인했고 상태 badge는 79.25×26px로 늘어나지 않았다. 첫 시도의 onboarding overlay가 포함된 `.omo/evidence/im-2a/screenshots/`과 이전 revision의 `screenshots-final/`은 최종 근거에서 제외한다.

브라우저 시각 QA는 `PASS`다. Native 980×700은 별도 실행 환경을 기동하지 않아 `NOT RUN`이다. 따라서 브라우저 합성 UI 검증은 `READY`지만, 사용자 판정 기준상 IM-2A 전체는 Native QA 미완료로 `CONDITIONAL`이다.

## 보안·범위 검사

전용 secret scanner(`gitleaks`, `trufflehog`, `detect-secrets`)는 설치되어 있지 않았다. 변경 대상에 정규식 기반 best-effort 검사를 수행했고 private key, JWT, secret/password assignment, email, 전화번호, 주민번호, 운영 Supabase ref, 실제 학교명 패턴 hit는 없었다.

다음 보호 경로의 diff는 비어 있다.

- `src/dock/`
- `src-tauri/tauri.conf.json`
- `src/components/desktop/PurchaseHelperPanel.tsx`
- `src/purchase/`
- `inventory-management/qa/` SQL/RPC/migration
- `package.json`, lockfile

운영 Supabase/RPC 실행, Docker 변경, 실제 학교 데이터 사용, 다른 worktree 쓰기, push/PR/배포는 0건이다.

## Native 증거 마감

- 제품 기능 개발: 없음
- 전체 회귀 재실행: 없음
- 캡처 자동화 초기화: 2/2 FAIL (`kernel assets` 경로 오류)
- 신규 Inventory Native 캡처: NOT RUN
- 기존 Native 기능 직접 검증: PASS 유지
- 다른 앱·프로세스·worktree 변경: 없음
- 최종 판정: `CONDITIONAL`
