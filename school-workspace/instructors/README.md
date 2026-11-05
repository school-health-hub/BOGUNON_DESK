# INSTRUCTOR-02 — 보건지원강사 근무관리

판정: **CONDITIONAL**. 기존 업무 기능과 합성 공유 환경의 이식은 구현했지만 Hosted Supabase/운영 웹 연결 및 실제 Windows 출력은 검증하지 않았다. 지급명세서의 개인 도장 배치는 아래 제한을 따른다.

## 원본과 재사용

- DESK 기준: `142c2d9bcf0f2831e10191de30e9d640fb2d83e5`.
- 원본: `sungandi86-max/bogunon`, `main`, **38f99cc868253828544f5986629a4ee829db3b8d**.
- `origin.json`에 원본 파일 경로와 SHA-256을 기록했다. 원본 저장소에는 쓰지 않았다.
- `lib/health-support-instructors/domain.ts` → `core/domain.ts`: **바이트 단위 동일**. 시간·ISO 주차·반올림·월 임금·고정 보험료·예산 계산 유지.
- 원본 `settlement/documents.ts` 및 대조 fixture/테스트 → `core/settlement/`.
- 원본 `import/work-log-import.ts` 및 테스트 → `core/import/`.
- 원본 repository의 입력 스키마 → `core/validation.ts`. 기존 개인 DB 조회·Next Supabase client는 복사하지 않았다.
- 원본 `InstructorSettingsForm`, `Dashboard/SettlementPanel`, `PaymentStatementPreview`를 선별 재사용했다. Next 의존성·브라우저 Blob 다운로드는 어댑터로 분리했다.
- 지급명세서의 기존 4열 행 생성·시트명·금액 → `core/payment-workbook.ts`. 출근관리부의 6열·빈 서명·교사 확인란은 `AttendancePreview`에서 재사용했다. 기존 개인 도장/개인 이름/강사 확인 체크는 복사하지 않았다.
- SheetJS **0.20.3** 원본 의존성 재사용. Apache-2.0, 라이선스 `SHEETJS-LICENSE.txt`. XLSX 코드는 Main 작업자에 번들되며 Renderer/Web에서 파일시스템을 읽지 않는다.

원본의 일반 계산 결과는 기존 테스트로 대조했다. 발견된 두 경계 결함만 문서 어댑터에서 보완했다: 주 한도가 14 미만일 때 경고 기준을 한도 이하로 제한하여 원본 검증 충돌 방지, 비고 lookup에 instructorId 추가. 시급·보험료·시간 계산식은 변경하지 않았다. 휴게시간 자동 공제는 원본에 없으므로 추가하지 않았다.

## 화면·역할

`우리 보건실 → 보건지원강사 근무관리`.

- 교사/학교 관리자: 원래 관리 권한 관례에 따라 설정, 월별 기록 CRUD, 시간/누적 집행/잔액, 정산, Excel 가져오기, 출근관리부/지급명세서 미리보기·출력.
- 보건지원강사: 같은 학교의 월별 날짜·시작·종료·시간과 월 합계만 조회. 직접 출퇴근·수정·승인·다른 강사 관리 기능 없음.
- `ProductWorkspace → Workspace04 → InstructorWorkspace`를 DESK와 웹에서 재사용. 웹 조회 화면에는 급여·예산·보험료·교사 비고·개인 도장 관리가 없다. Mobile First 표/버튼 배치, 기존 TD2 스타일과 SurfaceDialog의 모달 포커스·inert·Escape·복귀를 사용한다.
- 학교/계정/세션 전환 시 기존 scope/epoch와 controller generation/AbortController로 요청을 정리하고 늦은 결과를 버린다. 입력·저장 실패를 성공으로 표시하지 않는다.

## 공유 저장·운영 경계

`sql/candidate.sql`은 **검토 후보**이며 `school01a` 로컬 DB guard가 있다. Hosted migration 폴더에 등록하지 않았고 운영 적용하지 않았다.

