# 공문 생성 결과 자동 품질 QA

## 범위

실제 학교 문서나 개인정보를 사용하지 않고, 10개 합성 시나리오로 다음 생산 경로를 검사한다.

`OfficialDocumentInput → generateOfficialDocumentDraft → OfficialDocumentOutput → composeOfficialDocumentDraft / copyOfficialDocumentText`

신규 품질 테스트와 기존 공문 컴포넌트 회귀 테스트를 함께 실행해 위 연결 경로를 검증한다. 검사 대상은 제목과 사용자 입력 보존, 번호 순서, 번호 중첩, 붙임 순서·수량·단위, `끝.` 위치, 줄바꿈, 참고자료 기반 생성, 수정·핵심정리 입력 보존, 미리보기와 복사 문자열의 일치다.

## 판정 계약

- **PASS**: 생성 결과가 자동화된 계약을 충족한다.
- **FAIL**: 동일 입력으로 재현 가능한 계약 위반이다.
- **REVIEW**: 학교별 서식 정책을 확인해야 하므로 자동 실패로 단정하지 않는다.
- **NOT RUN**: 검증 명령이 실행되지 않았다.

## 합성 시나리오

1. 일반 계획 기안
2. 학생 대상 안내 공문
3. 교직원 협조 요청
4. 검진·검사 운영 계획
5. 여러 개의 붙임이 있는 공문
6. 본문 번호가 이미 입력된 공문
7. 긴 한국어 문장과 여러 줄 본문
8. 빈 선택 필드가 있는 공문
9. 특수문자·괄호·날짜를 포함한 공문
10. 받은 공문 수정 및 핵심정리

## 현재 확인된 품질 항목

기준 HEAD `67e107b8b3b6f6001f8664df24b90b9469a82aa8`의 작업 트리에서 2026-10-23에 결함 3건을 수정한 뒤 품질 계약 49건은 **PASS 47 / FAIL 0 / REVIEW 2 / NOT RUN 0**이다. Vitest 자체 집계는 REVIEW 계약도 성공한 테스트로 세므로 `49 passed`로 표시된다. 의미상 PASS는 runner pass 49건에서 테스트명에 `[REVIEW]`가 붙은 2건을 제외한 47건이다. 별도로 기존 공문 회귀 테스트는 제목 경계·번호형 입력 회귀를 포함해 209건이 모두 통과했다. 아래 PowerShell 명령으로 네 가지 판정을 다시 산출해야 하며, 이 수치를 이후 코드 상태의 자동 갱신 보고서로 간주하지 않는다.

| 판정 | 항목 | 근거 |
|---|---|---|
| PASS | `1.`, `가.`, `1)`, `가)`로 시작한 주요 내용은 생성기의 `2.`를 다시 붙이지 않고 사용자 목록을 보존한다. | `pre-numbered-body` 품질 시나리오와 생성기 단위 테스트 4건 |
| PASS | 업무명이 `결과`로 끝나고 문서 목적이 결과 보고이면 `결과보고`로 경계를 한 번만 결합한다. | `multiple-attachments` 시나리오의 제목 계약 |
| PASS | 업무명이 `실적`으로 끝나고 문서 목적이 실적 보고이면 `실적 보고`로 경계를 한 번만 결합한다. | `empty-optional-fields` 시나리오의 제목 계약 |
| REVIEW | 전체 복사는 본문 안의 붙임·`끝.`과 별도 붙임 목록의 붙임·`끝.`을 모두 포함한다. | 서로 다른 출력 섹션이므로 학교 적용 정책 확인 필요 |
| REVIEW | 여러 줄 주요 내용의 두 번째 줄은 보존되지만 별도의 continuation 들여쓰기는 추가되지 않는다. | 공백 개수만으로 자동 실패하지 않고 가독성 정책 확인 필요 |

템플릿 구현과 REVIEW 정책은 변경하지 않았다. 기대값은 버그 출력에 맞추지 않고 올바른 출력 계약을 유지한다.

## 실행 명령

Windows PowerShell에서는 다음 명령으로 네 가지 의미상 판정을 재현한다.

```powershell
$qualityReport = Join-Path ([IO.Path]::GetTempPath()) 'bogunon-official-document-quality.json'
npx vitest run src/official-document/documentOutputQuality.test.ts src/components/desktop/OfficialDocumentOutput.quality.test.tsx --reporter=json --outputFile=$qualityReport
$qualityJson = Get-Content -Raw -LiteralPath $qualityReport | ConvertFrom-Json
$qualityCases = @($qualityJson.testResults | ForEach-Object { $_.assertionResults })
$review = @($qualityCases | Where-Object { $_.status -eq 'passed' -and $_.fullName -match '\[REVIEW\]' }).Count
$fail = @($qualityCases | Where-Object { $_.status -eq 'failed' }).Count
$pass = @($qualityCases | Where-Object { $_.status -eq 'passed' }).Count - $review
$notRun = @($qualityCases | Where-Object { $_.status -notin @('passed', 'failed') }).Count
[pscustomobject]@{ PASS = $pass; FAIL = $fail; REVIEW = $review; 'NOT RUN' = $notRun }
Remove-Item -LiteralPath $qualityReport
```

기존 공문 회귀 테스트는 PowerShell에서 다음과 같이 품질 QA 파일을 제외해 실행한다.

```powershell
$existingTests = @(
  Get-ChildItem src/official-document -File -Filter '*.test.ts' |
    Where-Object Name -ne 'documentOutputQuality.test.ts' |
    ForEach-Object FullName
) + @(
  Get-ChildItem src/components/desktop -File |
    Where-Object { $_.Name -match '^OfficialDocument.*\.test\.tsx?$' -and $_.Name -notmatch '\.quality\.test\.tsx$' } |
    ForEach-Object FullName
)
npx vitest run $existingTests
npx tsc --noEmit
git diff --check
```

아래 명령은 Git Bash에서 같은 집중 테스트와 회귀 테스트를 실행할 때만 사용한다.

```text
npx vitest run src/official-document/documentOutputQuality.test.ts
npx vitest run src/components/desktop/OfficialDocumentOutput.quality.test.tsx
mapfile -t files < <(find src/official-document -maxdepth 1 -name '*.test.ts' ! -name 'documentOutputQuality.test.ts' -print | sort; find src/components/desktop -maxdepth 1 \( -name 'OfficialDocument*.test.ts' -o -name 'OfficialDocument*.test.tsx' \) ! -name '*.quality.test.tsx' -print | sort)
npx vitest run "${files[@]}"
npx tsc --noEmit
git diff --check
```
