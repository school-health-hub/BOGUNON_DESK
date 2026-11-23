# AUTO-UPDATE-05 — 실제 제품 전환·GitHub Releases 준비

작성일: 2026-11-23. 독립 브랜치 `codex/auto-update-05`, 기준 제품 소스 `a8f9ad6b0c1245d08a740dc79c8bf2893c8f9d8b`.

## 확인한 상태

| 항목 | 결과 |
| --- | --- |
| beta.5 → 현재 소스 계보 | PASS. `bbd77d634dea87ed43bea98b5df84c92d9bfae0a`는 기준 HEAD의 조상이다. 온보딩·Dock 설정 UX와 AUTO-UPDATE-04가 포함된다. |
| beta.5 원본 NSIS | PASS. `F:\BOGUNON_DEV\beta5-pilot-candidate-20261123\release\BOGUNON-DESK-Setup-2.0.0-beta.5-x64.exe`, 214,019,586 bytes, SHA-256 `1C9045B271E94A3C9957637D9B96E80A4C9150D89BEC6E2E37F198B2229834AF`. |
| 운영 업데이트 서명 개인키 | **미확보**. 기존 AUTO-UPDATE-01 문서에도 운영 키 미발급으로 기록돼 있다. 알려진 F: 업데이트 QA 폴더·후보 폴더의 키 파일명, 현재 프로세스의 관련 환경 변수 이름, 제품 설정을 확인했으나 키·검증용 공개키·안전한 보관 위치가 없다. 새로운 키는 만들지 않았다. |
| 학교 PC 기존 설치 EXE | 읽기 전용 확인: `2.0.0-beta.5`, 249,828,864 bytes, SHA-256 `5A46B86255C64B1030D75C1FD55BBD43E167B080E024808E7FF55B0DACBD2170`. |
| 현재 업데이트 피드 | 비활성. `config/production-electron-update.json`의 `enabled:false`, URL·공개키 공란. |
| 실제 제품 NSIS A → B | **NOT RUN**. 구버전 beta.5는 앱 내 업데이터가 없고, 후속 서명 키·메타데이터·버전별 NSIS가 없다. 현재 PC의 실사용 beta.5를 덮어쓰지 않는다. |
| AUTO-UPDATE-04 합성 A → B | 기존 PASS 재사용. 별도 식별자의 NSIS 전환과 합성 메모 SHA 보존 증거는 `AUTO-UPDATE-04-SELF-SIGNED-NSIS-REPORT.md`에 있다. 실제 제품 설치 PASS로 확대하지 않는다. |

## 설치와 데이터 격리 판정

제품 NSIS의 `appId`는 `kr.sungandi.schoolhealthdesk.electronp0`, `productName`은 `BOGUNON DESK`이며 `perMachine:false`, `allowElevation:false`, 설치 경로 변경 UI 비허용, 제거 시 AppData 삭제 비허용이다. Main의 프로필명은 `BOGUNON-DESK-ELECTRON-P0`이다. QA 프로필 플래그는 userData만 분리하며 NSIS 프로그램 파일, HKCU 제거 등록, 바로가기를 분리하지 않는다. 따라서 같은 사용자 계정에서 동일 제품 식별자로 두 버전을 직접 설치하면 보호 중인 beta.5와 충돌한다. 임의 `/D` 경로만으로도 등록 충돌은 해결되지 않는다.

실제 제품 설치 QA에는 기존 별도 Windows 테스트 PC, 복원 가능한 VM, 또는 제품 설치 등록·사용자별 Programs 폴더·HKCU가 분리된 기존 다른 사용자 세션 중 하나가 필요하다. 현재 작업은 새 계정·VM·Sandbox를 만들지 않았고, 실사용 beta.5나 프로필에 접근해 변경하지 않았다. 별도 환경이 확보되기 전까지 실제 제품 설치·재실행·데이터 보존은 **NOT RUN**이다.

## 서명 키 운영 계약

1. 릴리스 책임자가 승인된 신뢰할 수 있는 PC에서 Ed25519 키쌍을 한 번 생성한다. 현재는 키가 없으므로 생성·발급·기존 키 대체를 수행하지 않는다. 개인키와 공개키의 지문을 오프라인 릴리스 장부에 기록한다.
2. 개인키는 앱, Git 저장소, GitHub Release 자산, CI 로그, 일반 환경 설정 파일에 저장하지 않는다. 서명 작업 때만 접근 가능한 암호화 보관소에 두고, 암호화된 백업 2개를 분리 보관한다. 복구 절차는 격리 PC에서 백업을 읽어 합성 메타데이터에 서명하고 고정 공개키로 검증한 뒤 폐기하는 방식으로 점검한다. 백업 암호와 개인키 값은 보고서에 적지 않는다.
3. 앱에는 공개키만 고정한다. `sign-update-manifest.mjs`는 개인키와 앱의 공개키 일치를 검사하고, schema 2의 버전·채널·정확한 NSIS URL·크기·SHA-256·발행/만료 시각을 함께 서명한다. 서명된 메타데이터의 최대 유효 기간은 30일이다.
4. 정상 교체는 이전 공개키와 다음 공개키를 담은 전환 앱을 기존 키로 먼저 배포한 다음 새 키로 서명한다. 키 분실 시 이전 키로 새 메타데이터를 발행할 수 없으므로 새 공개키를 넣은 수동 전환 설치가 필요하다. 키 유출 시 기존 채널을 중지하고 배포를 보류한 뒤 공개키 교체 앱을 수동 배포한다. 원격 파일만으로 새 키를 신뢰하지 않는다.

