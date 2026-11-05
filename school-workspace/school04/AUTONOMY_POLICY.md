# Cloud C SCHOOL 작업 자율 QA와 보존

사용자가 승인한 Inspect → Reproduce → Fix → Test → Recheck → Commit/Push → Report 정책을 SCHOOL04 범위에 적용한다. 각 결함의 실질적으로 다른 수정은 최대3회이며 evidence/QA_FIX_LOG.json에 재현·원인·수정·집중 검증을 남긴다. 관련 테스트·회귀·신규 타입 오류·보안 검사를 통과한 변경만 전용 feature에 일반 commit/push한다. 원격 SHA·divergence·clean을 확인한다. 기존 미커밋 단계는 원본 ZIP/Manifest 검증 후 누적 feature에 보존할 수 있다.

이 정책은 운영 Supabase DB/Auth/RLS/GRANT/Realtime 변경, 기존 경고 함수 수정, main/통합 브랜치 병합, 배포, 실제 사용자/학교/학생 데이터 사용, 권한·개인정보 정책 의미 변경, 강제 push, WorkerW 활성화, 기존 EXE 덮어쓰기, 유료 서비스 사용을 허용하지 않는다. 해당 필요 항목만 분리하고 안전한 로컬 작업은 계속한다. Cloud B의 전체 Electron 통합·실제 Windows 빌드/GUI QA 권한을 승계하지 않는다. LOCAL DB/MOCK/BROWSER/WINDOWS REAL/HOSTED 결과를 구분하고 CONDITIONAL을 운영 PASS로 확대하지 않는다.
