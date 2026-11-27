# BETA14-RC-01 — Windows Electron 설치 후보

**판정 CONDITIONAL.** 후보 NSIS 제작, 패키지 실행 및 beta.13 업데이터 오프라인 계약 검증은 PASS다. 실제 격리 업데이트 설치와 재실행은 NOT RUN이다.

## 소스 및 수정

- 브랜치 `release/beta14-candidate-01`, 인계·원격 SHA `defc23e7949ec8a672326797e35b4657f3587f5b`. 최초 체크아웃은 clean이었다.
- 설치 후보 Source SHA `242b03e3aa14f1c496dad9ea30b46e77d0a28608`. `electron-p0/builder.json`에 런타임이 참조하는 `desktop-surface-protocol.js`를 포함했다. 기존 패키징 테스트의 누락 실패를 재현했고 수정 후 동일 검사 3/3 PASS.
- Electron main·renderer·tests TypeScript 및 production build PASS, 집중 Vitest 8개 파일 64/64 PASS. 빌드 이후에는 builder 파일 목록 한 줄만 바뀌어 컴파일 산출물을 재사용하고, clean 후보 커밋으로 출처 메타데이터를 갱신했다. NSIS에서 추출한 ASAR에서 해당 SHA와 `dirty:false`를 확인했다.
- 기존 beta.13 패키지의 네이티브 구성요소 5개를 재사용했다. 관련 빌드 입력 Git diff가 비어 있고 복사본 해시가 기존 패키지와 일치했다.
- 일부 Windows 실행에서 NSIS 두 번째 컴파일의 출력 파일 열기가 실패했다. 파일 잠금 해제 확인 후 같은 앱 번들과 x64 아카이브를 재사용했다. 로컬 빌더 래퍼가 중간 uninstaller 생성기와 최종 EXE의 출력 경로를 분리했다. 템플릿·제품 NSIS 설정·Windows 보안 정책은 기존 설정 그대로다. 로컬 래퍼는 `artifacts/beta14-nsis-output-isolation.cjs`에 있다.

## 설치 후보

| 항목 | 값 |
| --- | --- |
| 로컬 설치 파일 | `release-electron-p0/BOGUNON-DESK-Setup-2.0.0-beta.14-x64.exe` |
| 크기 | 215,202,558 bytes |
| SHA-256 | `3a75ff727e2bf4edfcfdf93a0299bbfd68aadcb66c048bd8f0603b3b6de1754d` |
| 버전 | 설치 EXE FileVersion, NSIS 내 앱 FileVersion 및 `app.getVersion()` 모두 `2.0.0-beta.14` |
| 서명 | EXE Authenticode `NotSigned`. 기존 운영 공개키로 schema 2 beta 매니페스트 Ed25519 서명 검증 PASS |
| 동봉 파일 | `bogunon-update.json`, `SHA256SUMS.txt`, `RELEASE-NOTES.txt` |

NSIS 내부 x64 앱과 ASAR를 실행 없이 추출했다. ASAR가 실제 Windows GUI 검증에 사용한 패키지와 바이트 단위로 일치했다.

## Windows QA

| 항목 | 결과 |
| --- | --- |
| 업데이트 계약 | beta.13 패키지의 실제 업데이터 모듈에 격리 GitHub 카탈로그와 beta.14 후보 바이트를 제공했다. 후보 발견, 서명, 해시 변조 거부, 크기·SHA-256 다운로드 검증 PASS. |
| 실제 beta.13 → beta.14 설치·재실행 | NOT RUN. 현재 사용자별 제품 설치가 기존 beta.13 경로와 HKCU 제거 등록을 공유한다. 독립 Hyper-V VM 0대, Windows Sandbox 비활성 상태. QA 프로필은 앱 데이터만 분리한다. |
| 트레이·업데이트 화면 | 패키지 런타임에서 앱 메뉴로 업데이트 창을 열었고, 실제 트레이에 등록된 업데이트 메뉴 콜백도 호출했다. Windows 트레이 아이콘을 직접 클릭하는 경로는 NOT RUN. |
| 작업표시줄 알림 | 합성 Windows 네이티브 알림 `show` PASS. 실제 beta.14 공급으로 발생하는 알림은 NOT RUN. |
| Dock·시계·기본 25% | 격리 QA 프로필에서 실제 Dock 표시, 시계 갱신, 듀얼 모니터 주 화면 1920px 중 좌측 480px 확보 PASS. |
| 종료 | QA Electron 종료 코드 0, 남은 QA 프로세스 0개. |

캡처는 `artifacts/beta14-gui/about.png`, `update.png`, `dock.png`, `clock.png`에 보관했다. 운영 설치본 FileVersion은 `2.0.0-beta.13`으로 유지됐다. 운영 앱 데이터, beta.13 배포 파일, GitHub Release와 피드에 변경을 가하지 않았다.

로컬 후보 커밋은 원격 인계 브랜치보다 1개 앞서 있다. 게시 전에 실제 설치 범위가 분리된 Windows 환경에서 beta.13 → beta.14 설치, 종료 및 재실행을 확인해야 한다.
