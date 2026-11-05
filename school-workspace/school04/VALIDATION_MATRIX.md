# SCHOOL04 필수 검증 대응표

신규 Vitest 22건은 LOCAL DB 계약 16건, React/Main/LOCAL DB 통합 3건, MOCK 상태 3건이다. Chromium 15항목은 같은 기능의 화면 계층 검증이므로 별개의 고유 시나리오 합계로 확대하지 않는다. Auth·Windows 암호화·IPC 전송은 MOCK이다. 모든 DB 결과는 로컬 PostgreSQL에 한정한다.

| 요구 항목 | 실행 근거 |
| --- | --- |
| 1 관리자 일정 생성·수정·취소 | contracts admin/teacher 1 |
| 2 교사 일정 생성·수정 | contracts admin/teacher 3 |
| 3 지원강사 일정 수정 거부 | contracts assistant read only |
| 4 타 학교 일정 차단 | 같은 테스트의 other school get |
| 5 종일·시간 일정 | contracts all-day endpoints 및 browser timed/all-day |
| 6 날짜 범위·Seoul 표시 | contracts all-day/range, browser Seoul09:00 |
| 7 일정 version 충돌 | contracts concurrent version 및 NULL direct SQL |
| 8 request_id 중복 | contracts idempotency same/different payload |
| 9 인수인계 작성·대상 | contracts direct targets 및 teacher completion cross-school target |
| 10 대상 범위 조회 | contracts direct targets, teacher/non-target deny |
| 11 관리자 학교 범위 | contracts direct targets/admin + cross-school deny |
| 12 타인 읽음 거부 | contracts ack self-only/admin proxy deny |
| 13 읽음 중복 | contracts unique ack + receipt replay |
| 14 수정 후 새 확인 | contracts edit forces new revision, open detail refresh, browser reack |
| 15 신규 회원 과거 의무 금지 | contracts role targets snapshot, new/rejoined epoch |
| 16 지원강사 작성·수정 제한 | contracts assistant default/explicit grants |
| 17 회수·만료·정지·세션 만료 | contracts revocation/deny/live expiry + ui-db clearing |
| 18 타 학교 인수인계 ID | contracts direct targets other school |
| 19 학교 전환 전 계층 격리 | ui-db delayed A/B tasks/events/notes + MOCK clear |
| 20 네트워크 성공 오표시 방지 | ui-db failed ack + MOCK stable nonce + browser reconnect |
| 21 Electron 980×700 | Chromium desktop-calendar-980x700, overflow/touch checks; WINDOWS REAL NOT RUN |
| 22 Web 모바일 | Chromium mobile-calendar/mobile-handover-ack |
| 23 개인 일정 불변·서버 장애 독립 | ui-db private calendar unchanged + offline personal save; 기존 local-events 회귀 |
| 24 SCHOOL03 회귀 | SCHOOL04 확장 스키마 동일 DB에서 기존 21건; 별도 원래 DB+브라우저13항목 |
| 25 SCHOOL02 회귀 | SCHOOL04 확장 스키마 동일 DB에서 기존 22건; 별도 원래 DB+브라우저14항목 |

추가: 실제 RLS/GRANT catalog 검증, 비소유자 NOBYPASSRLS, 원시 테이블 SELECT·이력 삭제 거부, 개인정보 차단 무잔존 및 audit 실패 시 변경·이력·target rollback, 기존 Auth59 및 제품 집중 회귀102를 실행한다. 화면 캡처는 Chromium이며 실제 Windows GUI로 표기하지 않는다.

HOSTED SUPABASE와 WINDOWS REAL은 NOT RUN/NOT VERIFIED다. 기존 루트 오류 13개는 깨끗한 기준 SHA 재현과 문자열 동일 비교를 남긴다. 신규 엄격 타입 검사 및 Electron 빌드와 분리한다.
