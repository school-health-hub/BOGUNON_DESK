# AUTO-UPDATE-07: 실제 제품 전환 검증 현황과 집 PC 인계

2026-11-23 학교 PC. 제품 코드 및 현재 설치된 beta.5는 변경하지 않았다. 이 보고서는 실제 NSIS 업데이트 PASS를 선언하지 않는다.

## 기준과 보존

- 작업 브랜치: `codex/auto-update-07` (제품 Source SHA `769f4327469ec0a76cc0f525269ab594f94f140e`의 AUTO-UPDATE-06 결과에서 분기).
- beta.5 NSIS: `BOGUNON-DESK-Setup-2.0.0-beta.5-x64.exe`, 214,019,586 bytes, SHA-256 `1C9045B271E94A3C9957637D9B96E80A4C9150D89BEC6E2E37F198B2229834AF`.
- beta.6 NSIS: `BOGUNON-DESK-Setup-2.0.0-beta.6-x64.exe`, 214,037,579 bytes, SHA-256 `A87274E2C5408A5E57CBAD01677ADF8FC735B1C9B5A1EDE7B8DC0CA7C1035B42`.
- beta.6 서명 메타데이터: `bogunon-update.json`, 1,142 bytes, SHA-256 `4E46069EE5644F3A6734CF0E8D8ABF04E5DBB6033D1DDBED091F3EE5163EA97B`.
- 현 학교 PC 세션은 High Integrity이다. Medium Integrity 결과로 기록하지 않는다.
- 학교 PC beta.5 설치본, 실사용 프로필, Windows 신뢰 저장소 및 보안 정책, 기존 Git worktree는 변경하지 않았다. 운영 Release와 업데이트 피드도 게시하지 않았다.

## 운영 키 백업

- 기존 DPAPI 키를 재생성하지 않았다. F: 암호화 복구본 `F:\BOGUNON_DEV\auto-update-06-key-backup-20261123\ed25519-recovery.json`의 SHA-256 `4534E5D50142A1FB778F95900EE1B24EA55041EEF8E81F94094814A7D9BC8420` 재확인 PASS.
- 사용자 지정 G: USB는 물리적으로 별도 이동식 장치임을 확인했다. `G:\BOGUNON_DESK_UPDATE_KEY_BACKUP_20261123\ed25519-recovery.json`을 읽기 전용으로 복사하고 당시 SHA가 일치했다.
- 이후 같은 USB에 beta.6 NSIS를 복사했을 때 원본과 복사본의 SHA가 달랐고, 재복사에서 Windows가 `잘못된 디스크가 드라이브에 들어 있습니다` 오류를 반환했다. 이 장치의 저장 안정성을 확인할 수 없으므로 **G:의 키 복구본도 신뢰할 수 있는 외부 백업으로 인정하지 않는다**. G:에 추가 쓰기를 중단했다. 원본 F: 암호화 복구본과 DPAPI 키는 보존됐다.
- 다른 별도 저장장치가 현재 없다. 운영 키의 신뢰 가능한 오프라인 백업과 다른 PC에서의 복원 검증은 **NOT RUN**. 암호, 개인키, 암호화 복구본을 Git 또는 Drive에 올리지 않았다.

## 집 PC용 파일 전달

비공개 소유자 전용 Drive 폴더: `https://drive.google.com/drive/folders/10WVppxMLYTA3nfELO26MDGwZAIL04ZH_`.

- beta.5 NSIS는 기존 비공개 Drive 원본에서 폴더 안으로 복사했다. 기존 원본을 삭제하거나 이동하지 않았다.
- beta.6 NSIS는 Chrome의 단일 파일 업로드로 보관했다. Drive 목록의 크기 214,037,579 bytes와 소유자 전용 권한 확인 PASS.
- `bogunon-update.json`, `SHA256SUMS.txt`, `README-HOME-PC.txt` 업로드 및 목록 확인 PASS. 두 텍스트 파일의 내용은 Drive에서 다시 읽어 확인했다.
- Drive 연결 도구는 100 MiB 초과 로컬 파일 직접 업로드를 거부했다. Chrome 업로드는 완료됐으나 다운로드 이벤트를 확보하지 못해 **원격 beta.6 EXE의 다운로드 후 SHA-256 검증은 NOT RUN**이다. 집 PC에서 먼저 내려받아 로컬 체크섬과 대조해야 한다.
- 이 Drive 폴더는 업데이트 피드나 공개 파일럿 배포 경로가 아니다. 기존 참여자용 파일과 공개 Release를 변경하지 않았다.

## 실제 제품 설치·업데이트 결과

