# BETA13-VERSION-01 — Electron 후보 버전 검증

## 기준과 판정

| 항목 | 결과 |
| --- | --- |
| 시작 제품 Source SHA | `98f39f1467bf20a22e1ba182391fbd1c7e05155f` |
| 설치 사전 조사 | `d443876618f4b4869950c0bb3a0bab9a626a9224`, INSTALL QA HOLD |
| 최종 제품 Source SHA | `2e8247f1b1a2961e80ed61bb15b252d27016b8ab` |
| 전용 브랜치 | `codex/beta13-version-01` |
| 버전 메타데이터 | PASS |
| 설치·업데이트·롤백 준비 | CONDITIONAL. 격리 설치에 필요한 승인과 현장 검증이 남아 있다. |

제품 변경은 `electron-p0/package.json`의 `version` 한 줄이다. 루트 npm 패키지와 lockfile은 별도 버전을 사용한다. 기존 Tauri 릴리스 가드 `release:version:check`는 루트 package/Tauri/Cargo의 일치 여부를 검사하므로 이번 Electron 후보의 판정에 사용하지 않았다.

## 버전 일치

| 확인 지점 | 결과 |
| --- | --- |
| Electron 소스 및 프로덕션 빌드 manifest | 두 곳 모두 `2.0.0-beta.13` |
| 빌드 출처 | `build-meta.json`의 Source SHA가 제품 커밋과 일치, `dirty: false` |
| Electron runtime | Windows Electron에서 `app.getVersion()`이 `2.0.0-beta.13` |
| Settings → 앱 정보 | 실제 창의 내부 베타 버전과 앱 업데이트 현재 버전 모두 `2.0.0-beta.13` |
| electron-builder 입력 | `builder.json`이 가리키는 빌드 manifest를 설치된 builder의 `AppInfo`로 읽음. `version`과 `buildVersion` 모두 `2.0.0-beta.13`, 기존 prerelease channel `beta`. 기존 파일명 템플릿이 `${version}`을 사용한다. |
| 업데이트 계약 | 실제 빌드의 `compareUpdateVersions`에서 beta.13 대 beta.12는 1, 역순은 -1, 동일 버전은 0. 런타임 업데이트 서비스의 현재 버전 소스는 `app.getVersion()`이다. |
| 실제 설치 파일·피드 | NOT RUN. 설치 파일의 Windows 버전 리소스, 서명, 배포 메타데이터, 실설치 결과는 후보 제작 후 검증한다. |

## 회귀 및 증거

- 학교 PC Windows, 연결된 1920×1080 화면 2대, Node 22.23.3, npm 10.9.9, Electron 45.2.1. QA는 전용 worktree와 합성 데이터 및 임시 QA 프로필을 사용했다.
- `npm ci` PASS. 기존 lockfile 그대로 설치했으며 npm은 취약점 알림 11개(중간 8개, 높음 3개)를 출력했다. 의존성 변경은 이번 버전 커밋의 범위 밖이다.
- `npm run electron:p0:build` PASS. Electron main·renderer·tests TypeScript 및 프로덕션 렌더러 빌드를 포함한다. QA 빌드에는 공개 인증 설정이 없어 로그인이 비활성화됐다.
- Vitest 12개 파일, 93/93 PASS. Newsletter 닫기 보호와 출력, Palette·Dock·화면 배치, 저장 계약, 업데이트 격리 테스트를 포함한다.
- Windows Playwright 2/2 PASS. 기존 `desktop-board-bounds.e2e.ts`의 임시 사본에 버전 및 앱 정보 단언을 추가해 실행했다. Dock을 포함한 Palette 경계, 화면 배치 적용·취소·기본 복원, 보조 화면 대상 전환, 정상 종료 및 재실행 뒤 프로필 복원을 검증했다.
- `ux-cleanup-03-output.e2e.ts`에서 합성 Newsletter 미저장 닫기 보호, 저장 원고 재열기 및 A4 PNG/PDF 출력 PASS.
- 앱 정보 캡처는 QA worktree의 로컬 `artifacts/version-gui/` 하위에 보관했다. 파일명 `beta13-about.png`, SHA-256 `62e3f568418520474986026b033ff7b3095144ed3fb4d40e1cc66a45704557cf`. 캡처와 임시 테스트 사본은 원격 커밋에 포함하지 않는다.

## 다음 승인과 Git 인계

- 앱 ID, 사용자 데이터·설치 경로, 채널 및 기존 운영 beta.12에 변경을 가하지 않았다. NSIS 제작·설치·업데이트·롤백은 NOT RUN이다.
- NSIS 후보 제작 전에 격리 Windows 계정 또는 VM을 확정하고 별도 제작·설치 승인을 받는다. 승인 후 이 제품 SHA에서 만든 패키지의 버전·서명·SHA-256과 피드 메타데이터를 대조하고, 합성 beta.12 프로필 백업을 준비해 업데이트·취소·실패 복구를 검증한다.
- 제품 커밋과 이 QA 문서 커밋을 구분한다. 원격 문서 HEAD는 push 후 `git ls-remote origin refs/heads/codex/beta13-version-01`로 확인하고, `git rev-list --left-right --count HEAD...@{upstream}`과 `git status --short` 결과는 최종 보고에 기록한다.
