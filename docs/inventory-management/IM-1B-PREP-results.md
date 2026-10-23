# IM-1B-PREP 결과

## 완료된 준비

- 고정 Supabase CLI 2.121.0과 무결성 검사
- 기존 스택과 분리된 `inventory_qa` project 및 5632x port 범위
- 두 학교·교사·강사·비소속·비활성 사용자의 합성 fixture
- 합성 품목·lot·정확 단위 변환 fixture
- 기존 QA 표의 고유 34개 계약을 실행 명세로 변환
- 로컬 stack 기동, DB 연결, Auth health, 빈 제품 schema 확인
- remote material·실데이터·제품 migration 방지 가드

## 실행 결과

| 검사 | 결과 |
|---|---|
| PowerShell parser | PASS |
| 정적 PREP harness | PASS |
| 실행 stack 요구 harness | PASS |
| Auth HTTP health | PASS |
| local DB identity | PASS |
| `public.inventory_*` 개수 | 0 |
| behavioral contracts | 0 PASS / 0 FAIL / 34 PENDING IMPLEMENTATION |
| 검증 후 QA stack 중지 | PASS, 전용 volume 보존 |

시작 직후 검증이 먼저 실행되는 race condition과 Windows PowerShell 5.1의 `ConvertFrom-Json -Depth` 비호환을 실제 실행에서 발견해 수정했다. wrapper는 대상 DB가 healthy가 될 때까지 제한 시간 내 대기하고, verifier는 정확히 한 개의 대상 container만 허용한다.

Supabase CLI의 로컬 서비스가 Windows에서 `0.0.0.0`에 publish되는 점을 고려해 최종 검증 후 `inventory_qa` stack만 중지했다. 전용 volume은 재실행을 위해 보존했고 기존 `bogunon` container ID와 상태는 유지됐다.

## 변경하지 않은 범위

- 운영 DB 변경·조회: 0건
- 운영 프로젝트 연결: 0건
- 실제 학교 데이터 사용: 0건
- 제품 migration/RPC/schema 작성 또는 실행: 0건
- 기존 BOGUNON 및 Purchase Helper 제품 코드 변경: 0건
- commit, push, PR: 0건

## 잔여 게이트

1. 운영 migration/RLS/RPC 실제 적용 상태
2. 운영 plan, backup/PITR, 복원 runbook과 책임자
3. 실제 재고 권위 원본과 실물 조사 기준일
4. 학교·강사 이력·단위·초과입고 등 미승인 업무 정책
5. IM-1B 구현에 대한 사용자 명시적 승인

## 판정

`READY` — IM-1B-PREP의 격리 로컬 QA 기반과 계약 테스트 준비는 완료됐다. 이는 IM-1B 구현, 운영 배포 또는 데이터 이전 승인이 아니다.

