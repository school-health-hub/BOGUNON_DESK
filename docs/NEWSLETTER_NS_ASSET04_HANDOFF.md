# NS-ASSET-04 학생 삽화 연결 인계

- Repository: school-health-hub/BOGUNON_DESK
- Branch: codex/electron-h6-design-renewal
- 시작 HEAD: 097a78b494e4e9087969846c3a321f653444ede2
- Product Source: be8140eaf728b05c24ecbffdb5afa30accad6280
- 전체 판정: CONDITIONAL WIP. 라이브러리 구현 및 이번 합성 검수 범위는 PASS. 처음 도형이 보였던 실제 문서의 개별 원인 및 물리 화면 수락 범위는 미검증으로 남긴다. 출판 승인은 대기이며 실제 게시용 출력은 의도적으로 CLOSED.
- UX-07E / UX-07F: 기존 CONDITIONAL 유지. main 병합·배포·Portable 패키징 없음.

## 1. 기본 도형의 원인과 한계

NewsletterPreview.tsx는 image.assetId가 없는 슬롯에 placeholders.ts의 SVG를 표시한다. renderScene.ts와 SVG 출력 경로도 같은 Scene/placeholder를 사용한다. 편집형 카드의 실천 항목에는 별도 벡터 아이콘 경로도 있다. 따라서 무자산 초기 문서의 기하학적 그림은 의도된 기본 그림이지, 누락된 학생 PNG가 자동으로 구형 그림으로 바뀐 결과가 아니다.
assetId가 지정됐는데 원본이 없거나 SHA가 다르면 assetResolution.ts가 오류를 내고 출력을 차단한다. 이 경우 조용히 기본 도형으로 바꾸지 않는다.
사용자가 처음 본 특정 문서/revision은 제공되지 않아 그 문서의 정확한 발생 원인은 NOT VERIFIED다. 모든 도형을 삭제하거나 기존 문서 그림을 자동 교체하지 않았다.

## 2. 연결 자산과 승인 상태

src/newsletter/rendering/assets/students에 기존 PNG 20개를 원본 바이트 그대로 복사했다. source inventory와 20/20 SHA-256·해상도 일치, 총 40,335,235 bytes. 원본 6개 및 파생/크롭 14개를 여학생8·남학생6·혼합6으로 추적한다. 20개를 출판 승인된 독립 장면20종으로 표시하지 않는다.
studentArtCatalog.ts가 ID·SHA·해상도·장면·파생 유형·pending 상태의 제품 내 인벤토리다. 외부 PC 경로는 제품 메타데이터에 넣지 않았다. 사용자는 11개 장면 계열의 대표 그림을 먼저 보고 같은 장면의 파생·크롭을 펼친다.
모든 자산은 출판 승인 대기다. 과거 후보/렌더 검수 이력을 출판 승인으로 승격하지 않았다. 분리본의 과거 제작 분류 기록 불일치는 권리 승인으로 해석하지 않으며, 기존 제작 이미지의 검수 후보로만 취급한다.

## 3. 실제 선택 흐름

기존 Newsletter V2 편집기의 '학생 삽화 선택'에서 전체·여학생·남학생·혼합 필터, 장면별 원본/파생본, 확대, 현재 사용 표시, 주제 태그 추천을 제공한다. 추천은 handwashing/winter/consultation/drinking/refusal/warmth/cooking/boiling/friends 규칙이며 AI 분석·새 생성이 아니다.
현재 페이지/주제 슬롯을 지정하고 현재 그림과 후보를 비교한다. 승인 대기 자산은 검수용 사용 확인 후 적용할 수 있다. 확인 한 번에 선택 슬롯만 바뀌고 revision 하나가 추가된다. 중복 클릭·오래된 편집본 비교는 방어한다.
'학생 없음'은 별도 이미지가 아니라 해당 슬롯의 visible:false로 기록한다. 원래 asset 참조와 과거 revision은 보존한다. 다시 명시적으로 그림을 적용하면 visible:true가 된다. 다른 슬롯·본문·수달쌤·장식은 바꾸지 않는다.
필터·추천·확대·취소는 문서를 변경하지 않는다. 기존 표지 학생 구성 변경 시 그림 참조를 해제하던 동작도 제거해 명시적 삽화 선택만 그림을 바꾸게 했다.

