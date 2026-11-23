# AUTO-UPDATE-06: beta.6 내부 전환 후보

2026-11-23 학교 PC에서 작성. 이 문서는 운영 게시나 설치 승인을 뜻하지 않는다.

## 소스와 배포 계약

- 브랜치: `codex/auto-update-06`
- 제품 Source SHA: `769f4327469ec0a76cc0f525269ab594f94f140e`
- 버전: `2.0.0-beta.6` (기존 beta.5 파일과 이름을 구분하는 내부 전환 후보)
- `appId`: `kr.sungandi.schoolhealthdesk.electronp0`
- `productName`: `BOGUNON DESK`
- 사용자 프로필: `BOGUNON-DESK-ELECTRON-P0`
- NSIS: 사용자별 설치, 관리자 권한 요구 없음, 제거 시 AppData 삭제 안 함
- Windows Authenticode: 미서명. OS 또는 학교 보안 정책 경고를 우회하지 않는다.

## 운영 메타데이터 키

- 공개키만 제품의 `config/production-electron-update.json`에 포함한다.
- 공개키 DER SHA-256: `5bc159c4ba79ab4a5c0ebefd5162ac1b1226e361414335134f0cd73c73e383fb`
- 개인키 원본: 현재 Windows 사용자 DPAPI 보호 파일 `C:\Users\sehwa\AppData\Local\BOGUNON-DESK-UPDATE-SIGNING\ed25519.dpapi`.
- 별도 암호화 복구 파일: `F:\BOGUNON_DEV\auto-update-06-key-backup-20261123\ed25519-recovery.json`; SHA-256 `4534E5D50142A1FB778F95900EE1B24EA55041EEF8E81F94094814A7D9BC8420`.
- 복구 파일은 scrypt와 AES-256-GCM으로 암호화했고, 암호는 사용자가 Windows 로컬 입력창에 직접 입력했다. 암호와 개인키는 Git, 릴리스 자산, QA 로그에 기록하지 않는다.
- F:는 같은 PC의 드라이브이므로 PC 분실까지 대비하려면 **승인된 별도 오프라인 위치**에 암호화 복구 파일을 추가 보관해야 한다. 해당 외부 백업은 아직 수행하지 않았다.
- 다른 PC에서 서명할 때는 복구 파일과 사용자가 기억하는 암호를 이용해 `node scripts/electron-p0/provision-update-key.mjs restore <백업경로>`로 해당 PC의 DPAPI 저장소에 복원한다. 복원 전후 공개키 지문을 대조한다.
- 키 교체는 현 공개키가 검증하는 메타데이터에 다음 공개키를 배포한 뒤 전환한다. 키가 완전히 분실되면 이미 설치된 앱은 새 키를 신뢰하지 않으므로, 사용자에게 수동 전환 설치본을 제공해야 한다. 이 경우 기존 키로 서명한 업데이트로 가장하지 않는다.

## GitHub Releases 조회와 게시 조건

- 앱은 공개 GitHub REST Releases 목록에서 채널에 맞는 새 버전을 찾는다. 비공개 저장소용 개발자 토큰은 앱에 넣지 않는다.
- 버전별 Release의 `immutable: true`, 정확한 자산 이름과 HTTPS URL을 확인한 뒤 `bogunon-update.json`의 Ed25519 서명과 만료일, NSIS의 크기와 SHA-256을 검증한다.
- `latest.yml`이나 `electron-updater`가 설치를 결정하지 않는다. 제품의 자체 검증 엔진과 승인 흐름을 사용한다.
- 운영 게시 전에 저장소에서 immutable releases를 활성화하고, 게시된 Release의 API 응답에서 `immutable: true`를 확인해야 한다. 현재 설정 변경과 Release 게시를 하지 않았다.
- 게시 순서: 버전 확정 → NSIS 원본 해시 확인 → 서명 메타데이터 생성 → 비공개 초안에 NSIS, 메타데이터, 체크섬, 변경 내역 업로드 → 자산 해시 재확인 → 사용자 승인 후 immutable Release 게시. 공개 후 자산을 교체하지 않는다. 잘못 게시하면 새 수정 버전과 새 메타데이터를 게시한다.
- 서명 메타데이터의 유효 기간은 발행 후 30일이다. 지금 만든 파일은 내부 QA 자료이며 실제 게시 시에는 만료일을 확인하고 필요하면 다시 서명한다.

