# BETA13-UPDATE-01

## 기준 및 보호 범위

- 제품 Source SHA `2e8247f1b1a2961e80ed61bb15b252d27016b8ab`, 버전 `2.0.0-beta.13`.
- F: 격리 worktree의 `codex/beta13-update-01`에서 코드 변경 없이 생성했다. 설치된 beta.12의 app.asar 출처는 `18c0c2c938cd524bb1e904a5f704a617cfd13b25`다.
- 운영 앱의 설치·종료·업데이트·삭제, 운영 프로필 파일 열기·복사, 새 Windows 계정·VM, 원격 업로드 및 공개 릴리스는 실행하지 않았다.

## 판정 및 배포 파일

**로컬 패키지 및 beta.12 업데이트 계약 PASS. 배포 준비 CONDITIONAL.** 게시 승인, 게시 후 원격 자산 확인, 실제 설치·복구 검증이 남았다.

| 항목 | 값 |
| --- | --- |
| 로컬 출력 | `F:/BOGUNON_DEV/source/beta13-update-01/release-electron-p0/` |
| NSIS 설치 파일 | `BOGUNON-DESK-Setup-2.0.0-beta.13-x64.exe` |
| 크기 | 215,200,706 bytes |
| EXE SHA-256 | `a87739e573fe9080713fcd8ea6da3a902449c487b093c5b4067df451c11611d2` |
| 업데이트 매니페스트 | `bogunon-update.json`, schema 2, beta, 679 bytes |
| 매니페스트 SHA-256 | `c428688169caca772e0fdaea107de5961ba85ccfbf2c7a5cd5dfe87c5e6b07e4` |
| 서명 유효 기간 | 2026-11-27 02:22:33 UTC부터 2026-12-27 02:22:33 UTC까지 |
| 예정 다운로드 URL | `https://github.com/school-health-hub/BOGUNON_DESK/releases/download/v2.0.0-beta.13/BOGUNON-DESK-Setup-2.0.0-beta.13-x64.exe` |
| 예정 매니페스트 URL | `https://github.com/school-health-hub/BOGUNON_DESK/releases/download/v2.0.0-beta.13/bogunon-update.json` |

- Electron 45.2.1, electron-builder 26.18.0. 고정 npm·Cargo lockfile로 프로덕션 앱 및 네이티브 도구 5개를 빌드하고 기존 NSIS 설정에 `--win nsis --x64 --publish never`를 적용했다.
- NSIS 안의 `app-64.7z`에서 앱을 추출해 PE 아키텍처 x64와 FileVersion `2.0.0-beta.13`을 확인했다. 설치 EXE도 FileVersion 및 ProductVersion이 `2.0.0-beta.13`이다. 내부 ASAR의 package version과 빌드 Source SHA가 일치하고 `dirty:false`였다. 기존 설치본의 공개 인증 설정과 업데이트 피드 설정을 재사용했고, 비밀 값을 출력하지 않았다.
- 기존 Windows 사용자 보호 저장소의 Ed25519 키를 사용했다. 설치된 beta.12에서 읽기 전용으로 추출한 업데이트 모듈이 모의 GitHub 카탈로그에서 beta.13을 발견하고 매니페스트를 검증했다. 변조된 해시는 서명 검증에서 거절됐고, 실제 EXE 바이트는 다운로드 단계의 크기·SHA-256 검사를 통과했다. 배포 URL의 실제 다운로드와 NSIS 실행은 NOT RUN이다.
- Windows Authenticode는 기존 builder 설정에 따라 `NotSigned`다. 설치된 beta.12의 beta 피드는 게시자 고정을 사용하지 않으며 schema 2 Ed25519 서명과 바이트 검증을 요구한다. Windows 정책·SmartScreen에서 실제 설치를 허용하는지는 확인하지 않았다.
- 게시용 파일은 EXE, `bogunon-update.json`, `SHA256SUMS.txt`, `RELEASE-NOTES.txt` 네 개다. builder가 만든 blockmap은 기존 전체 파일 업데이트 계약에서 참조하지 않는다. 서명 만료 뒤나 EXE 수정 후에는 매니페스트를 다시 서명하고 대조해야 한다.

## 기존 beta.12 계약

- 설치 앱의 manifest 및 FileVersion은 `2.0.0-beta.12`다. 앱에 내장된 beta 피드와 공개키는 후보의 설정과 일치한다.
- 공개 API의 `v2.0.0-beta.12`는 `prerelease:true`, `immutable:true`, `draft:false`였고 기존 schema 2 매니페스트 서명이 검증됐다. 확인 당시 beta.13은 게시되지 않았다.
- 기존 앱은 버전이 높은 불변 prerelease의 매니페스트와 설치 파일 자산명을 검사한다. 서명된 버전·채널·URL·크기·해시·유효 기간을 검증한다. 다운로드 후와 설치 직전에 크기·SHA-256을 다시 확인한다.
- 설치 승인은 별도 단계다. 정상 종료 경로에서 데이터 flush를 진행한다. 설치 helper는 앱 PID 종료를 기다리고 바이트를 재검증한 후 NSIS를 실행하며, 설치된 앱의 FileVersion과 종료 코드를 검사한다.

## 백업과 복구

- 기존 프로필은 `%APPDATA%/BOGUNON-DESK-ELECTRON-P0`이다. 승인된 업데이트 직전 작업을 저장하고 앱을 정상 종료한 뒤, `poc-settings`, `work-data`, `chromium`, `update-downloads`를 포함한 전체 프로필을 암호화된 로컬 위치에 복사한다. 사용자가 별도 경로에 저장한 Newsletter JSON·내보내기 문서는 따로 목록에 포함한다.
- 복사 전후 상대 경로·크기·SHA-256 목록을 대조하고, 별도 위치에 복원한 사본도 비교한다. 합성 파일로 원본·백업·복원 SHA-256 일치 5/5 PASS. 실제 운영 백업은 NOT RUN.
- 실패 시 승인된 로컬 위치에 설치 상태와 `update-downloads/last-install-result.txt`를 보존한다. 앱이 모두 종료된 뒤 기존 바이너리 버전을 확인하고, 필요한 경우 검증된 beta.12 설치 파일과 해당 백업으로 복구한다. 먼저 실패 당시 프로필을 옆에 보존한다. 같은 Windows 사용자·PC에서만 보호 데이터 복구를 검증한다. 앱에 데이터 자동 롤백은 없다. 실제 복구·재설치 NOT RUN.
- Windows 격리 프로필의 실제 앱 정상 종료·재실행 후 화면 배치 및 위젯 프로필 복원 1/1 PASS. 업데이트 서비스 29/29, 서명 키 저장·복구 2/2 PASS.

## 게시 단계

별도 승인 후 정확히 검증한 설치 EXE, `bogunon-update.json`, `SHA256SUMS.txt`, `RELEASE-NOTES.txt`를 `v2.0.0-beta.13` draft에 연결하고, 서명 만료와 버전별 URL을 확인한다. 기존 규격대로 불변 prerelease로 게시한다. 게시 후 GitHub API에서 태그, 불변 플래그, 자산명·상태·URL 및 다운로드 해시를 대조한다. 이 작업에서는 로컬 아티팩트만 생성한다.

## 최종 Git 상태

`codex/beta13-update-01`의 HEAD는 제품 Source SHA와 같다. upstream이 없는 로컬 브랜치이고, 제품과 lockfile에는 변경이 없다. 이 보고서만 미추적 상태로 남겼다. 후보·키·생성 로그는 Git에 추가하지 않았다.
