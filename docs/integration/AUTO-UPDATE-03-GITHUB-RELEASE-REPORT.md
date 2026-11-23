# AUTO-UPDATE-03: GitHub Releases 연동 후보

## 범위와 결과

- 기준: `codex/auto-update-02` / `fc7695bffb79b92063f4b39eaf41432ec1fc3c35`.
- 이 작업은 독립 브랜치 `codex/auto-update-03`에서 진행했다. 학교 PC의 설치된 beta.5, 실사용 프로필, Google Drive 파일럿 파일은 변경하지 않았다.
- 공개 GitHub Release, 운영 피드, 실제 NSIS 버전 전환은 **NOT RUN**이다. `config/production-electron-update.json`은 계속 비활성화되어 있다.
- 기존 Ed25519 서명 JSON을 계속 사용한다. `electron-updater`의 `latest.yml`은 다른 형식이므로 설치 경로에 혼용하지 않는다.

## 무료 공개 업데이트 경로

공개 배포 승인 후에는 공개 GitHub Releases에 버전별 NSIS 자산을 게시하고, 별도의 채널 포인터 Release 자산 `bogunon-update.json`을 게시한다. 베타 채널 피드 주소 형식은 `https://github.com/<owner>/<repo>/releases/download/updates-beta/bogunon-update.json`이다. 서명된 JSON은 정확한 버전 태그 `v<version>`의 `BOGUNON-DESK-Setup-<version>-x64.exe`만 가리킬 수 있다. 앱에는 공개 검증 키와 고정 피드 URL만 포함하며 GitHub 토큰을 넣지 않는다. 비공개 1인 파일럿은 기존 Google Drive 수동 설치를 유지한다.

Main 프로세스가 HTTPS 다운로드를 소유한다. GitHub의 다운로드 리디렉션은 같은 저장소의 Release 경로 또는 허용한 GitHub 자산 호스트로 최대 3회만 따라간다. HTTP, 자격 증명이 포함된 URL, 임의 호스트, 다른 저장소, 과도한 리디렉션을 거부한다. 자격 증명과 참조 URL은 전송하지 않는다. 실제 GitHub CDN 경로는 공개 자산 게시 후 실환경에서 확인해야 한다. 메타데이터 서명, 버전, NSIS 크기와 SHA-256은 기존 검증기를 거치며, 설치 직전 캐시 파일도 재검증한다.

## 설치 경계

다운로드와 설치는 별도 사용자 동작이다. 설치는 Windows Authenticode 상태가 `Valid`이고, 피드에 고정한 게시자 인증서의 Subject와 정확히 일치할 때만 진행한다. 확인 실패, PowerShell 차단, 미서명 파일은 설치하지 않는다. 저장하지 않은 작업을 저장했는지 묻는 사용자 확인을 거친 뒤 일반 사용자 컨텍스트에서 NSIS 파일을 연다. 앱은 설치 프로그램을 연 후 정상 종료한다. 자동 재실행과 새 버전의 실제 설치 완료를 아직 검증하지 않았으므로 성공으로 간주하지 않는다. 실제 미저장 입력을 자동 탐지하는 기능도 이 단계에 포함되지 않았다.

Portable에는 설치 경로가 제공되지 않는다. 기존 beta.5에는 업데이트 기능이 없으므로 최초 한 번은 승인된 새 NSIS로 수동 전환해야 한다. 기존 appId, 사용자 데이터 경로, NSIS 사용자별 설치 계약은 이 변경에서 수정하지 않았다. 업데이트 캐시 외의 사용자 데이터는 코드가 쓰지 않는다.

## 검증 기록

- 집중 Vitest: `electron-p0/tests/update-service.test.ts`, `electron-p0/tests/update-ui.test.tsx` **24/24 PASS**. 서명된 합성 메타데이터, GitHub 경로, 리디렉션 제한, 손상 파일, 취소·재시도, 설치 동의·거절, 게시자 검사, 중복 설치를 포함한다.
- Electron TypeScript 3개 설정 **PASS**; Electron 제품 빌드 **PASS**.
- 기존 자동 업데이트 Electron E2E **1/1 PASS**. 격리 프로필로 설정의 업데이트 화면을 실제 Electron에서 확인했다. 캡처: `F:\BOGUNON_DEV\auto-update-03-qa\temp\update-about-980x700.png`. 운영 피드가 비활성화되어 실제 서명된 설치 준비 화면은 GUI에서 **NOT RUN**이다.
- 설치된 beta.5 EXE를 읽기 전용으로 확인했을 때 지정한 합성 게시자 서명이 없으므로 설치 허용 판정은 `false`였다.
- 실제 GitHub Release 다운로드, 서명된 NSIS 실행, 설치 후 재시작·버전·프로필 검증은 **NOT RUN**이다.

## 운영 전 최소 후속 작업

1. Windows 코드 서명 인증서와 보호된 Ed25519 서명 키의 운영 주체를 확정한다. 두 서명은 용도가 다르며 개인 키를 앱이나 Git에 넣지 않는다.
2. 새 버전의 사용자별 NSIS를 서명하고 격리 Windows 환경에서 설치·재시작·데이터 보존을 검증한다. 학교 PC beta.5 직접 설치는 별도 승인 사항이다.
3. 공개 배포 승인 후 버전별 자산을 먼저 게시하고 파일 SHA를 확인한 다음 채널 포인터 JSON을 마지막에 게시한다. 게시 실패 시 이전 포인터를 유지한다.
4. GitHub 네트워크 및 실제 자산 리디렉션, 학교 PC 보안 정책을 확인한 뒤 운영 피드 설정을 별도 릴리스에 포함한다.

공식 참고: [GitHub Release 자산 URL](https://docs.github.com/en/rest/releases/assets), [electron-builder v26 자동 업데이트](https://www.electron.build/v26/docs/features/auto-update/).
