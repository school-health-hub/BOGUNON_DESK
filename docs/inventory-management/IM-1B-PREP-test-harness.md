# IM-1B-PREP 테스트 harness

## 구성

| 경로 | 역할 |
|---|---|
| `qa/contracts/qa-contracts.json` | QA 계약 실행 명세 |
| `qa/fixtures/synthetic-identities.json` | 두 학교와 역할별 합성 사용자 |
| `qa/fixtures/synthetic-inventory.json` | 합성 품목·lot·단위 변환 |
| `qa/scripts/Test-Prep.ps1` | 정적 계약 검사와 로컬 DB smoke 검사 |
| `qa/scripts/Invoke-LocalSupabase.ps1` | 고정 CLI·격리 포트·안전 가드 |

## 계약 수 불일치

기존 `IM-1A-qa-contract.md`는 본문에서 33개라고 선언하지만 표의 고유 Test ID는 34개다. D01–D09 9개, C01–C07 7개, S01–S08 8개, P01–P05 5개, M01–M05 5개다. PREP에서는 임의 삭제 없이 34개 모두 보존했다.

각 계약에는 Test ID, 엔터티, 실행 환경, fixture, 사전 조건, 절차, 기대 결과, 실패 메시지, cleanup, 구현 예정 단계와 상태가 있다.

## 합성 역할

- School A teacher_admin / instructor
- School B teacher_admin / instructor
- 비소속 인증 사용자
- 비활성 membership 사용자
- 비인증 사용자는 인증 context 부재로 표현

이메일은 예약 도메인 `example.invalid`, ID는 고정 테스트 UUID, 품목명은 `Synthetic` 접두어를 사용한다.

## 현재 결과

- PREP 정적 검사: PASS
- 실행 중 DB 연결 smoke: PASS
- Auth health HTTP: PASS
- 로컬 database: `postgres`
- 제품용 `public.inventory_*` table: 0개
- 계약 명세 보존: 34개
- 실제 behavioral PASS: 0개
- FAIL: 0개
- PENDING IMPLEMENTATION: 34개

제품 schema·RLS·RPC가 아직 없으므로 34개를 PASS로 기록하지 않는다. 현재 PASS는 harness와 격리 환경 준비 검사만 뜻한다.

