# IM-1B-PREP 보안 경계

## 강제 경계

- 운영 project ref는 로컬 config에서 발견되면 실행 거부한다.
- `https://`와 `supabase.co`가 로컬 config에 있으면 실행 거부한다.
- 운영 URL, API key, DB password, Auth 사용자, Storage, dump를 사용하지 않는다.
- 실제 학교명·교직원 이메일·품목·수량을 fixture에 사용하지 않는다.
- 로컬 `.temp/`, `.branches/`, report 출력은 Git 추적에서 제외한다.
- CLI의 status는 로컬 자격증명을 출력하므로 wrapper에서 사용하지 않는다.
- 제품 migration과 seed는 PREP에서 적용하지 않는다.

## IM-1B 보안 테스트 필수 항목

RLS만으로 완료로 판단하지 않는다. 다음을 Postgres/Data API에서 각각 검증해야 한다.

1. exposed schema와 Data API 노출 여부
2. anon/authenticated의 table·sequence·function GRANT/REVOKE
3. teacher_admin과 instructor의 RPC EXECUTE 범위
4. `SECURITY DEFINER` owner, 고정 `search_path`, `auth.uid()`와 활성 membership 검증
5. client 제공 `school_id`, 다른 tenant `item_id`·`lot_id` 거부
6. 비활성 membership과 비인증 요청 거부
7. composite FK 또는 동등한 서버 검증으로 cross-tenant 참조 차단

## 로컬 네트워크 위험

Windows의 Supabase CLI가 컨테이너 포트를 `0.0.0.0`에 publish한다. 로컬 기본 키는 운영 비밀이 아니지만 인증 없는 Studio/pgMeta/analytics를 포함하므로 장시간 기동하지 않는다. 이번 검증 후 stack은 전용 volume을 유지한 채 중지한다.

## 운영 게이트

운영 DB에는 접근하지 않았다. 운영 배포 전에는 최소 schema-only metadata, migration 적용 상태, RLS·정책·RPC 정의와 execute grant, 백업/PITR 활성 상태를 Dashboard 또는 승인된 관리 경로에서 별도 확인해야 한다.

