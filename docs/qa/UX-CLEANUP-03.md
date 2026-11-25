# UX-CLEANUP-03 검증 기록

기준 소스: `79201a609c9660ef3b0f6fce101310245ab294cc` (`codex/ux-cleanup-02`)

## 보건소식지 출력

이전 GUI 테스트는 저장 대화상자만 처리하고, 실제 출력 전에 Main이 여는 “이번 출력 저장” 확인창에는 응답하지 않았다. Renderer 상태는 60초 동안 `출력 검증·생성 중…`이었고, 새 파일의 완료 여부를 확인하지 못했다. 동일한 합성 원고·격리 프로필 경로에서 두 확인창에 승인 응답을 제공하자 A4 PNG와 PDF가 각각 실제 생성됐다. 이 관찰 범위에서 제품 출력 엔진 수정은 필요하지 않았다.

- 실행(PowerShell): `$env:UX_CLEANUP_EVIDENCE='F:\BOGUNON_DEV\ux-cleanup-03-20261125'; npx playwright test --config electron-p0/playwright.config.ts electron-p0/e2e/ux-cleanup-03-output.e2e.ts`
- PNG: 2,480×3,508, 484,988 bytes, SHA-256 `3DC50901D8505EE3F07F6FF56CFF92E127FDCE1D5C1AB2D36166ABDE83EFE35E`
- PDF: A4 1페이지, 244,412 bytes, SHA-256 `898F9CAA2A442AAAED6EF8E5EBC16301A26058F70CBA678CF10A99278B14A6653`
- 원본 출력물과 PDF 미리보기는 위 F: 폴더에 보존했다. 합성 원고만 사용했다.
- PNG 전체 및 PDF 1페이지를 시각적으로 확인했다. 출력에 `QA PLACEHOLDER`, `Revision`, `Scene`, 내부 조판 ID, SHA 표기는 보이지 않았다. PNG·PDF 파일의 바이트 검색에서도 네 영어 표기는 발견되지 않았다. PDF는 래스터 페이지라 텍스트 추출 결과가 비어 있었으므로, 문구 판정은 렌더링된 페이지의 시각 검수에 근거한다.

## 학교 프로필

테스트가 요구하는 `tools/purchase-excel-cli/target/debug/purchase-excel-cli.exe`가 해당 작업 트리에 없었다. `cargo build --locked --manifest-path tools/purchase-excel-cli/Cargo.toml`로 이 CLI만 빌드한 뒤 `npx vitest run electron-p0/tests/school-profile-ui.test.tsx --maxWorkers=1 --no-file-parallelism`을 실행했다. **7/7 PASS**. 이전 실패는 테스트 환경의 실행 파일 누락이었고, 학교 프로필 기능 오류는 확인되지 않았다.

TypeScript `npx tsc --noEmit` PASS. 학교 PC 설치본, 실사용 프로필, 업데이트 엔진 및 제품 코드는 변경하지 않았다.