## 4. 데이터 호환과 출력 게이트

기존 문서·revision·프리셋을 자동 이행하거나 초기화하지 않는다. 기존 image 구조에 optional visible을 추가했고 생략 시 기존 렌더링을 유지한다. 새 '미사용' 상태는 현재 버전 JSON 재열기 테스트를 통과했다. 이 필드를 모르는 구버전 앱과의 재열기 호환은 보장하지 않으므로 새 편집본을 별도 revision/파일로 보존한다.
선택 시 해당 PNG 하나만 manifest에 연결한다. approvalStatus는 기존 렌더 검수 계약상 approved, exportApproval은 pending이며 이것이 출판 승인 완료를 뜻하지 않는다.
assetExportPending은 문서의 exportApproval 값뿐 아니라 신뢰된 카탈로그의 ID 또는 SHA로 차단한다. ID 별칭·문서 승인 플래그 조작으로 우회할 수 없다. Renderer와 독립 출력 authority/outputEngine이 같은 판정을 사용한다. 새로운 승인 UI나 기본 프리셋 자동 등록은 만들지 않았다.
승인 대기 참조가 남으면 비표시 슬롯이어도 보수적으로 출판을 차단한다. 기존 엔진의 QA용 렌더링 경로와 출판 경로를 구분한다.

## 5. 집중 검증

- 관련 고유 테스트29 PASS: studentArt9, StudentArtLibrary3, 기존 editorial controls7, renderScene/assetResolution10. 최종 CSS 범위 수정 이후 UI3 및 renderer 타입 검사 추가 확인.
- 테스트 범위: 20개 해시/해상도, 8/6/6 필터, 추천, 명시적 한 슬롯 변경·새 revision·복원, 알 수 없는 선택 차단, 미사용 Scene, JSON 재열기, 취소·오래된 비교·중복 적용, 승인 플래그 위조와 PNG/PDF authority 차단.
- Electron full production build 및 Main/renderer/tests TypeScript PASS. 최종 체크박스 CSS/className만 변경한 뒤 production renderer를 다시 빌드했다. Main/preload 차이 없음. git diff --check PASS.
- 큰 JS chunk 경고 있음: 기존 inline 자산 방식으로 공유 svgRenderer chunk 약56.2MB. 기동/검수 기능은 동작했으나 저사양 장기 성능은 이번 수락 범위 밖이다.
- 전체 UX07E/F·7개 업무 모듈 회귀·Rust/Portable 빌드는 반복하지 않았다.

## 6. Windows 실물 결과

Electron45.2.1/Chromium156 실제 Windows 창, 격리 QA 프로필과 합성 원고 사용. 기존 일반 프로필·Finance·SCHOOL 운영 인증에 접근하지 않았다.
20개 이미지 모두 디코딩, 장면11개/파생 펼치기, 필터8/6/6, 손 씻기 주제 추천, 비교와 명시적 적용 PASS.
Windows 실제 입력(Sky)으로 삽화 선택 및 최종 검수 확인·적용을 확인했다. 나머지 상태 준비/필터/취소는 Playwright의 실제 Electron DOM 조작으로 검증했으며 OS 입력과 혼동하지 않는다.
합성 원고의 A4 revision2→3 결과를 JSON으로 저장해 원고 및 모든 카드·다른 A4 5개가 동일함을 대조했다. JSON 저장 대화상자 경로 선택은 QA Main stub 사용; 네이티브 저장 대화상자 실물 수락 결과로 주장하지 않는다.
실제 IPC에서 유효한 원본 바이트를 포함하고 exportApproval을 approved로 위조한 a4-png/a4-pdf/card-pngs/cards-pdf 모두 FORBIDDEN. 출력 UI도 승인 대기로 비활성화. 새 게시용 PNG/PDF를 만들지 않았다.
카드 슬롯 '학생 없음' revision3→4 및 필터 후 취소 revision4 유지 PASS.
980×700은 Electron renderer viewport 에뮬레이션이다. 물리 디스플레이/Windows 창 크기 변경 실물 검증이 아니다. dialog 가로 overflow 없음(clientWidth=scrollWidth=823), 적용 버튼 화면 내 접근 확인.
독립 소스 검토와 시각 검토2회에서 검토 범위 차단 결함 없음. 앱 메뉴 'BOGUNON 완전 종료' 실제 입력, QA Electron 잔여0. 다른 Chrome/NS-ASSET-03 검토판은 보존했다.

