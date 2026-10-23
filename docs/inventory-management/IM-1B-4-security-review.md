# IM-1B-4 보안 검토

- 네 RPC는 `SECURITY DEFINER`, 빈 `search_path`, 완전 수식별 객체를 사용한다.
- PUBLIC/anon 실행은 철회하고 authenticated에만 실행권한을 부여한다.
- 실제 권한은 함수 내부의 `auth.uid()`, 활성 학교, 활성 `teacher_admin` membership으로 결정한다.
- instructor, 위조 user metadata, 타학교 식별자는 거부한다.
- 직접 lot/movement/audit/idempotency DML 권한은 추가하지 않았다.
- 운영 Supabase에는 연결하거나 적용하지 않았다.

