# 공문 생성 결과 자동 품질 QA

## 범위

실제 학교 문서나 개인정보를 사용하지 않고, 10개 합성 시나리오로 다음 생산 경로를 검사한다.

`OfficialDocumentInput → generateOfficialDocumentDraft → OfficialDocumentOutput → composeOfficialDocumentDraft / copyOfficialDocumentText`

신규 품질 테스트와 기존 공문 컴포넌트 회귀 테스트를 함께 실행해 위 연결 경로를 검증한다. 검사 대상은 제목과 사용자 입력 보존, 번호 순서, 번호 중첩, 붙임 순서·수량·단위, `끝.` 위치, 줄바꿈, 참고자료 기반 생성, 수정·핵심정리 입력 보존, 미리보기와 복사 문자열의 일치다.

## 판정 계약

- **PASS**: 생성 결과가 자동화된 계약을 충족한다.
- **FAIL**: 동일 입력으로 재현 가능한 계약 위반이다.
- **REVIEW**: 학교별 서식 정책을 확인해야 하므로 자동 실패로 단정하지 않는다.
- **KNOWN ISSUE**: 재현은 확인됐지만 별도 승인 범위에서 수정할 결함이다. 테스트를 건너뛰지 않고 현재의 정확한 결함 출력을 고정하며 PASS 집계에서 제외한다.
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

기준 HEAD `344cf66d1839ddbadcf5f29b025c27922a1d509d`의 작업 트리에서 종료 표시와 들여쓰기 정책을 반영한 품질 계약 58건은 **PASS 57 / FAIL 0 / REVIEW 0 / KNOWN ISSUE 1 / NOT RUN 0**이다. Vitest 자체 집계는 known issue 재현 계약도 성공한 테스트로 세므로 `58 passed`로 표시된다. 의미상 PASS는 runner pass 58건에서 테스트명에 `[KNOWN ISSUE]`가 붙은 1건을 제외한 57건이다. 별도로 기존 공문 회귀 테스트는 제목 경계·번호형 입력·참고자료 붙임 fallback·미리보기 복사 회귀를 포함해 222건이 모두 통과했다. 아래 PowerShell 명령으로 다섯 가지 판정을 다시 산출해야 하며, 이 수치를 이후 코드 상태의 자동 갱신 보고서로 간주하지 않는다.

| 판정 | 항목 | 근거 |
|---|---|---|
| PASS | `1.`, `가.`, `1)`, `가)`로 시작한 주요 내용은 생성기의 `2.`를 다시 붙이지 않고 사용자 목록을 보존한다. | `pre-numbered-body` 품질 시나리오와 생성기 단위 테스트 4건 |
| PASS | 업무명이 `결과`로 끝나고 문서 목적이 결과 보고이면 `결과보고`로 경계를 한 번만 결합한다. | `multiple-attachments` 시나리오의 제목 계약 |
| PASS | 업무명이 `실적`으로 끝나고 문서 목적이 실적 보고이면 `실적 보고`로 경계를 한 번만 결합한다. | `empty-optional-fields` 시나리오의 제목 계약 |
| PASS | 완성 본문, 종이형 미리보기, 본문 복사와 전체 복사는 붙임을 한 번만 나타내고 생성기 소유의 종료 표시를 한 번만 사용한다. 참고자료의 붙임 예시 fallback도 canonical 본문에 한 번만 포함한다. | 붙임 없음·1건·여러 건과 참고자료 템플릿 경계 계약 |
| PASS | 사용자가 붙임을 확정 입력하면 참고자료 템플릿의 과거 붙임·종료 블록보다 우선하며, canonical 본문과 전체 복사에는 확정 붙임만 한 번 나타난다. | stale 참고자료 붙임과 사용자 확정 붙임 우선순위 회귀 계약 |
| PASS | 붙임이 없으면 가짜 붙임 자리표시자를 만들지 않고 본문 마지막 내용 뒤에서 종료한다. | 기본 생성기와 참고자료 기반 생성기 계약 |
| PASS | 사용자 개행, 개행 뒤 선행 공백, `1.`·`가.`·`1)`·`가)` 표식은 보존하고 viewport 자동 줄바꿈은 복사 문자열에 넣지 않는다. | 생성기·미리보기·복사 payload 계약 |
| PASS | 사용자 본문에 포함된 비종결 `끝.`은 삭제하지 않으며 별도의 생성기 종료 경계를 유지한다. | 사용자 문장 보존 계약 |
| KNOWN ISSUE | 일반 다중행 본문의 마지막 줄에 목적 문장 조사가 붙어 `둘째 일반 문장입니다.을(를)` 형태가 된다. | `[KNOWN ISSUE]` 재현 테스트로 고정하며 이번 정책 변경에서는 생성 문장 로직을 수정하지 않음 |

기존 제목·문장 템플릿은 변경하지 않았다. 이전 REVIEW 2건은 종료 표시와 들여쓰기 계약으로 확정했으며, 별도 다중행 문장 조합 결함은 KNOWN ISSUE로 분리했다. 기대값은 버그 출력에 맞추지 않고 올바른 출력 계약을 유지한다.

## 실행 명령

Windows PowerShell에서는 다음 명령으로 다섯 가지 의미상 판정을 재현한다.

```powershell
$qualityReport = Join-Path ([IO.Path]::GetTempPath()) 'bogunon-official-document-quality.json'
npx vitest run src/official-document/documentOutputQuality.test.ts src/components/desktop/OfficialDocumentOutput.quality.test.tsx --reporter=json --outputFile=$qualityReport
$qualityJson = Get-Content -Raw -LiteralPath $qualityReport | ConvertFrom-Json
$qualityCases = @($qualityJson.testResults | ForEach-Object { $_.assertionResults })
$review = @($qualityCases | Where-Object { $_.status -eq 'passed' -and $_.fullName -match '\[REVIEW\]' }).Count
$known = @($qualityCases | Where-Object { $_.status -eq 'passed' -and $_.fullName -match '\[KNOWN ISSUE\]' }).Count
$fail = @($qualityCases | Where-Object { $_.status -eq 'failed' }).Count
$pass = @($qualityCases | Where-Object { $_.status -eq 'passed' }).Count - $review - $known
$notRun = @($qualityCases | Where-Object { $_.status -notin @('passed', 'failed') }).Count
[pscustomobject]@{ PASS = $pass; FAIL = $fail; REVIEW = $review; 'KNOWN ISSUE' = $known; 'NOT RUN' = $notRun }
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
