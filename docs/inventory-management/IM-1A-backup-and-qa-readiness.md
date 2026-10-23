# IM-1A 백업 및 합성 QA 준비도

## 백업·복원

Supabase 공식 문서상 Pro/Team/Enterprise의 일일 백업 보존은 각각 7/14/최대 30일이며 PITR은 별도 add-on이다. 복원 중 프로젝트는 접근 불가하고 DB 복원은 Storage 객체 본문을 복원하지 않는다.

- 공식 문서: <https://supabase.com/docs/guides/platform/backups>
- 현재 프로젝트 plan: NOT VERIFIED
- 자동 백업 및 최근 백업: NOT VERIFIED
- PITR 및 earliest/latest restore point: NOT VERIFIED
- 복원 책임자와 사고 대응 절차: NOT VERIFIED

PITR이 없다면 migration 전 schema-only dump와 승인된 암호화 DB backup, SHA-256 manifest, 별도 보관 위치, 복원 runbook을 마련해야 한다. 실행은 이번 범위에 포함하지 않았다. Auth provider 설정, redirect URL, Vercel env 이름/target, Storage 객체 및 정책도 DB backup과 별도로 inventory 해야 한다.

## QA 환경

| 항목 | 상태 |
|---|---|
| 전용 QA Supabase 프로젝트 | 발견하지 못함 |
| 운영과의 격리 증거 | 없음 |
| Docker Desktop/engine | 설치 및 server 응답 확인 |
| Supabase CLI | 설치되지 않음 |
| 로컬 migration | BOGUNON 저장소에 존재 |
| 합성 Auth 사용자/seed | Inventory 전용 구성 없음 |
| RLS/RPC test harness | Inventory 전용 구성 없음 |
| 정리 방식 | 아직 계약만 존재 |

최소 합성 QA 환경은 운영과 분리된 project ref 또는 로컬 Supabase, pinned CLI/runtime, migration-only schema, 합성 school/teacher/instructor/item/lot seed, pgTAP 또는 역할별 API test harness, deterministic cleanup batch로 구성한다. 실제 학교 데이터를 복제하지 않는다.

IM-1A의 33개 QA 계약을 그대로 실행 목록으로 사용하며 새 중복 계약은 만들지 않는다. 현재 상태는 `PARTIALLY READY`: Docker 기반은 있으나 CLI, 전용 schema, 합성 Auth fixture가 없다.