- 기존 SCHOOL-05 auth UUID → actor → 승인된 school/membership/role/session 계약 재사용. 새 로그인·역할·계정 테이블 없음.
- 신규 `workspace.instructor_schedules`: 학교 UUID PK(학교당1명), 기존 원시 필드의 settings/logs JSON, 전체 version, updated_at. 기존 개인 `public.health_support_*` 테이블은 조회·변경·이전하지 않는다.
- 서버 RLS + purpose RPC에서 교사/관리자 쓰기, 강사 제한 읽기 강제. authenticated의 테이블 직접 조회 금지. 시급/보험료/예산/비고는 강사 응답에서 제외한다. 도장 필드는 공유 스키마에서 허용하지 않는다.
- 기존 `enter/member_role/receipt/finish`로 세션·학교·요청 ID·version 충돌을 검증. 가져오기는 한 트랜잭션이며 오류 시 일부 행만 반영하지 않는다. 재시도는 원래 requestId/동일 payload이면 중복 저장하지 않는다.
- 조회 응답의 학교/역할/스키마를 검사하고, 시간 계산은 원본 JavaScript 함수를 사용한다. SQL numeric round와 JS toFixed가 다른 1.005h 경계도 원본과 일치한다.
- 기존 QA runtime/provider와 `/api/workspace` BFF를 확장했다. 운영 gate를 제거하지 않았다. 제품이 packaged이거나 운영 연결이 없으면 기존대로 “공동 기능 연결 준비 중”. 합성 저장은 화면에서 운영 저장으로 표시하지 않는다.
- 운영 활성화는 기존 SCHOOL WORKSPACE 담당자의 provider/DB/RPC/RLS/GRANT 검토·승인·배포가 필요하다. 이 후보를 guard만 지워 운영에 적용하면 안 된다.

## Excel·출력

- Main 파일 선택만 허용. Renderer는 school/month/version과 제한된 동작만 전달하며 경로나 원본 bytes를 전달하지 않는다.
- XLSX 최대10MiB, 원본 9열/`근무기록` 시트/수식 입력 거절/정확 중복 판별 유지. 기존 `.xls` 선택 표시와 실제 파서 간 차이를 그대로 지원으로 주장하지 않고 **XLSX만 선택**한다.
- 파서 상한은 원본의 헤더+5000행이다. 전체 파일 바이트/작업자 메모리128MiB/5초 제한을 별도로 적용했다. 가져오기 적용은 한 번에 최대1000행, 요청 JSON1MiB. 공유 총 기록 최대5000행/JSON4MB. 초과·손상·시간초과는 실패로 처리하며 기존 자료 유지. 대형 자료는 아직 규모 실사용 검증하지 않았다.
- Excel은 Main 작업자에서 원본 워크북 생성 후 기존 `writeSelectedExport`의 원자적 저장·덮어쓰기 확인을 사용한다. userData 내부 덮어쓰기 금지. 취소·실패는 저장 성공으로 표시하지 않는다.
- 인쇄는 미리보기 확인 → Main 네이티브 확인 → 비silent 인쇄. 취소하면 생성/인쇄하지 않는다. 생성 파일과 페이지 수의 실제 Windows 확인은 NOT RUN.
- 출근관리부: A4 세로/12mm, 원래 열과 교사 확인란 유지. 도장 이미지는 기존 행의 확인 영역 안에서 절대 배치해 표 높이를 늘리지 않으며 비율 유지. named page로 다른 모듈 인쇄 설정에 영향을 주지 않는다.

## 개인 도장

- DESK `설정 → 개인 도장`. PNG/JPG/JPEG 선택·미리보기·저장/교체·확인 후 삭제. 2MiB, 가로·세로8~1024px, 최대1,048,576픽셀. 실제 PNG/JPEG 헤더 검사 → Electron nativeImage 디코딩 → PNG 재인코딩. 원본 파일은 읽기 전용이며 EXIF 등 원본 부가정보를 저장하지 않는다. SVG/HTML/실행파일·애니메이션 PNG·손상·과대·symlink 경로 거절.
- 경로: **현재 Electron userData/work-data/instructor-private/SHA256(로그인 UUID)/stamp.json**. 원본 선택 파일을 이동하지 않고 정규화된 개인 사본만 보관. QA는 기존 userData 격리 경계를 따른다.
- Windows safeStorage(사용 가능할 때만)로 이미지 내용을 암호화. 평문 이미지를 설정 JSON/공유 DB/서버/로그에 저장하지 않는다. 로컬 파일은 제한 권한 및 기존 SettingsStore 원자적 교체/Windows EPERM 재시도를 재사용한다. 손상 파일은 자동 초기화하지 않는다.
- Main이 현재 승인 학교·관리 역할·인증 UUID와 generation을 매번 확인한다. Renderer가 다른 계정 UUID/파일 경로를 지정할 수 없다. 강사·웹에서 이 파일 IPC에 접근할 수 없다. 이미지 원본은 Git에 포함하지 않았다. 테스트 JPEG는 개인 식별 없는 생성 사각형 fixture이다.
- **출근관리부:** 출력마다 기본 미포함. 미리보기에서 명시적으로 체크하면 교사 확인란에 본인 도장만 포함. 강사 서명란은 빈칸. 취소/다시 열기/월 변경 시 체크 초기화.
- **지급명세서:** 원본에는 서명·날인 영역이 없다. 임의 위치 삽입을 금지한 요구에 따라 도장 포함은 비활성화하고 미리보기에서 이유를 표시한다. 미포함 인쇄/Excel은 지원. 지급명세서 도장 포함은 **PARTIAL/날인 영역 확인 필요**이며 구현 완료로 주장하지 않는다.

