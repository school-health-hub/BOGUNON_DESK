# Electron 학교 업무 시스템 연결 경계

기준 제품: `967319ddb1c20da045901f37cfe262d31e906571`.
기능 브랜치: `feature/electron-school-launcher-completion`.

## 사용자 흐름

1. 기존 초기 설정에서 NEIS 공개 학교 검색 후 학교를 명시적으로 선택한다. 학교명·학교코드·교육청코드의 공통 프로필을 그대로 사용한다. 공개 학교 검색은 교직원 나이스 인증이 아니다. BOGUNON 계정 연동은 계속 미지원이다.
2. 기관이 안내한 공식 주소와 소속 교육청을 직접 대조하여 학교망/eVPN별 업무포털·나이스·K-에듀파인 주소와 eVPN 접속 페이지를 등록한다. 미등록 주소는 설정으로 안내한다. 저장 자체가 공식 출처 검증은 아니다.
3. 사용할 환경을 수동 선택한다. 마지막 선택은 기존 JSON에 저장된다. 환경 전환은 VPN 연결·인증서 로그인·세션 공유·자동 제출을 수행하지 않는다. 학교 변경 시 주소·복무 초안·표를 자동 변경하지 않는다.
4. `주소 연결 확인`은 Main의 네이티브 동의 후에만 비로그인 HEAD 요청을 수행한다. 브라우저 열기도 네이티브 확인 후 HEAD 확인을 수행한다. 브라우저 실행 요청 완료, HTTP 응답, 실제 학교망 접속, 인증 성공은 서로 다른 결과다.
5. 접근 거부·확인 시간 초과·HEAD 미지원·다른 출처 이동 등 불확실한 결과는 정확한 안내와 두 번째 확인을 거쳐 **원래 등록 주소만** 기본 브라우저에 전달한다. 위험한 이동과 반복 리디렉션은 실행을 차단한다. 이미 열린 외부 브라우저는 취소로 닫지 않는다.

## Main / Preload 보안

- 기존 sender window/frame/URL 및 인자 수 검사를 유지한다. 새 IPC는 `p2:admin:checkSystem(system)` 하나이며 `system`은 `portal | neis | edufine | evpn`뿐이다. Renderer가 URL·경로·HTTP 옵션을 지정할 수 없다.
- `safeAdminLaunchUrl`은 HTTPS, 기존 기관 도메인 범위(`*.go.kr`, `*.edu.kr`, `eduptl.kr`, `k-eduplus.kr` 및 하위 도메인, 정확한 예외 `evpn.gbe.kr`), 유효한 DNS label만 허용한다. 사용자정보·비기본 포트·query·fragment·제어문자·역슬래시·인코딩된 경로 구분자는 거부한다. 도메인 형식만으로 개별 기관의 공식성을 보증하지 않는다.
- 구형 JSON 검증 함수 `officialAdminUrl`은 유지했다. 예전에 허용됐던 주소도 읽기/무관한 초안 저장에서 사라지지 않는다. 새 주소와 실제 실행은 엄격하게 검사한다. 자동 마이그레이션·초기화는 없다.
- 별도 비영구 Electron session `admin-launcher-check`에서 HEAD만 허용한다. permission과 다운로드를 차단하며 Renderer의 기존 닫힌 네트워크 정책은 바꾸지 않는다. `credentials:omit`, `cache:no-store`, `redirect:manual`, 요청 본문 없음. 활성 Main probe 출처에만 한정한 client-certificate 거부 핸들러로 OS 인증서 자동 선택을 막고 NTLM 자격증명 자동 사용도 허용하지 않는다. 다른 기능의 인증 경로는 변경하지 않는다. 학교 프로필·원고·Excel·비밀번호를 보내지 않는다.
- 전체 확인 제한 8초, 최대 HEAD 4회, 동일 출처의 안전한 HTTPS 이동만 제한적으로 따라간다. 다른 출처·query·fragment 이동은 따라가지 않는다. 로그인 경로는 인증 요구 안내일 뿐 로그인 성공이 아니다. 응답 본문은 사용하지 않고 취소한다. 원본 Location/query나 서버 오류 내용은 Renderer/로그에 반환하지 않는다.
- 작업 취소·창 종료·navigation·renderer 종료 시 AbortController 및 세대 검사를 통해 늦은 결과와 브라우저 실행을 차단한다. 동의 도중 학교·주소·선택 환경이 바뀌면 다시 확인하도록 한다.
- **한계:** HEAD 결과는 실제 브라우저 GET/JavaScript/쿠키/인증서 흐름과 다를 수 있다. OS 기본 브라우저에 넘긴 후의 이동을 Electron이 통제하거나 모두 검증할 수는 없다. 따라서 인증 성공·접속 가능성을 자동 확정하지 않는다. 공인 인증서·학교 계정·로그인 쿠키 저장이나 인증 우회는 구현하지 않는다.

