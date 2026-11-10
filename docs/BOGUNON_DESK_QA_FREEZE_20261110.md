# BOGUNON DESK 2.0 QA Freeze & Brand Finalization

## 기준선과 판정

- H6 디자인 기준 Source SHA: `8d8942227a8ecff06053fcb234452549981c6028`
- 브랜치: `codex/electron-h6-design-renewal`
- H7-B/R1/R2 최종 판정: **CONDITIONAL (동결)**
- 기존 H7-A 후보와 H7-B/R1/R2 증거는 변경하지 않는다.
- 이번 단계는 전체 Electron 1,016개 회귀를 반복하지 않고 브랜드·버전·Newsletter 입력 상태만 집중 확인했다.

## H7-B 완료 범위와 남은 공백

정확한 H7-A EXE 해시가 연결된 기존 증거에서 Portable 이동 실행, 한글·공백·긴 경로, 기본 모듈 실행, 프로필 분리, 재실행 데이터 유지, Finder 손상 복구, SCHOOL 오프라인, ODT 저장·취소, 번들 CLI 기본 호출, H6-C 전체 회귀를 보존한다.

다음 네 항목은 **NOT RUN** 상태를 유지한다.

1. 실제 Windows ACL 쓰기 거부 후 정상 경로 재저장
2. 실제 Save As 동일 파일명 충돌·취소
3. Portable 네이티브 대화상자로 Newsletter 승인 JSON 불러오기 후 PNG·PDF 출력
4. 격리 PostgreSQL이 연결된 Portable SCHOOL 관리자 화면의 Trusted MFA CLOSED

미실행 항목은 PASS 또는 FAIL로 재분류하지 않는다. 실제 제품 결함이 확인된 항목도 없다.

## 브랜드 원본과 적용

- 공식 PNG: `src-tauri/icons/icon.png`
  - SHA-256: `B5D93C8EC365C08B11BD006E46A46E227C681D30BB295AF3D017573BFC752A83`
- 공식 ICO: `src-tauri/icons/icon.ico`
  - SHA-256: `E38CA88E1D5490F3DCBC3C3FA525F7FCB7B80FFF3CB2F3A4EB1B2D018C0915C1`
- 로고의 형태와 색상은 변경하지 않았다.
- Home 날짜 위젯과 앱 정보에 동일한 PNG를 사용한다.
- Windows 패키징은 동일 ICO를 사용한다.
- `signAndEditExecutable: false`가 아이콘과 버전 리소스 편집까지 건너뛰던 문제를 바로잡아, unsigned 상태를 유지하면서 Windows 리소스 편집만 수행한다.

## 버전 기준

단일 제품 버전은 `0.2.1`이다.

- 루트 `package.json`: `0.2.1`
- Electron 앱 `electron-p0/package.json`: `0.2.1`
- Windows ProductVersion/FileVersion: `0.2.1`
- 화면 표시: `버전 0.2.1`
- 제품명과 파일명에서 개발 단계 표기 `ELECTRON P0`를 제거했다.

기존 `appId`와 `PROFILE_NAME`은 사용자 데이터 경로 호환성을 위해 변경하지 않았다. 이 내부 식별자를 바꾸는 작업은 데이터 이전 계약 없이 수행하면 안 된다.

## Newsletter 입력 상태 조사

H7-B-R2의 `13개 수정 필요`는 승인 fixture의 schema 불일치가 아니었다. 자동화가 네이티브 파일 선택을 완료하지 못해 빈 신규 원고가 열린 상태에서 필수 입력 검사가 표시된 것이다.

- Studio 문서 파싱·호환성·저장 집중 검사: 10 PASS
- B fixture 파싱·직렬화·저장·출력 장벽 검사: 13 PASS
- 총 23 PASS
- 승인 대기 자산의 `PENDING` 상태는 유지했다.
- Newsletter 제품 코드는 변경하지 않았다.

## 집중 검증

- 브랜드 앱 정보 UI: 17 PASS
- Newsletter 원인 분류: 23 PASS
- 루트 TypeScript·Vite 빌드: PASS
- Electron 제품 빌드: PASS
- Windows Portable 패키징: PASS
- 실제 Windows Portable Home: PASS
- 실제 Windows Portable 앱 정보 로고·버전: PASS
- 독립 시각 검토 2회: PASS / PASS, BLOCKER·MAJOR 없음
- Electron 전체 1,016개 회귀: 기존 H6-C 동일 기준선 증거 재사용, 이번 단계 NOT RUN

## 신규 내부 시험 후보

- 파일명: `BOGUNON-DESK-0.2.1-win-x64.exe`
- 제품명: `BOGUNON DESK`
- FileVersion/ProductVersion: `0.2.1`
- Authenticode: `NotSigned`
- 공개 배포: 보류

후보의 경로·크기·SHA-256은 저장소 밖 QA 보고서와 증거 인벤토리에 기록한다. 이번 변경이 커밋되기 전까지 후보는 기준 SHA와 작업 트리 diff로 만들어진 **내부 시험용**이며, 재현 가능한 공개 배포 후보로 승격하지 않는다.

## 계약 보존

- 저장 파일 포맷, Main/Preload/IPC, DB, 인증, 권한, Trusted MFA CLOSED 정책은 변경하지 않았다.
- 기존 앱 ID와 사용자 데이터 프로필명은 유지했다.
- H6 디자인 전체 재수정, Native WorkerW, 운영 배포는 수행하지 않았다.
- 기존 48개 worktree 및 H7-A 후보는 삭제·reset·clean하지 않았다.

## 내부 시험 및 공개 배포 조건

브랜드와 버전이 반영된 unsigned 후보는 격리 프로필 기반 내부 화면 시험에 사용할 수 있다. 다만 공개 배포 전에는 다음이 필요하다.

1. 변경을 검토·커밋해 고유 Source SHA를 만든 뒤 clean checkout에서 후보를 재생성한다.
2. Authenticode 코드 서명과 SmartScreen 배포 정책을 확정한다.
3. H7-B에서 동결한 네 가지 NOT RUN을 제품 결함 발생 시 또는 배포 필수 조건으로 선택적으로 검증한다.
4. 과거 공개 QA 객체의 로컬 경로 노출 위험은 GitHub 관리자 후속 조치 전까지 미해결로 유지한다.