## 검증·재현

- 기존 SCHOOL-05 `run-local.sh`는 로컬 bootstrap에 candidate를 추가한다. 같은 기존 Vitest 설정에 이 모듈 테스트를 포함했다. 새 workflow/Portable/별도 앱은 만들지 않았다.
- 빌드 후 기본 집중 명령:
  - `npm run electron:p0:build`
  - `node node_modules/typescript/bin/tsc -p school-workspace/school05/tsconfig.json`
  - `node node_modules/vite/bin/vite.js build --config school-workspace/school05/vite.config.ts`
  - 기존 로컬 SCHOOL-05 DB 실행 상태에서 `node node_modules/vitest/vitest.mjs run school-workspace/instructors school-workspace/school05/tests/boundary.test.ts school-workspace/school05/tests/product-ui.test.tsx school-workspace/school05/tests/web-generation.test.ts --maxWorkers=1`
- `database.test.ts`는 network-none 로컬 합성 PostgreSQL만 사용하며 기본 컨테이너 `bogunon-school05-pg`; 이번 작업은 독립 소유 `bogunon-instructor02-local`을 사용했다. 운영 DB 주소 입력 기능 없음. fixture reset은 해당 테스트 DB에만 적용한다.
- 신규 모듈+SCHOOL-05 경계/UI/generation **64 PASS**. 기존 SCHOOL-05 product DB 회귀(공동 업무/일정/인수인계, 계정 차단) **2 PASS**. 원본 계산/문서/import 테스트30건 포함. 빌드된 실제 Main XLSX worker 오프라인 왕복·ASAR 포함 glob/native CLI5/OCR 선언 검사 포함.
- Electron Main/Preload/Renderer/기존 테스트 타입 검사 및 production build PASS. 웹 typecheck/build PASS. 신규 테스트도 학교 workspace typecheck 범위에 포함했다. root typecheck는 기존13건 유지(새 오류0). lint/typecheck npm script는 없으므로 만들지 않고 실제 tsc 명령을 사용했다.
- 일반 수정: worker SSR 출력명이 호출 경로와 다르던 문제는 명시적 entryFileNames로 고치고 **실제 worker 실행**으로 확인했다. 원본 alias/새 테스트 타입 오류도 수정했다.

## Cloud B 인계 / NOT RUN

1. 운영 Hosted Supabase·실계정 로그인·승인된 실제 학교 간 공유·운영 웹 배포: **NOT RUN/운영 미연결**. 로컬 성공을 운영 PASS로 승계하지 않는다.
2. Windows 실제 GUI, 980×700/모바일 실화면, DPAPI·nativeImage 실제 디코더, 원본 인쇄 양식/페이지 수·네이티브 인쇄 취소·파일 저장: **NOT RUN**. PNG 투명도/비율·암호화/격리는 합성 fixture와 모의 보안 저장소로 검증했다.
3. 실제 ASAR 실행·native CLI 실행·Portable: **NOT RUN**. 선언/번들 포함 계약만 검사했으며 기존 CLI5/OCR/패키징 설정을 변경하지 않았다.
4. 지급명세서 도장 포함: 원본 날인 위치 확인 전 **미지원**. 새 위치를 임의 확정하지 않는다.
5. 개인 웹 자료·도장 자동 이전 없음. 학교 간 자동 복사·강사 승인·서버 인증 구조 변경 없음.
6. 통합은 기준 원격이142c2d9…로 유지되면 이 기능 브랜치에서 fast-forward 가능. 실제 통합/운영 적용은 수행하지 않는다.