## 전환 설치본 조건

현재 `electron-p0/package.json`은 `2.0.0-beta.5`이므로 기존 beta.5와 같은 버전명으로 새 바이너리를 배포하지 않는다. 다음 승인된 사전 배포 버전(예: `2.0.0-beta.6`)에 현재 UX와 AUTO-UPDATE-04를 포함하고, 운영용 공개키와 GitHub HTTPS 피드 주소를 설정한 뒤 별도 NSIS를 빌드한다. 기존 `appId`, 제품명, 프로필명, 사용자별 NSIS 설정은 유지한다. beta.5 사용자는 이 전환본을 **최초 한 번 수동 설치**해야 한다. 현재는 운영 키·피드가 없으므로 기능하는 전환 설치본을 만들지 않았고 제작 가능성은 **조건부**다. Portable은 앱 내 NSIS 자동 설치 대상에서 제외한다.

## GitHub Releases 게시 준비

공개 배포 승인 전에는 Release나 운영 피드를 생성·교체하지 않는다. 준비할 패킷은 버전별 `BOGUNON-DESK-Setup-<version>-x64.exe`, `SHA256SUMS.txt`, 변경 내역, schema 2 `bogunon-update.json`이다. 개인키·QA 프로필·원본 로그·실제 업무 자료는 포함하지 않는다.

게시 순서는 다음과 같다.

1. 보호된 소스 커밋·버전·빌드 설정을 확정하고 NSIS를 생성한다. 로컬 SHA와 파일 크기를 기록한다.
2. 고정된 공개키에 대응하는 개인키로 **정확한 NSIS 바이트와 GitHub 버전별 URL**을 서명한다. 메타데이터를 로컬에서 공개키로 재검증한다.
3. 버전 태그 `v<version>`의 NSIS와 체크섬·변경 내역을 게시하고 다운로드한 파일의 SHA·크기·이름을 확인한다. 릴리스 자산 교체는 하지 않는다.
4. 채널 포인터 `updates-beta`의 `bogunon-update.json`을 마지막에 갱신한다. 갱신 전에 포인터의 이전 바이트·SHA와 대상 NSIS를 보존한다. 이 단계가 실패하면 이전 포인터를 유지하고 배포를 중단한다.
5. 잘못된 포인터는 검증된 직전 서명 메타데이터로 되돌릴 수 있으나, 클라이언트 최고 버전 워터마크보다 낮은 버전은 거부된다. 잘못 게시된 새 버전 자체는 같은 버전 파일 교체로 고치지 않고 더 높은 수정 버전을 발행한다. 사용자 데이터 자동 롤백은 지원하지 않는다.

GitHub의 저장소 단위 **immutable releases**를 켜면 게시 후 릴리스 자산 교체가 막힌다. 현재 설계의 가변 `updates-beta` 포인터와는 양립하지 않으므로, 그 설정을 켜는 것을 현재 게시 준비의 PASS로 주장하지 않는다. 포인터 수정 권한을 최소화하고 Ed25519 서명 및 SHA 검증으로 변조 시 설치를 차단한다. 고정 불변 Release 정책을 도입하려면 포인터를 별도의 승인된 HTTPS 경로로 분리하는 설계 변경이 먼저 필요하다. [GitHub immutable releases 설명](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)

## 출시 전 남은 판정

- 운영 키 보관 위치·백업·복구 책임 확정: **BLOCKED**.
- 전환용 버전·공개키·피드가 들어간 실제 제품 NSIS: **NOT RUN**.
- 기존 beta.5와 설치 등록이 분리된 환경에서 실제 제품 A → B, 메모·위젯·설정·인증 상태 보존: **NOT RUN**.
- 학교 일반 사용자 권한과 미서명 설치 정책: **NOT RUN**. Windows 보안 경고를 우회하지 않는다.
- 공개 Release·운영 피드·외부 사용자 업데이트: **NOT RUN**, 별도 승인 필요.

다음 실행 조건: 운영 키의 승인된 보관·복구 경로와 제품 설치 등록이 분리된 QA 환경을 확정한다. 그 뒤 전환본을 빌드하고 실제 제품 업데이트를 검증한다. 현재 학교 PC beta.5·실사용 데이터·기존 Google Drive 파일은 그대로 둔다.
