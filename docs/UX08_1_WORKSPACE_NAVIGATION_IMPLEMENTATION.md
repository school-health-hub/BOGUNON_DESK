# UX-08-1 Dock·Palette·Workspace 실제 UI 개선 인계

## 판정

- 공통 Workspace 헤더 구현: **PASS**
- 공문작업실 공통 헤더 연결 및 close guard: **PASS**
- Newsletter 5단계 presentation primitive: **PASS / 실제 편집기 연결 NOT RUN**
- Windows Electron GUI: **PASS WITH CONDITIONS**
- main 병합·운영 배포: **NOT RUN**

기준 Source는 BRAND-01 `e2f5df7b9a6b3f31a35d79c39f061228b0a0c92e`다. UX-08-1은 이 SHA에서 분기한 `codex/ux-08-1-workspace-navigation`의 F: 격리 worktree에서만 수행했다.

## 1. 실제 수정한 화면과 컴포넌트

- `WorkspaceHeader`를 shared `src/components/workspace` 계층으로 옮겼다. Electron 기존 import 경로는 compatibility re-export를 유지한다.
- 헤더는 공식 브랜드 identity, 현재 모듈 제목, 문맥·설명, 기존 owner의 뒤로가기, 핵심 actions를 표현한다. 라우팅·상태·저장·focus owner는 새로 만들지 않았다.
- SchoolAdmin의 기존 호출 방식은 유지했다.
- 공문작업실은 shared header를 사용하며 `td2-workspace-header od-header` 호환 class로 기존 scoped CSS를 유지한다.
- 작은 창에서는 브랜드/문맥/작업 영역이 자연스럽게 줄바꿈되며 fixed minimum width를 추가하지 않았다.

제품 기능 코드는 공통 헤더와 공문 헤더 표현 범위에만 한정했다. Dashboard, 업무 도구함, Settings, Dock은 QA surface이며 런타임 코드를 바꾸지 않았다.

## 2. UX-08 시안 대비 결과

UX-08의 핵심 결론인 “전역 상시 좌측 메뉴가 현재 제품의 일반 구조가 아니다”를 유지했다.

- Dashboard: 독립 위젯 canvas와 하단 Dock 유지
- 업무 도구함: 기존 overlay와 카탈로그 역할 유지
- Workspace: 브랜드·현재 모듈·주요 작업이 읽히는 공통 상단 구조 적용
- 공문작업실: 기존 2열 편집/미리보기와 업무 tabs 유지, 980px 이하에서 1열 reflow 확인
- Settings: 설정 전용 내부 navigation 유지; 일반 Workspace로 복제하지 않음
- Newsletter: 5단계 구조는 독립 primitive까지만 준비하고 실제 편집 화면에는 표시하지 않음

Dock을 Workspace 안에 복제하거나 새 전역 메뉴를 만들지 않았다.

## 3. Dock·Palette·Workspace·Settings 역할 유지

- **Dock:** Desktop의 모듈 실행·복귀 진입점으로 유지했다. `AppDock`, registry, 저장 순서, active 표시를 변경하지 않았다.
- **Palette:** 독립 위젯, click-through, 투명도, Main-only IPC, 모니터별 위치·프로필을 변경하지 않았다.
- **Workspace:** 본격 편집 영역이며, 새 공통 헤더는 presentation-only다. module owner의 state와 cleanup callback을 그대로 사용한다.
- **Settings:** 독립 modal과 설정 전용 navigation, focus trap/restore를 유지했다.

업무 도구함·Settings·Dock 관련 기존 집중 회귀는 5개 파일 28개 테스트가 통과했다.

## 4. Newsletter 보류 영역과 NS-05 경계

`WorkspaceStepBar`는 다음 presentation 상태만 받는 generic component다.

- ordered steps
- current/completed/available/disabled
- `aria-current="step"`
- 잘못된 active id의 안전한 fallback
- 작은 창의 `현재 단계 n/total` 요약과 component-local 가로 scroll

`월 선택 → AI 제작 → 원고 검토 → 디자인 편집 → 출력` 라벨은 테스트 fixture와 본 문서에만 있다. production caller는 0개다.

다음은 수정하거나 연결하지 않았다.

- `NewsletterStudio`와 newsletter CSS/rendering
- revision·project save·image hash·keep-alive
- Electron Newsletter adapter/AI renderer
- NS-05 provider, vault, protocol, preload, IPC

NS-05는 동시 개발 중이며 최종 read-only 관찰 시 `13 tracked + 26 untracked`였다. 이 수치는 동시 작업으로 계속 변할 수 있으며, 상태만 기록했을 뿐 파일 내용·staging·cleanup에는 접근하지 않았다. 단계 바 연결은 NS-05 통합 완료 후 별도 작업으로 남긴다.

## 5. 공식 BOGUNON DESK 로고 보존

- 헤더 identity는 기존 `BrandLogo` component를 재사용한다.
- 로고·심볼 raster, ICO/ICNS, Dock home symbol, package icon을 변경하지 않았다.
- BRAND-01 manifest의 source 및 file SHA-256 검증은 모두 통과했다.
- Windows 캡처에서 Dashboard/Workspace, Dock, Settings, 공문작업실의 공식 브랜드 표시를 확인했다.

단, 이 격리 worktree의 기존 `docs/evidence/brand01/*.png` 4개가 QA 시간대에 예상 밖으로 변경됐다. UX-08 harness는 해당 경로를 참조하지 않으며 실제 writer 소유권을 입증하지 못했다. 보호 원칙에 따라 네 파일은 복구·편집·staging·commit 대상에서 제외했다. BRAND 제품 자산 및 product references는 변경되지 않았다.