## F: 내부 후보

경로: `F:\BOGUNON_DEV\auto-update-06-candidate-20261123\release`

| 파일 | 크기 | SHA-256 |
| --- | ---: | --- |
| `BOGUNON-DESK-Setup-2.0.0-beta.6-x64.exe` | 214,037,579 | `A87274E2C5408A5E57CBAD01677ADF8FC735B1C9B5A1EDE7B8DC0CA7C1035B42` |
| `BOGUNON-DESK-2.0.0-beta.6-win-x64.exe` | 195,463,761 | `CAFBEE969ACCE5A40F3961F57D4B3BD47889EC4DFAB025710EC970048E5C531A` |
| `bogunon-update.json` | 1,142 | `4E46069EE5644F3A6734CF0E8D8ABF04E5DBB6033D1DDBED091F3EE5163EA97B` |

`SHA256SUMS.txt`와 `release-notes-beta6.txt`도 F:에 있다. 파일을 기존 배포 폴더나 공개 Release에 올리지 않았다.

## 수행한 검증

- 업데이트 서비스·UI 집중 Vitest 32/32 PASS.
- DPAPI 저장·암호화 백업 왕복 테스트 2/2 PASS. 실제 생성 시 복구 파일과 DPAPI 원본의 공개키 지문 일치 PASS.
- Electron TypeScript 3개 설정 PASS; Electron 제품 빌드 PASS; Builder 런타임 그래프 검사 3/3 PASS.
- NSIS와 Portable 패키징 PASS. ASAR에 Main 업데이트 코드, 공개 설정, 빌드 메타, 공개 계정 설정 포함. 컴파일된 테스트 파일 0개.
- 서명 메타데이터를 제품 공개키로 재검증하고 NSIS 크기·SHA-256과 대조: PASS.
- 패키지의 `win-unpacked` 실행본을 F: 격리 QA 프로필로 실제 기동: 버전 `2.0.0-beta.6`, Source SHA 일치, 첫 실행 안내 및 업데이트 설정 화면 표시, 정상 종료 PASS. 캡처: `F:\BOGUNON_DEV\auto-update-06-candidate-20261123\gui-qa\beta6-onboarding.png`, `beta6-update-settings.png`.
- 실제 beta.5 → beta.6 NSIS 버전 전환: **NOT RUN**. 동일 `appId`와 사용자별 설치 등록이 학교 PC의 beta.5와 충돌한다. QA 프로필 분리만으로 설치 등록을 격리할 수 없다.
- 운영 GitHub Release 게시·공개 피드 동작: **NOT RUN**. 아직 게시 승인이 없고 immutable 설정도 확인 전이다.

## 다음 작업

1. 암호화 복구 파일을 사용자 승인된 별도 오프라인 위치에 보관하고 복원 연습을 한다. 개인키나 암호를 채팅이나 Git에 올리지 않는다.
2. 별도 Windows PC에서 실제 제품의 구버전과 이 후보로 NSIS 업데이트, 재시작, 합성 사용자 데이터 보존을 검증한다. 현재 학교 PC beta.5는 유지한다.
3. 공개 배포를 결정할 때 GitHub immutable releases 설정과 공개 접근, 학교 네트워크 조건, 미서명 설치 정책을 확인한다. 최초 beta.5 사용자는 업데이트 기능을 담은 NSIS로 한 번 수동 전환해야 한다.
4. 외부 게시와 현재 PC 업데이트는 별도 사용자 승인 후 진행한다.