## 기관 URL 근거 조사 (2026-11-04, 공개 페이지 읽기 전용)

기관별 자동 기본값은 `school-protocol.ts`의 기존 `OFFICE_LAUNCHER_URLS`를 유지했다(17개 교육청 모두 빈 항목). 아래 공개 응답만으로 교직원용 시스템별 주소의 공식 근거와 학교망/eVPN 유효성을 확정할 수 없어 추가하지 않았다.

| 확인한 공개 출처 | 확인 범위 / 제한 |
| --- | --- |
| https://www.neis.go.kr/nxuiPortal/index.html | 공개 NEIS Nexacro 진입 문서 응답. 교직원 업무용 주소·권한을 보증하지 않음 |
| https://help.neis.go.kr | 공개 클라이언트 문서. 교육청별 업무망 URL 근거 미확보 |
| https://www.pen.go.kr/main/main.do | 부산교육청 공개 페이지 응답. 자동 기본값에 사용할 업무포털/eVPN 근거 미확보 |
| https://www.cbe.go.kr/cbe/main.do | 충북교육청 공개 페이지 응답. 학생/학부모 공개 서비스와 교직원 업무망을 구별 |
| https://www.cberi.go.kr/home/sub.do?menukey=337 | 충북교육연구정보원 나이스자료실 공개 페이지. 업무망 URL 근거 미확보 |
| https://www.goeia.go.kr/goeia/main.do | 경기교육정보기록원 공개 페이지. 업무망 URL 근거 미확보 |
| https://evpn.goe.go.kr | SSL VPN 클라이언트 진입 문서 응답만 확인. 인증·접속 및 공식 링크 관계 미검증이므로 기본값에 추가하지 않음 |

페이지 응답/HTTP 200은 실제 학교망 접근 PASS가 아니다. 학교·교육청이 제공한 공식 안내 링크를 확보한 후에만 `url / evidence / verifiedOn` 레지스트리에 별도로 검토 등록해야 한다. 추측한 도메인 패턴을 17개 교육청에 일괄 적용하지 않는다.

## 데이터와 기존 기능

기존 `AdminStore` 원자적 저장·revision 충돌·백업·복구 readonly 계약, 복무 초안·양식, CSV/XLSX 입력/행 매핑 및 검토용 CSV 출력은 재사용한다. 학교 프로필 저장소와 행정 데이터 저장소는 계속 분리하며 학교 변경 시 자동 수정하지 않는다. TD2 Glass / Dashboard / AI / Purchase / Finance / Inventory / Tauri와 native CLI 제품 소스는 변경하지 않는다.

## 검증 및 학교 PC 인계

Cloud 집중 검증은 합성 URL·모의 HTTP 응답으로 상태·동의·리디렉션·취소·sender/arity·stale-context·구형 JSON 보존을 확인한다. 기존 학교 프로필·NEIS 검색 모의 응답·학교 선택·주소 환경·초안·CSV/XLSX 회귀와 Electron 타입/production build, Main/Preload ASAR 의존성 검사를 수행한다. 기관 접속 성공 테스트와 혼동하지 않는다. lint/standalone typecheck 스크립트는 없으며 `electron:p0:build`가 해당 TypeScript 검사를 포함한다.