## 6. 실제 Windows GUI 검증

F:의 isolated Electron profile과 TEMP/TMP/cache만 사용했다. 실제 content viewport와 Windows native outer bounds를 구분해 manifest에 기록했다.

| Content viewport | Windows outer bounds | 결과 |
| --- | --- | --- |
| 1440×900 | 1456×965 | PASS |
| 980×700 | 996×765 | PASS |
| 900×680 | 916×745 | PASS |

각 크기에서 Dashboard+Dock, 업무 도구함, Settings, 공문작업실을 캡처해 총 12개 PNG를 만들었다.

- 모든 화면에서 `scrollWidth <= innerWidth`
- renderer error 0건
- 전역 좌측 navigation 없음
- Settings에는 의도된 설정 내부 navigation만 존재
- 공문 헤더의 공식 로고, 뒤로가기, 제목, 상태, 핵심 action 접근 가능
- 980×700과 900×680에서 공문 입력 영역 1열 reflow
- 한글/CJK clipping·겹침 없음
- dirty 공문에서 닫기 취소 시 입력과 Workspace가 유지됨

두 독립 visual review가 12/12 PASS를 반환했다. 캡처와 SHA-256, geometry는 `docs/evidence/ux08-1-workspace-navigation/manifest.json`에 있다.

승인 범위·정확한 검증 명령·독립 검토 역할과 결과·정리 상태·보안 점검 한계·fresh-clone 재현 절차는 휴대 가능한 [`REVIEW_RECEIPT.md`](./evidence/ux08-1-workspace-navigation/REVIEW_RECEIPT.md)에 함께 보존했다. 로컬 `.omo` 기록 없이도 원격 branch에서 검토 맥락을 복원할 수 있다.

## 7. 테스트·TypeScript·빌드

- 공통 헤더 집중 테스트: 7/7 PASS
- 공문/File Drop/AI 집중 테스트: 3 files / 24 tests PASS
- 최종 UX-08-1 집중 테스트: 5 files / 34 tests PASS
- 보호 surface 회귀: 5 files / 28 tests PASS
- Root TypeScript: PASS
- Electron renderer TypeScript: PASS
- Root production build: PASS
- Electron production build: PASS
- Windows Playwright UX-08-1 harness: PASS
- `git diff --check`: PASS

최초 GUI harness 실행은 QA run id 앞에 prefix를 붙여 기존 raw UUID 계약을 위반해 창 실행 전에 실패했다. product runtime은 바꾸지 않고 새 UX-08 harness의 run id를 `randomUUID()` 원문으로 고친 뒤 최종 실행이 통과했다.

검증 당시 Node는 `v22.23.3`, npm은 `10.9.9`였다. 실행 직전 C: 여유 공간은 약 4.64GiB였고, 커밋 직전 재확인 시 약 2.67GiB였다. F: 여유 공간은 약 255GiB였다. build/cache/profile/evidence는 가능한 범위에서 F:를 사용했다.

## 8. 제품 Source SHA

- UX-08 설계 기준: `19daed8689e6e06000d6d7367525b89d6abeca53`
- BRAND-01 및 UX-08-1 Source: `e2f5df7b9a6b3f31a35d79c39f061228b0a0c92e`
- 작업 branch: `codex/ux-08-1-workspace-navigation`

## 9. 최종 Git HEAD와 원격 보존

이 문서를 포함하는 commit은 자기 SHA를 문서 안에 순환 없이 고정할 수 없으므로, 정확한 최종 local/remote SHA와 divergence는 실행 결과 보고를 기준으로 한다.

- commit 메시지: `feat(workspace): implement UX-08-1 navigation chrome`
- force push: NOT RUN
- PR/main merge/deploy: NOT RUN
- 원격 branch push 후 local/remote SHA와 divergence `0/0`을 별도 확인한다.

원인 미확정 BRAND evidence PNG 4개와 F-local `.qa-temp` cache는 commit에서 제외하며, 이 때문에 local worktree는 remote checkpoint 이후에도 clean으로 보고하지 않는다.

보안 점검에는 전용 secret scanner 및 EXIF/OCR 도구가 없었다. 따라서 text pattern scan, 파일 해시·PNG signature, synthetic profile provenance, 독립 시각 검토를 사용했으며, PNG의 OCR/EXIF 재검사는 미수행 한계로 남는다. 또한 다른 PC의 fresh-clone 실행 검증은 수행하지 않았으므로 원격 보존 완료와 수신 PC 환경 검증을 구분한다.

## 10. 남은 통합 항목

1. NS-05 통합 완료 후 별도 승인으로 `WorkspaceStepBar`를 Newsletter owner에 연결한다.
2. 연결 시 기존 keep-alive·revision·project save·AI consent/approval 계약을 다시 검증한다.
3. 단계 바의 실제 Newsletter Windows 화면은 연결 전이므로 **NOT RUN**이다.
4. 원인 미확정 BRAND evidence PNG 4개는 별도 ownership 결정 전까지 복구·commit하지 않는다.
5. F-local `.qa-temp` cache는 build/QA 재현용으로 남겼으며 repository·remote에는 포함하지 않는다.

## 보호 및 cleanup 결과

- 기존 worktree reset/clean/stash: 0건
- NS-05 및 Newsletter 편집기 수정: 0건
- Dock·Palette·멀티모니터 runtime 수정: 0건
- 사용자/운영 profile 변경: 0건
- main 병합·운영 배포: 0건
- QA-owned Electron PID 1개만 command line을 재확인한 뒤 종료
- 이 worktree를 참조하는 Electron/Node/Playwright/Chrome 잔여 process: 0건
