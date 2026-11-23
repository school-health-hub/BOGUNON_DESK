# AUTO-UPDATE-04: 자체 서명 NSIS 업데이트 격리 검증

## 판정

2026-11-23 학교 PC의 독립 브랜치 `codex/auto-update-04`에서 **합성 NSIS A → B 업데이트 PASS**. 실제 설치된 BOGUNON DESK beta.5, 실사용 프로필, Windows 신뢰 저장소, 보안 정책, Google Drive 파일은 변경하지 않았다. 제품 운영 피드와 공개 Release는 계속 비활성 상태이며 실제 제품 업데이트는 **NOT RUN**이다.

## 신뢰 경계

- 이 제품은 `electron-updater`를 호출하지 않는다. Electron Main의 `UpdateService`가 고정 HTTPS 피드의 Ed25519 서명 JSON을 검증한다. `latest.yml` 및 electron-updater의 Authenticode 설정과 혼용하지 않는다.
- 신규 schema 2 서명 범위: schema, 채널, 버전, 변경 내용, 정확한 HTTPS NSIS URL, 파일 크기, SHA-256, 발행·만료 시각. GitHub 피드에서는 저장소·버전 태그·설치 파일명도 고정한다. 리디렉션은 기존 AUTO-UPDATE-03의 GitHub 자산 호스트 제한과 3회 상한을 유지한다.
- 서명 검증 후 다운로드를 해시하고 설치 동의 직전 다시 해시한다. 별도 Windows 헬퍼가 기존 앱 종료를 기다린 후 파일을 읽기 잠금으로 열어 SHA-256/크기를 재계산하고, 잠금을 유지한 채 NSIS를 실행한다. OS의 경고나 기관 정책을 해제하지 않는다.
- schema 1은 이전과 같이 Authenticode 게시자 핀이 있어야 앱 내 설치 가능하다. schema 2 자체 서명 경로에서는 Authenticode를 필수로 요구하지 않는다. 이는 Windows의 신뢰 표시를 대체하지 않는다.
- schema 2 메타데이터는 최대 30일 유효하며 확인한 최고 버전을 채널별 로컬 캐시에 기록해 이전 버전 재생을 거부한다. 만료 전 동일 버전 정보의 재생과 로컬 캐시 삭제 후 재생은 완전히 방지하지 못한다. 설치된 앱 버전으로의 다운그레이드는 별도로 거부한다.
- 키 교체는 새 공개키를 앱에 미리 포함한 전환 릴리스를 기존 키로 서명하고 배포한 뒤, 후속 릴리스에서 새 키로 서명하는 방식이다. 원격 메타데이터만으로 임의의 새 키를 신뢰하지 않는다. 기존 개인키 유출 시에는 앱 업데이트와 키 폐기가 필요하다.

## 실행 결과

별도 QA 식별자 `kr.sungandi.schoolhealthdesk.updateisolatedqa`, 프로그램명 `BOGUNON UPDATE ISOLATED QA`, 합성 프로필 `F:\BOGUNON_DEV\auto-update-04-qa\synthetic-profile`을 사용했다. 제품 appId, 설치 폴더, userData와 충돌하지 않는다.

| 항목 | 결과 |
| --- | --- |
| 합성 버전 A 사용자별 NSIS 설치 | PASS, `2.0.0-beta.90` |
| 합성 Ed25519 schema 2 확인·다운로드·크기·SHA | PASS |
| 설치 동의·기존 앱 종료 후 파일 잠금 상태 재검증 | PASS |
| 무인 NSIS 업데이트·앱 재실행·버전 B 확인 | PASS, `2.0.0-beta.91` |
| 합성 메모 SHA 보존 | PASS, `1704259B224F496AB4367B588F8BF77D2DEA8326E204CC52DBDBB197B3F5D981` |
| 변조 해시 거부·실패 시 이전 앱 유지 | 집중 테스트 PASS |
| 실제 beta.5 → 후속 제품 업데이트 | NOT RUN |
| 일반 사용자 Medium Integrity 및 학교별 SmartScreen 정책 | NOT RUN, 현 세션은 High Integrity |

