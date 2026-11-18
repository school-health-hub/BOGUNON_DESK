# QA SUMMARY

제품 Source SHA: d03a58fa7f73411aa2cdb9ebd31c0d8527e21947.
Portable2050489… / NSIS760FE269…의 전체 SHA와 파일명은 RC-METADATA.json 및 SHA256SUMS.txt에 고정한다. 아래는 기존 증거의 통합이며 새로운 테스트 실행 결과가 아니다.

|검증 항목|판정/근거 유형|원본|제한|
|---|---|---|---|
|Portable launcher 실제 실행·정상 종료|PASS, 최종 EXE 직접|[S02](EVIDENCE-INDEX.md#s02), [S03](EVIDENCE-INDEX.md#s03), [S06R](EVIDENCE-INDEX.md#s06r)|기본 실행과 기재된 흐름에 한정|
|주요 로컬 기능·4개 창 크기|PASS 근거 재사용|[S01](EVIDENCE-INDEX.md#s01), [S02](EVIDENCE-INDEX.md#s02)|이전7248D584… packaged payload의 넓은 GUI. 최종2050489…와 코드/CLI 동일성 근거로 재사용. 최종 EXE에서 전부 재실행한 것으로 표시하지 않음|
|13개 위젯 ON/OFF·메모·일정·재실행|PASS 근거 재사용 및 설치본 직접 보완|[S01](EVIDENCE-INDEX.md#s01), [S08](EVIDENCE-INDEX.md#s08)|설치본은13개 선택 목록/합성 메모/알림 표시 설정 복원. 모든 위젯 drag/resize·실제 DPI를 새로 검사한 것은 아님|
|공문/Record/Purchase/Inventory/Newsletter/Finder|PASS 부분 범위|[S01](EVIDENCE-INDEX.md#s01), [S08](EVIDENCE-INDEX.md#s08)|공문 편집/취소·ODT, Record 합성 추출/취소, Purchase 계산/XLSX, Inventory 합성 입고, Newsletter 프로젝트 저장/불러오기, Finder 합성 JSON/메모 등 원문 명시 부분. 모든 업무/완성 출력/외부 서비스 PASS 아님|
|Supabase 실제 로그인·취소·로그아웃|PASS, 최종 Portable 직접|[S03](EVIDENCE-INDEX.md#s03)|사용자 본인 직접 인증. 계정 이름/암호/토큰 미수집. 강제 실패/timeout/장시간 만료 미검증|
|Supabase 종료·재실행 세션 복원·프로필 분리|PASS, 최종 Portable 직접|[S03](EVIDENCE-INDEX.md#s03)|독립 UUID 프로필 A/B 범위. 다른 Windows 계정 전체 아님|
|ChatGPT 실제 인증·앱 복귀|PASS, 사용자 인증/로컬 상태|[S04](EVIDENCE-INDEX.md#s04)|ready 및 identity 존재 확인. 동시 Supabase 인증 공존 미검증|
|ChatGPT 실제 모델10개 조회|PASS, 세션 재사용·DOM 일치|[S05](EVIDENCE-INDEX.md#s05)|선택 gpt-6.2-sol. 계정별 관측값이며 전체 제공 모델 목록 보증 아님|
|실제 AI 생성/응답·생성 취소|NOT RUN|[S05](EVIDENCE-INDEX.md#s05)|외부 생성0건. 비용·잔여량·한도 미확정|
|인증 관련 기존 자동 테스트|38 PASS, 기존 합성 근거|[S04](EVIDENCE-INDEX.md#s04)|account16/ChatGPT22. 다른 단계의37+패키지1과 중복 합산하지 않음. 전체 회귀/실제 네트워크 성공과 별개|
|Windows Native 파일창|13 PASS/0 FAIL/0 NOT RUN, 실제 GUI|[S06](EVIDENCE-INDEX.md#s06), [S06R](EVIDENCE-INDEX.md#s06r)|합성 파일·해당 포맷/취소/저장/덮어쓰기 거부. 정상 사용자가 선택한 모든 외부 문서의 OS 접근 차단을 뜻하지 않음|
|NSIS 생성·정적 QA|PASS|[S07](EVIDENCE-INDEX.md#s07)|미서명/asInvoker. 추출281파일/staging 해시 일치, 필수 runtime/CLI 및 테스트 파일 제외|
|실제 NSIS 설치·실행·제거·재설치|PASS, 집 PC 직접|[S08](EVIDENCE-INDEX.md#s08)|HKCU/일반 사용자, E: 설치 및 전용 합성 프로필. 다른 버전 업그레이드/학교 PC 정책 아님|
|합성 데이터·기존 실제 사용자 자료 보존|PASS, 해시·GUI|[S08](EVIDENCE-INDEX.md#s08)|제거 후 QA117파일 SHA, 핵심메모/layout, 최종 기존1796파일 차이0. 전체 PC의 모든 파일 불변 보증 아님|
|QA 도구 GitHub 보존|PASS|[S09](EVIDENCE-INDEX.md#s09)|원격 복원17파일/fixture5개 해시 일치, 새 매개변수화 도구 최소Native1 PASS. 원본13건과 구분|

실제 계정 인증은 상태 증거가 중심이며 인증 화면 캡처가 없는 항목을 시각 캡처 PASS로 표시하지 않는다. 초기 QA 도구 실패와 교정 기록을 원본에서 삭제하거나 성공으로 덮어쓰지 않았다.