| 시나리오 | 상태 | 이유 |
| --- | --- | --- |
| beta.5 → beta.6 수동 NSIS 전환 | **NOT RUN** | 별도 Windows PC에 현재 접속할 수 없다. 학교 PC에는 보호해야 할 동일 appId의 beta.5가 설치돼 있다. |
| beta.6 → 후속 실제 제품 자동 업데이트 | **NOT RUN** | 후속 제품 NSIS와 신뢰 가능한 HTTPS 시험 피드가 아직 없다. 공개 GitHub Release 게시도 승인되지 않았다. |
| 실제 제품 재실행 및 버전 변경 | **NOT RUN** | 위 설치 단계가 실행되지 않았다. |
| 메모·설정·위젯 배치 보존 | **NOT RUN** | 실제 전환 전후 합성 프로필 비교가 필요하다. |
| Medium Integrity 및 SmartScreen/학교 정책 | **NOT RUN** | 현재 세션은 High Integrity이며 보안 경고 우회 금지. |
| 실패 시 기존 앱 보호 | **NOT RUN** | 실제 제품 설치 실패 주입은 수행하지 않았다. AUTO-UPDATE-04의 합성 앱 결과만 기존 근거로 유지한다. |

AUTO-UPDATE-06에서 beta.6 패키지 실행본의 격리 QA 프로필 GUI 기동과 내장 Source SHA 일치, Ed25519 서명·파일 해시 검증은 PASS했다. 이것은 실제 NSIS 전환의 대체 증거가 아니다.

## 시험 피드 판단

- beta.6 제품 패키지는 공개 GitHub Releases API의 버전별 `immutable: true` 릴리스와 자산 이름을 요구한다. 비공개 초안은 인증 토큰 없이 앱에서 조회할 수 없고, 공개 Release를 시험 목적으로 게시하지 않는다.
- `UpdateService`는 검증된 HTTPS 일반 피드도 지원하므로, 별도 PC에서는 **빌드 시점에 시험 피드로 고정한 별도 QA 패키지**와 HTTPS 시험 서버를 구성할 수 있다. 원본 beta.6 패키지의 설정을 실행 중에 바꾸거나 서명·SHA 검증을 해제하지 않는다. 시험 패키지는 원본 beta.6과 다른 바이트와 해시를 가진다는 점을 증거에 명시해야 한다.
- 현재 공개 피드의 beta.6 원본으로 비공개 자동 업데이트를 실제 검증하려면 안전한 별도 시험 채널 설계와 후속 제품 버전의 NSIS·서명 메타데이터가 더 필요하다. 이 단계를 개발용 PASS에서 운영 PASS로 확대하지 않는다.

## 집 PC에서 다음 순서

1. Drive에서 beta.5·beta.6 NSIS와 `SHA256SUMS.txt`를 내려받고, 각각 `Get-FileHash -Algorithm SHA256`으로 실제 다운로드 바이트를 대조한다. 불일치 시 설치하지 않는다.
2. 현재 사용자에 기존 `BOGUNON DESK` 설치 등록·프로그램 폴더·`BOGUNON-DESK-ELECTRON-P0` 프로필이 있는지 읽기 전용 확인한다. 기존 설치나 실사용 데이터가 있으면 백업·충돌 범위를 확정하기 전 설치하지 않는다.
3. 충돌 없는 PC에서 beta.5 사용자별 NSIS 설치, 합성 메모·위젯 배치 저장과 파일별 SHA 기준선을 만든 뒤 앱을 종료한다.
4. beta.6 NSIS 수동 전환, 앱 재실행, 버전 확인, 메모·설정·배치의 내용과 SHA를 비교한다. 일반 사용자 Medium Integrity이면 실제 토큰 레이블도 기록한다. 설치 차단·경고가 있으면 우회하지 않는다.
5. 자동 업데이트는 후속 버전의 별도 제품 NSIS, 서명된 메타데이터, HTTPS 시험 피드가 확보된 후에만 실행한다. 현재 AUTO-UPDATE-04 합성 앱 PASS를 실제 제품 PASS로 표시하지 않는다.
6. 집 PC에서 별도 저장장치로 암호화 키 복구본을 안전하게 전달받기 전에는 운영 개인키 복원을 시도하거나 새 키를 생성하지 않는다.

## 판정

**PARTIAL**. 학교 PC의 beta.5와 데이터는 보호했고, 집 PC용 제품 NSIS 파일을 비공개 Drive에 보관했다. 실제 제품의 NSIS 전환 및 자동 업데이트, 원격 EXE 다운로드 SHA, 안정적인 오프라인 키 백업은 완료되지 않았다.