학교 PC 후속 항목(NOT RUN):
- 실제 Windows 기본 브라우저 실행/오류, 인증서/보안 프로그램 및 네이티브 확인창.
- 소속 기관 안내와 학교망/eVPN별 실제 주소 대조, 사내망 DNS/정책, 수동 eVPN 접속 후 교직원 시스템 접근 및 공식 로그인.
- HEAD 미지원/SSO/GET·JavaScript 이동의 실제 차이. 로그인 전후 상태는 브라우저에서 직접 확인.
- 작은 창 버튼·설정 접근 및 기존 원고/표 유지. 학교 변경 후 주소를 재확인하되 자동 덮어쓰지 않는지 확인.
- 실제 NEIS 학교 검색 응답(Cloud에서는 기존 모의 검색 회귀만 실행).

이 작업은 Portable 생성, Windows Actions, 실제 학교 계정 로그인, 운영 DB 접근, main/integration 병합을 수행하지 않는다.

### Cloud 최종 결과

- Vitest: 11개 파일, **77 PASS** (주소/리디렉션/인증서 자동 선택 차단, Main/Preload, 환경·학교 변경, 구형 JSON/백업, 초안, 실제 Rust CSV 작성·XLSX 읽기, 모의 NEIS 검색).
- 변경하지 않은 Purchase native CLI를 이 worktree에서 `cargo build --locked`로 준비. 합성 XLSX 생성용 기존 Rust 테스트 `cli_fixtures_and_automatic_sheet_contract`: **1 PASS**. 전체 Rust 엔진 테스트는 반복하지 않음.
- `npm run electron:p0:build`: Main/Renderer/tests TypeScript 및 Electron production Vite build **PASS**. 기존 chunk-size 경고는 유지.
- `node --test scripts/electron-p0/runtime-package.test.mjs`: **3 PASS**, 새 shared/Main 모듈을 포함한 실제 builder 선택 규칙의 ASAR 런타임 의존성 검사.
- `git diff --check`: PASS. Windows GUI/Portable/실제 학교망·인증서 로그인/NEIS 실검색은 **NOT RUN**.
- 판정: **CONDITIONAL** — 구현 및 Cloud 검증 완료, 기관별 공식 주소 대조와 Windows/학교망 실접속 확인 필요.

## 주소 표기 대조 및 사용자 확인 반영 (2026-11-04)

- 업무포털은 `*.eduptl.kr`(끝 글자 l)이며 기사에 기재된 `*.edupti.kr`(i) 패턴을 생성하거나 허용하지 않는다. 기존 eduptl 지원은 유지한다.
- 경북 eVPN은 `https://evpn.gbe.kr/`. 사용자가 확인했고, `https://www.gbe.kr/main/main.do` 경상북도교육청 공식 공개 페이지의 링크와 대조했다. 공개 eVPN 진입 문서 응답은 실제 인증·학교망 접근 성공을 의미하지 않는다. 기존 도메인 범위에서 빠져 있던 **이 정확한 호스트만** JSON 등록 및 Main 실행/HEAD 검사에 허용한다. `gbe.kr` 전체나 다른 하위 도메인을 허용하지 않는다.
- 강원 K-에듀파인은 사용자 확인 주소 `https://klefedu.gwe.go.kr/`이다. 기존 go.kr 범위에서 저장·실행 가능하다. 앞서 블로그/기사의 `klef.gwe`/`klef.kwe`를 이 주소의 검증 근거로 대신 사용하지 않는다. 이 세 주소 유형을 혼동하지 않는다.
- 참고 자료: `https://m.blog.naver.com/licaoyuan/223149264163`, `https://m.blog.naver.com/licaoyuan/223144714096`, `https://edujb.com/news/articleView.html?idxno=3584`. 보조 자료의 표기 불일치가 있어 목록 전체를 검증된 기본값으로 자동 등록하지 않았다.
- 저장 스키마·기존 주소·학교 프로필을 마이그레이션/초기화하거나 덮어쓰지 않는다. 새 주소를 쓰려면 기존 주소 설정에서 사용자가 명시적으로 등록·저장한다. 실제 로그인·접속은 계속 NOT RUN이다.
- 주소 보완 검증: 관련 Vitest 5개 파일 **51 PASS**, Electron Main/Renderer/tests TypeScript 및 production build **PASS**, diff·변경 범위·비밀정보/바이너리 검사 PASS. 이전 77 PASS와 별도의 이번 집중 검증 결과다.
