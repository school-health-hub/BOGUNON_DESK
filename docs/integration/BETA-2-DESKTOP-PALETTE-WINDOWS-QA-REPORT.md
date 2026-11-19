# BOGUNON DESK 2.0.0-beta.2 Windows QA 보고서

## 판정

**PASS — 독립 QA 후보 생성 및 검증 범위 내**

- 제품 Source SHA: `a4af981578f6fd8a987f6628aa8d6d4848a5940c`
- 기준 UX HEAD: `c52085079b9db86b48954a5aba30a114a0c6f42d`
- 제품명: `BOGUNON DESK`
- 버전: `2.0.0-beta.2`
- 대상: Windows x64, 미서명 Portable 및 사용자별 NSIS QA 후보
- 기존 설치된 `2.0.0-beta.1`: 변경·제거·업데이트하지 않음

## 변경 범위

제품 런타임 변경은 버전 갱신만 수행했다.

- `electron-p0/package.json`: `2.0.0-beta.1` → `2.0.0-beta.2`
- 제품명·About·설정 bootstrap·브랜드 E2E의 버전 기대값 갱신
- `appId`, 제품명, 사용자 데이터 경로, 설정 schema 및 업무 IPC 계약은 변경하지 않음

## 패키징 결과

QA 루트:

`F:\BOGUNON_DEV\beta2-qa\a4af981578f6fd8a987f6628aa8d6d4848a5940c`

| 산출물 | 크기 | SHA-256 |
|---|---:|---|
| `release-final\BOGUNON-DESK-2.0.0-beta.2-win-x64.exe` | 195,451,559 bytes | `74A2C07D10F5856C0BC36EE6FEF70D9879F60E5FCCD85EC31AAE17AD41CE0FAE` |
| `release-final\BOGUNON-DESK-Setup-2.0.0-beta.2-x64.exe` | 214,020,506 bytes | `323BAE57A6A555D9AF130453898E8DEF0BE50CAB5CCDE07F1FD9B3C9DC872B4E` |

확인 사항:

- Electron Builder `26.18.0`, Electron `45.2.1`
- ProductName/FileDescription `BOGUNON DESK`
- FileVersion `2.0.0-beta.2`
- 공식 브랜드 아이콘 및 Windows 리소스 편집 유지
- `signExecutable: false`로 코드 서명만 생략한 미서명 QA 후보
- ASAR에 Main, Preload, Palette, Workspace, Newsletter worker 및 필수 CLI 포함
- 컴파일된 테스트 파일 0건
- `palette-protocol`은 런타임 import가 아닌 type-only 계약이므로 별도 JS 파일이 필요하지 않음
- 공개 Supabase 설정은 기존 승인된 로컬 공개 설정을 빌드 환경에서만 사용했으며 값은 보고서·Git에 포함하지 않음

증거:

- `evidence\source-manifest.sha256`
- Source manifest SHA-256: `D4B319509B8C49C2D15E075D7A88ED5D2090E3B88264E4157B9F99BD55E6EB7A`
- `evidence\artifact-manifest.json`
- `evidence\package-contract.json`
- `evidence\portable-cdp-result.json`
- `evidence\portable-primary-palette.png`
- `evidence\portable-workspace.png`

## 자동 검증

| 검증 | 결과 |
|---|---|
| 제품·Palette 집중 Vitest | 33 PASS / 0 FAIL |
| Electron TypeScript 3개 + 루트 TypeScript | 4/4 PASS |
| Electron 제품 빌드 | PASS |
| Runtime package | 3 PASS / 0 FAIL |
| Palette starter layout E2E | PASS |
| Palette transparency E2E | PASS |
| Widget settings panel E2E | PASS |
| `git diff --check` | PASS |
| 전용 lint script | NOT RUN — 정의 없음 |

E2E 최초 재실행에서는 격리 QA 프로필 환경변수가 빠져 기존 사용자 모드 설정을 읽으면서 Palette 창 수가 0으로 관측됐다. F:의 격리 QA 프로필과 임시 루트를 명시한 동일 빌드 재실행에서는 3개 E2E가 모두 PASS했다. 제품 결함이나 소스 수정은 없었다.

## 실제 Windows Portable GUI

물리 모니터 2대와 F:의 신규 합성 QA 프로필에서 새 Portable을 실행했다.

- Palette 창 2개 표시: PASS
- 주 모니터 신규 기본 위젯: 날짜·시계, 오늘의 보건실, 빠른 메모 — 정확히 3개
- 보조 모니터 신규 Palette: 빈 상태, 위젯 선택 진입 제공
- 전체 Dock: 1개, 주 모니터에만 표시
- 투명·무테 Palette 및 위젯 사이 바탕화면 노출: PASS
- 빈 영역 Windows 클릭 통과: PASS
- 위젯·Dock 입력 영역 활성화: PASS
- Dock의 `업무 도구` 키보드 실행 및 Workspace 열기: PASS
- Workspace 제품명·업무 도구·설정 표시: PASS
- 카드형 위젯 설정 저장·취소·ESC·포커스 복귀: E2E PASS
- 위젯 추가·이동·크기 조절·모니터별 소유권·재실행 복원: 동일 Source SHA의 기존 GUI/E2E 증거 재사용 및 신규 starter-layout E2E PASS
- 주요 일정 내부 스크롤·화면 경계 처리: 동일 Source SHA의 기존 PASS 증거 재사용
- Palette 실패 시 Workspace fallback·트레이 재시도: 동일 Source SHA의 기존 PASS 증거 재사용
- QA 프로세스 종료 후 잔여 프로세스: 0개

새 Portable 실행 중 기존 설치 Beta.1이나 운영 프로필은 열지 않았다. 실제 설치 업데이트 및 물리 모니터 케이블 분리·재연결은 이번 범위에서 수행하지 않았다.

## Beta.1 호환성과 보호

- 설치 경로의 기존 Beta.1 FileVersion: `2.0.0-beta.1`
- 설치된 Beta.1 실행 파일 SHA-256: `2AF0E08EBEB955CB6FB32CB32237AE7201E10A73DCAB6E5840E71E2351A88E9B`
- Beta.1 설치 파일·사용자 데이터·인증 프로필 불변
- `appId`, 프로필 이름, 사용자 데이터 경로, 저장 schema 불변
- MY FINANCE QA, Tauri 백업 및 다른 worktree 불변
- NSIS 후보는 생성만 했으며 설치·업그레이드하지 않음
- Windows Shell, 관리자 권한, main 병합 및 운영 배포 수행 안 함

## 잔여 출시 조건

- 미서명 실행 파일에 대한 Windows 경고 및 학교 IT 정책 확인
- Beta.1 → Beta.2 실제 사용자별 NSIS 업그레이드·제거·재설치 QA
- 물리 모니터 분리·재연결 호환성 QA
- 코드 서명 및 공개 배포 승인
- Beta.2 전체 회귀는 이번 변경이 버전·패키징 계약에 한정되어 재실행하지 않았으며, 기존 검증 결과와 이번 영향 범위 검증을 구분해 유지함