합성 A NSIS: `F:\BOGUNON_DEV\auto-update-04-qa\release-a2\BOGUNON-UPDATE-QA-Setup-2.0.0-beta.90-x64.exe` (144,809,656 bytes, SHA-256 `C929738DBA5C1B25CE25B63A6256529F264DDA4A72499E125E1C8FE3CE0BC6BC`). 합성 B NSIS: `F:\BOGUNON_DEV\auto-update-04-qa\release-b\BOGUNON-UPDATE-QA-Setup-2.0.0-beta.91-x64.exe` (144,809,708 bytes, SHA-256 `92DA1534121A7218E2D607E3A15D33AC858DB237D702D0C1B5DDA2916617216F`). 이 파일들은 F: 로컬 QA 자산이며 GitHub에 업로드하지 않았다. 합성 앱 A/B를 만들기 위한 소스·builder 설정도 같은 F: 폴더에 보존했다. 합성 앱은 beta.91로 설치된 상태지만 QA 프로세스는 0개이다.

처음 실행은 NSIS 대화형 마법사에서 멈췄다. 사용자가 앱에서 설치를 승인한 뒤 NSIS `/S` 인자로 진행하도록 헬퍼를 수정하고 재검증하여 실제 A→B 전환에 성공했다. `/S`는 NSIS UI를 생략할 뿐 Windows의 보안 판단이나 관리자 권한을 우회하지 않는다.

## 코드와 검증

- 변경: `electron-p0/main/update-contract.ts`, `update-service.ts`, `main.mts`, 신규 `update-installer.ts`, 서명 스크립트, 런타임 패키지 검증, 집중 테스트 세 파일.
- 집중 Vitest 29/29 PASS. 합성 실제 NSIS 테스트 1/1 PASS. Electron TypeScript 3/3 PASS. Electron 제품 빌드 PASS. 런타임 ASAR/파일 선택 검사 3/3 PASS. `git diff --check` PASS.
- QA 로그: `F:\BOGUNON_DEV\auto-update-04-qa\`. 합성 private key는 테스트 프로세스에서 즉석 생성했고 파일·Git에 저장하지 않았다. 운영 개인키·계정 토큰은 사용하지 않았다.
- 설치된 제품 EXE는 확인 당시 `2.0.0-beta.5`였고, 기존 제품 경로에는 설치 명령을 실행하지 않았다. 실사용 프로필을 직접 수정하지 않았으나, 다른 실행 중 프로세스의 동시 쓰기까지 포함한 파일별 불변 SHA 기준선은 이번 범위에서 확보하지 않았다.

## 운영 전 조건

1. 운영용 Ed25519 키의 보관·교체 담당과 서명된 릴리스 게시 절차를 확정한다. 개인키는 앱·Git·공개 CI 로그에 넣지 않는다. 버전별 NSIS를 먼저 게시하고 검증한 뒤 채널 포인터를 마지막에 교체한다.
2. 신규 제품 NSIS에 업데이트 기능과 공개키·피드를 포함하고 기존 beta.5에는 수동 전환 설치를 1회 제공한다. 현재 `config/production-electron-update.json`은 비활성이다.
3. 실제 제품 식별자로 빌드한 후보에 대해 사용자 승인 하의 별도 업데이트 QA를 수행한다. Medium Integrity, 학교 보안 정책, 미서명 경고, 실제 프로필 백업·보존은 이 합성 PASS로 대체하지 않는다.
4. Windows 코드 서명은 제품 출처 표시와 SmartScreen 평판을 위해 별도 검토할 수 있다. 자체 Ed25519 검증을 갖춘 설치 엔진의 암호학적 필수 조건은 아니다. 기관 정책이 미서명 NSIS를 차단하면 우회하지 않고 수동 설치 안내 또는 서명 도입을 결정한다.

공식 참고: [Tauri updater 서명 계약](https://v2.tauri.app/plugin/updater/), [electron-builder 자동 업데이트](https://www.electron.build/v26/docs/features/auto-update/).