## 7. 증거와 provenance

로컬 원본: E:\BOGUNON_DEV\qa-output\NS-ASSET-04_20261113
- asset-integrity.json / protected-document-hashes.json
- gui-results.json / ipc-publication-gate-valid-bytes.json / cleanup.json
- validation-summary.json / final-ui-tests.log / final-typecheck.log
- final-build.log / final-renderer-build.log / provenance.json / security-review.json
- 최종 화면08~16. 15는 최종 비교 화면,16은 viewport 에뮬레이션. 01~07은 앞선 구현/검증 기록으로 최종 CSS 화면 증거와 구분한다.
- synthetic-fixture.json / applied-synthetic.json: 합성 QA 자료만, 기존 사용자 문서 아님.

제품 metadata dirty:true는 보호한 기존 untracked 감사·계획 문서3개 때문이다. tracked 제품 파일은 Product Source와 일치한다. 최종 renderer 증분 빌드와 Main/preload 동일 근거를 provenance.json에 기록했으며 clean build로 표시하지 않는다.
원본 캡처·로그는 로컬에만 보존하며 원격에서 직접 열람 가능하다고 주장하지 않는다. 이번 source checkpoint의 20개 제품 PNG는 Git으로 보존한다. 전체 PC 간 증거 인계 READY 판정은 하지 않는다.

## 8. Git 및 보존

기존 미추적 NEWSLETTER_SKILL_GAP_AUDIT.md / NEWSLETTER_STUDENT_ART_ASSET_AUDIT.md / NEWSLETTER_STUDENT_ART_LIBRARY_PLAN.md는 기존 SHA 그대로 보존하고 이번 커밋에 포함하지 않았다. 따라서 working tree는 이3개 때문에 clean이 아니다.
origin은 school-health-hub/BOGUNON_DESK, PUBLIC 확인. 신규 코드/20개 합성 이미지와 본 인계만 범위 한정 보존한다. 설치된 secret scanner가 없어 staged 전 바이트의 비밀키·토큰 패턴 검사와 수동 소스/화면 검토를 수행했다(탐지0; 정식 DLP/권리 검증 대체 아님). 비밀정보·운영 데이터·QA 프로필은 업로드하지 않는다.
최종 Git HEAD는 이 문서를 포함한 documentation commit, Product Source와 구분한다. 일반 push 후 원격 HEAD·divergence를 최종 응답에 기록한다.

## 9. 남은 항목

1. 20개 후보의 파일별 명시적 출판 승인과 출처/권리 기록 확정. 이번 구현은 승인이나 게시 허가가 아니다.
2. 처음 도형을 봤던 실제 문서/revision이 확보되면 해당 asset 참조·SHA를 별도 대조(자동 교체 금지).
3. 물리 소형 화면/DPI와 저사양 성능은 NOT RUN. UX07E 물리 멀티모니터 및 UX07F 전체 미검증 범위는 기존대로 별도 유지.

SCHOOL/Finance/UX07E 코드·기존 프리셋·수달 PNG·사용자 문서는 변경하지 않았다. 운영 연결·main 병합·배포는 시작하지 않는다.
