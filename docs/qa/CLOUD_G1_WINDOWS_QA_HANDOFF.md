# CLOUD-G1 Windows QA 인계

## 기준과 상태

- 저장소: `school-health-hub/BOGUNON_DESK`.
- 기준: `27ffc44cc9986984af0a7e4500b626fb7edc9b6e` (CLOUD-G0).
- 작업 브랜치: `codex/cloud-g1-windows-qa-handoff`. 최종 전체 Git SHA는 마감 보고 및 `git rev-parse HEAD`와 원격을 비교한다. 설치 파일의 실제 구현 전체 SHA는 Actions의 `G1-BUILD-RESULT.json:sourceSha`와 일치해야 한다. 뒤따르는 문서 전용 마감 SHA와 구분한다.
- 전체 기능/데이터 경계: [통합 매트릭스](../ELECTRON_FEATURE_INTEGRATION.md)의 CLOUD-G1 절.
- 상태: **QA 후보 / CONDITIONAL**. Windows CI와 실제 PC QA를 구분한다. TESTABLE/운영 준비 완료 표시를 하지 않는다.

## 이번 검증

- Cloud: 273 테스트/51파일, Rust Purchase 56개, Electron 3개 타입 구성 및 production build PASS.
- WIN-QA-04: 기존 파서 수정 `03e31e260d1edad656e704d63283544926a455a0`를 유지한다. 새 실제 합성 PDF·Rust/CLI/UI 회귀에서 4개 품목·23,500원·합계행 제외 PASS. 파서 재작성/중복 수정 없음.
- Windows CI: 실행 후 아래 결과를 기록한다. 기존 8개 진입+선택 Dock 공문 연결, 합성 PDF 1건만 GUI 확인한다. native 파일 선택창은 이 테스트에서 합성 경로 test double을 사용하므로 native dialog PASS로 표시하지 않는다.
- Portable·NSIS 및 fixed CLI를 빌드하고 후보 EXE SHA256/Authenticode 상태를 기록한다. 설치·제거를 실행하지 않는다. 운영 배포/자동 업데이트는 하지 않는다.
- 이번 Windows 실제 학교/집 PC 검증: **NOT RUN**. 기존 공문 파일 QA PASS는 사용자 보고를 재사용하며 재검증하지 않는다. Tauri DOC-V2-P11 PASS 역시 Electron GUI/ODT 호환성 증거로 대체하지 않는다.

## 다운로드 및 실행 (현재 PoC/운영 앱 보호)

1. 최종 보고의 G1 Actions에서 `CLOUD-G1-QA-candidate-<source SHA>`를 내려받아 새 폴더에 압축 해제한다. 원본 작업 폴더/운영 데이터 위치는 사용하지 않는다. 아티팩트는 7일 보존이며 만료 시 기존 구버전 설치 파일로 대신하지 않는다.
2. `G1-BUILD-RESULT.json`의 sourceSha와 작업 SHA, `Get-FileHash .\<실제 EXE 이름> -Algorithm SHA256` 결과와 `SHA256SUMS.txt`를 비교한다. 서명 상태는 manifest에 기록된다. 학교 정책이 실행을 차단하면 보호 기능을 우회하지 않고 중단·보고한다.
3. 이번 기본 QA는 **NSIS를 설치하지 않고 Portable EXE**로 한다. 기존 앱/PoC 제거·초기화·설정 삭제 금지. 일반 사용자 PowerShell에서 압축을 푼 폴더로 이동한 뒤 아래를 실행한다.

```powershell
# 같은 창에서 재실행하면 같은 격리 프로필을 사용한다. UUID를 메모해 둔다.
$env:ELECTRON_P0_TEST_RUN = [guid]::NewGuid().ToString()
$env:ELECTRON_P0_TEST_RUN
$pocExe = @(Get-ChildItem . -Filter 'BOGUNON-DESK-ELECTRON-P0-*-win-x64.exe')
if ($pocExe.Count -ne 1) { throw 'Portable EXE 한 개가 필요합니다. Setup EXE를 실행하지 마세요.' }
Start-Process -FilePath $pocExe[0].FullName -Wait
```

다시 실행할 때는 새 UUID를 생성하지 않고 마지막 `Start-Process`만 실행한다. 프로필은 `%APPDATA%\BOGUNON-DESK-ELECTRON-P0\test-runs\<UUID>`이며 기존 기본 PoC/운영 프로필과 분리된다. EXE 직접 더블클릭은 기존 기본 PoC 프로필을 사용할 수 있어 이 단계에서 피한다. NSIS는 산출물 확인용으로 함께 제공하며 설치/제거 QA는 별도 승인·격리 확인 후 수행한다.

## 실제 PC 집중 확인 항목

- Dashboard/Dock→업무 도구→각 포함 화면을 열고 복귀한다. 추가로 화면 꾸미기→Dock→공문 작업실 표시→해당 Dock 아이콘 진입을 확인한다. 기존 공문 파일 전체 QA는 반복하지 않는다.
- Purchase→가져오기 형식 PDF→동봉 `WIN-QA-04-synthetic.pdf` 선택→분석→적용. 이름 4개(합성 거즈/밴드/소독솜/체온계), 합계 23,500원, `예상 합계`라는 다섯 번째 품목이 없는지 확인한다. 취소 시 기존 품목 유지도 한 번 확인한다.
- 이번 UUID 프로필에서만 합성 메모·배치 저장 후 앱을 정상 종료하고 같은 UUID로 재실행해 복원을 확인한다. Purchase 품목은 세션 전용이므로 종료 후 사라지는 것이 현재 계약이다.
- 실제 파일 대화상자/한글 경로 및 필요한 출력만 별도 합성 폴더에서 확인한다. 원본 공문·학생·실제 금융·운영 재고 자료는 사용하지 않는다. 오류가 나면 덮어쓰기/초기화로 우회하지 않고 기능·단계·비식별 오류·sourceSha를 기록한다.

## 잔여 결함과 B 대기

- 전체 저장소 root TypeScript: 기존 26건(Electron bridge ambient 범위 24+기존 Tauri 공문 session/reference 2). Electron 타입/빌드 PASS와 구분한다. 이번 범위를 Tauri 타입 수정으로 확대하지 않는다.
- Newsletter 실제 승인 자산/긴 제목 출력, Purchase PDF native dialog/실제 PC 결과, 최신 생성 ODT K-에듀파인 호환성, 설치·제거 및 일반 사용자 패키지 QA는 미검증 상태를 유지한다.
- **Inventory Cloud B 통합 대기**: 현재는 기존 `8f0044cd…`의 합성 로컬 Inventory만 포함한다. 관찰한 별도 `feature/inventory-management` 원격 SHA는 `a765ad08570dc5513edf96bb970442026a0a31ce`이며 가져오거나 병합하지 않았다. B 최종 SHA·변경 범위·IPC/DTO 계약·검증 결과 인계를 받은 후 별도 승인된 통합 단계에서만 검토한다. RPC/RLS/migration/운영 DB를 수정하지 않는다.
- PR/main 병합/운영 배포/AI 신규 기능/TD2 재설계/공문 중복 이식 없음. 최종 판정은 Windows CI 결과와 실제 PC 미검증을 함께 기록한다.
