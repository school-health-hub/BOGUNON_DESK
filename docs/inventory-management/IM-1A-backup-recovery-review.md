# IM-1A 백업·복원 검토

## 공식 기능

Supabase 공식 문서 기준 Pro/Team/Enterprise 프로젝트는 일일 자동 백업을 제공하며 보존은 각각 최근 7/14/최대 30일이다. PITR은 유료 add-on이며 Pro 이상과 Small 이상 compute가 필요하고, 최악 RPO는 약 2분이다. PITR 활성 시 일일 백업 대신 PITR을 사용한다. 복원 중 프로젝트는 접근 불가하며 DB 복원은 Storage 객체 본문을 복원하지 않는다.

참고: <https://supabase.com/docs/guides/platform/backups>

## 실제 프로젝트 판정

코드가 가리키는 Supabase project ref는 확인했으나 연결된 Supabase 계정의 프로젝트 목록에는 없었다. 목록에 보인 다른 프로젝트는 운영 여부가 불명확해 조회하지 않았다. 따라서 다음은 모두 `NOT VERIFIED`다.

- 실제 플랜과 자동 백업 활성 여부
- PITR 활성 여부와 보존기간
- 최신 복구 가능 시점
- 복원 권한자·운영 책임자
- migration 전 백업/복구 리허설

## IM-1B/이전 전 운영 게이트

프로젝트 소유자가 Dashboard의 Database > Backups 화면을 함께 확인하고, 백업 유형·earliest/latest restore point·보존기간·복원 담당자·예상 downtime을 기록해야 한다. 별도 합성/비운영 프로젝트에서 복원 절차를 검증하며 운영 복원은 실행하지 않는다. Storage가 범위에 포함되면 DB와 별도 백업 계획을 둔다.

