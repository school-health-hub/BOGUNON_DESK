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

2026-10-29 기준 HEAD `cd8e8e1a36b61e8579f4c159cce3755450b46761` 위의 미커밋 수정에서 일반 다중행 조사 결합 결함을 해소했다. 품질 계약 68건의 결과는 **PASS 68 / FAIL 0 / REVIEW 0 / KNOWN ISSUE 0 / NOT RUN 0**이다. 기존 58건 중 KNOWN ISSUE 재현 1건을 올바른 출력 계약으로 전환하고, 문장 수·빈 줄·공백·경계 개행·미리보기/복사 계약을 보강했다. 이 집계는 아래 두 품질 테스트 파일의 실제 실행 결과이며 네이티브 화면 QA를 뜻하지 않는다. 이후 변경에서는 아래 명령으로 다시 산출한다.

품질 파일을 제외한 기존 공문 집중 회귀는 23개 파일·222건 PASS이며 TypeScript `tsc --noEmit`도 통과했다.

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
| PASS | 일반 다중행은 `2. 주요 내용` 아래 본문 블록으로 한 번 출력하며, 마지막 문장에 `을(를) 위해`를 붙이지 않는다. 단일 행 목적 문구는 기존 결합을 유지한다. | 2줄·3줄·한국어 조사·단일 행 회귀 계약 |
| PASS | 일반 다중행의 첫 줄 공백, 내부 빈 줄, 맨 앞·맨 뒤 개행 및 마지막 공백을 보존한다. | 일반 문장과 선택 필드 없는 본문의 경계 계약, 실제 출력 컴포넌트와 복사 payload 비교 |

이전 기록은 PASS 57 / KNOWN ISSUE 1이었다. 먼저 기존 잘못된 출력의 재현을 확인하고, 올바른 계약으로 바꾼 테스트 6건이 수정 전 실패하는 것을 확인했다. 추가 경계 개행·끝 공백 계약도 수정 전 4건 실패했다. 생성기는 일반 다중행을 단일 목적어로 처리하던 분기만 수정했고, 번호형 목록·참고자료 생성·제목·붙임·종료 표시 정책은 유지한다. 렌더링 후 문자열 치환으로 결함을 숨기지 않는다.

수정 전:

```text
2. 첫째 일반 문장입니다.
둘째 일반 문장입니다.을(를) 위해 다음과 같이 시행하고자 합니다.
```

수정 후:

```text
2. 주요 내용
  첫째 일반 문장입니다.
  둘째 일반 문장입니다.
```

문장 블록에는 기존 목록과 같은 생성기 들여쓰기 두 칸을 더하되 사용자 공백·개행은 유지한다. 붙임 또는 생성기 종료 표시는 이 블록 뒤의 기존 문서 경계를 따른다. 실제 `OfficialDocumentOutput`을 jsdom에서 렌더링하고 제목·본문·전체 복사 콜백을 실행해 canonical 문자열 일치를 확인했다. Windows 클립보드·WebView2 실기, Rust/Tauri 빌드 및 Actions는 이번에 실행하지 않았다.

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
