# DOC-V2-P11 집 PC 인계 — 2026-10-30

## 현재 기준

- 저장소: `school-health-hub/BOGUNON_DESK` (public)
- 브랜치: `feature/official-document-enhancement`
- 구현 시작 HEAD: `b272b94a8620aca17fdeb8cf980852a34d8e4b6b`
- 상태: **PARTIAL / CONDITIONAL**
- 제품 생성 ODT의 K-에듀파인 읽어오기 전에는 호환성을 PASS로 판정하지 않는다.

## 구현 범위

DOC-V2-P11 MVP는 다음 범위를 구현했다.

- 승인된 로컬 표준서식의 SHA-256 및 43개 북마크 구조 검증
- 북마크·span·표·프레임·스타일을 보존하는 ODT 텍스트 치환
- 수신 `내부결재`, 경유 공란, 제목 및 `draft.body` 정본 매핑
- 로컬 템플릿 선택과 저장 위치 선택을 Rust 명령 내부에서 처리
- Windows `MoveFileExW(REPLACE_EXISTING | WRITE_THROUGH)` 기반 동일 디렉터리 교체
- 저장 취소의 정상 처리와 경로를 노출하지 않는 결과 계약
- TypeScript 내보내기 서비스와 공문 미리보기의 `K-에듀파인용 ODT 저장` 버튼
- 운영 Tauri 및 공문 QA 실행기에만 명령 등록

현재 변경은 추적 수정 7개와 신규 소스·테스트 11개, 총 18개다. 주요 신규 모듈은 `src-tauri/src/official_document_odt/`의 9개 Rust 파일과 `officialDocumentExportService.ts` 및 테스트다. 기존 데이터 모델, reducer, 공문 생성기, B-lite CSS, Cargo/package lockfile은 변경하지 않았다.

## 검증 상태

| 항목 | 결과 | 근거 |
|---|---|---|
| TypeScript | PASS | `npx tsc --noEmit` |
| 집중 Vitest | PASS | 4개 파일, 47/47 |
| Rust 컴파일 | PASS | Strawberry Perl과 warmed cache 사용 후 제품 코드 컴파일 완료 |
| Rust 집중 테스트 | **FAIL** | 24건 중 22 PASS / 2 FAIL |
| Windows 기존 파일 교체 | PASS | `MoveFileExW` 실제 overwrite 테스트 통과 |
| 제품 ODT 생성 | NOT RUN | Rust 집중 테스트 게이트 실패로 중단 |
| 한컴 열기·편집·재열기 | NOT RUN | 제품 ODT 미생성 |
| K-에듀파인 읽어오기 | NOT RUN | 사용자가 추후 수동 검증 |

남은 Rust 실패는 다음 두 건이다.

1. `accepts_zero_one_many_attachments_without_appending_them_again`
   - `tests.rs:256`
   - 테스트는 일반 공백을 포함한 `합성 하나`를 찾지만 ODF 출력은 공백을 `<text:s/>`로 표현한다. 현재 증거로는 변환 결함보다 테스트 표현 불일치 가능성이 크지만 아직 확정하지 않았다.
2. `preserves_multiline_leading_space_and_long_body_inside_the_existing_range`
   - `tests.rs:290`
   - 테스트는 `<text:s/><text:s/>가. 선행`을 기대하지만 실제 ODF는 항목 내부 공백도 `가.<text:s/>선행`으로 표현한다. 이 역시 테스트 표현 불일치 가능성이 크지만 아직 확정하지 않았다.

테스트 기대값을 낮춰 통과시키지 말고, 실제 변환 결과와 P10 성공 계약을 비교해 원인을 고친다.

## ODT 계약과 로컬 전용 자료

- 승인 표준서식 SHA-256: `15217AE983DEE30575C86CE9573B38568404985CA9C1CF2CF4E2DBA905A3FF36`
- 북마크 계약: point bookmark 41개와 `NormalField1` start/end 한 쌍, 총 43개 요소
- P10 성공본 SHA-256: `B9FC10103EBA182ADEDC91AC2CD953CB364D26476DD78663473C5A57ABEFB171`

학교 PC에만 있는 자료:

- 템플릿: `E:\BOGUNON_DEV\qa-output\official-document-odt-p6-b272b94-20261030\표준서식.odt`
- P10 비교본: `E:\BOGUNON_DEV\qa-output\official-document-odt-p10-b272b94-20261030\synthetic-kedufine-bookmark-preserved.odt`
- 실행계획·ledger·검증 로그: 저장소의 ignored `.omo/`

표준서식의 재배포 권한은 확인되지 않았다. 템플릿·실제 공문·E: QA 자료를 Git 또는 원격 저장소에 올리지 말고, 집 PC에서는 사용자가 합법적으로 보유한 로컬 파일의 SHA를 다시 확인한다.

## 집 PC 복원과 재검증

```powershell
git fetch origin
git switch feature/official-document-enhancement
git pull --ff-only origin feature/official-document-enhancement
git status --short
git rev-list --left-right --count HEAD...origin/feature/official-document-enhancement
```

Strawberry Perl Portable이 같은 위치에 있다면 현재 프로세스에만 적용한다. 위치가 다르면 실제 경로로 바꾼다.

```powershell
$perlRoot = "$env:USERPROFILE\DevTools\StrawberryPerl\5.42.3.1-x64-portable"
$env:PATH = "$perlRoot\perl\bin;$perlRoot\c\bin;$env:PATH"
$env:CL = '/utf-8'
cargo test --manifest-path src-tauri\Cargo.toml official_document_odt --lib --locked --offline --jobs 1
```

다음 시작점:

1. 위 두 Rust 실패의 실제 출력과 기대 계약을 비교해 최소 수정한다.
2. Rust 24/24와 TypeScript/Vitest 집중 검사를 다시 통과시킨다.
3. 제품 변환 경로로 pristine 합성 ODT 1개를 만들고 SHA-256과 43개 북마크를 검증한다.
4. pristine 파일은 재저장하지 않고 보존한다. 복사본만 한컴에서 열기·편집·저장·재열기한다.
5. 사용자가 pristine 제품 생성본을 K-에듀파인에서 읽어오기하고, 상신·결재·발송 없이 결과를 기록한다.

## 보안 및 인계 제한

- 의도된 소스와 계획·증빙에 대해 최선 노력 패턴 검사를 수행했으며 비밀키·토큰·실제 개인정보는 발견되지 않았다.
- 전용 secret scanner가 설치되지 않아 잔여 위험은 있다.
- OS 교체 실패 뒤 staged 파일 정리까지 실패하는 이중 실패는 `Cleanup` 오류로 명시적으로 노출된다. 이 경우 기존 대상은 보존되지만 draft 데이터를 포함한 staged ODT가 대상 디렉터리에 남을 수 있으므로 수동 확인이 필요하다.
- `.omo/` 증빙과 E: 자료는 Git에 포함되지 않는다. 집 PC에서 필요하면 사용자 승인된 비공개 전송 수단으로 별도 이전하거나 위 명령으로 재현한다.
- Strawberry Perl과 한컴오피스는 machine-local 전제조건이며 저장소에 포함되지 않는다.
