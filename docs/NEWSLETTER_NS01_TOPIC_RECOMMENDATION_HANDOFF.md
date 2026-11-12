# NS-01 월별 6개 주제 추천 인계

## 범위와 소스

- 저장소: school-health-hub/BOGUNON_DESK, 브랜치 `codex/electron-h6-design-renewal`.
- 시작: `0872fafb7c89135599530d7ae0863a80dc493928`.
- 제품 소스: `a8c7aa719e0dca24f161c35ac202b4ba81ff8d80`.
- UX-07E/F: 기존 CONDITIONAL 유지. 운영 DB·SCHOOL·Finance·인증·배포 작업 없음.
- Skill ZIP의 실제 SKILL.md와 source-library.md를 읽었다. 비공개 Drive URL 및 과거 원본은 코드/문서에 복사하지 않았고 Drive에 접속하지 않았다.

## 구현

1. 새 소식지에서 작성 월 선택 → 빈 편집기 → **월별 주제 추천·공통 원고**.
2. 개인정보 없는 사용 허가된 자료임을 확인한 뒤 로컬 JSON 가져오기. 원본은 읽기만 하고 업로드·외부 AI 전송하지 않는다.
3. 같은 월의 과거 연도 → 인접 월 → 다른 월의 검토 표시된 은행 순. 학교 유형을 필터링하고 미래/현재 발행월·거절 자료를 제외한다. 정규화 및 명시적 동의어 규칙으로 중복 제거한다. 일반 의미 분석이나 AI 추천을 주장하지 않는다.
4. 후보/선택 수·부족 수·연월·출처·추천 이유 표시. 선택/해제·교체·위/아래 이동·직접 입력·소개/수칙 4개/마무리 편집 가능.
5. 변경 전 원고·실효 마무리와 제안 원고를 검토하고 확인 체크 후 적용. 취소/Escape는 현재 문서를 변경하지 않는다.
6. 원고와 디자인 revision을 각각 정확히 하나 추가한다. 기존 슬롯/주제 ID는 유지하고, 선택 순서의 내용을 해당 슬롯에 연결한다. 이미지 자동 추천 적용은 하지 않는다. 기존 학생 삽화 라이브러리가 바뀐 주제 제목을 이용해 기존 규칙 추천을 제공하며 적용은 별도 사용자 동작이다.

## 로컬 주제 은행 구조

- 기존 주제 배열 또는 `{ "version": 1, "topics": [...] }`. 최대 2MiB/1,000개. 중복 ID·잘못된 스키마는 전체 가져오기 실패, 이전 선택 보존.
- 필수: `id`, `title`, `year`(2000–2100), `month`(1–12), `schoolType`(girls-high/boys-high/coed-high/all), `source`(kind/label/reference), `reviewStatus`(pending/reviewed/rejected).
- 선택: `lead`, `actions`(최대 4개), `closing`, `tags`, `source.sha256`.
- source.kind: local-archive, approved-bank, local-fixture. manual은 직접 입력 시 생성한다.
- 은행은 추천 대화상자 안의 임시 메모리다. 닫거나 문서를 바꾸면 다시 가져온다. 영구 은행 파일을 자동 작성하지 않는다. 확정한 출처·발행연월·추천 기준월·마무리는 문서의 `section.topicSelection`에 보존한다.
- 가져온 출처/해시는 **제공된 메타데이터**이며 발행 사실·원본 무결성·권리의 독립 검증을 뜻하지 않는다. 실제 과거 자료를 공개 저장소에 넣지 않았다.
- **합성 예시**는 명시적으로 누른 경우에만 표시하며 모든 후보에 실제 발행 이력 아님을 표시한다. 원고가 없는 자료에 건강정보를 생성하지 않는다.

## 원고·파일 호환 및 보호

- 프로젝트 schemaVersion 1, TD2/Dock/모니터 데이터는 변경하지 않음.
- optional `topicSelection`과 `topicTitleHistory`로 출처와 과거 제목을 보존. 기존 JSON은 새 코드에서 재열기 가능. 신규 메타데이터가 있는 JSON은 이전 앱의 fail-closed 호환성 검사에서 거부될 수 있으므로 이 소스 이후 앱으로 연다. 구형 앱으로 강제 변환하거나 필드를 제거하지 않는다.
- 기존 원고/디자인 revision 스냅샷·outputHistory·자산 manifest·모든 삽화 슬롯·수달/프리셋 원본은 유지한다. cover의 4개 예고 수와 해당 원고의 slogan/closing만 명시적 적용 내용으로 갱신한다.
- 제목 이력은 과거 revision 렌더링에 사용한다. 새 추천 시 과거 원고 스냅샷을 재작성하지 않는다.
- 반영 전 원고가 있는 동안 주제 추천·모드/주제 이동을 잠그고 두 원고 편집기의 교차 반영/공식 요소 전환을 방어한다.
- 소개와 수칙 4개가 없으면 작성 필요/조판 오류 상태를 유지한다. 그림 20개의 pending 출력 게이트는 trusted ID/SHA 판정을 그대로 사용한다. 권리/출판 승인 변경 없음.

## Windows에서 발견한 결함과 최소 보정

- 초기 소스 `0c42721` 실제 화면에서 새 A4 마무리 6개가 24px 프레임에 31px 줄높이로 들어가고, 수칙 frame 하단668과 마무리 y658이 겹치는 것을 확인했다.
- 긴 제목/이미지 실패가 아니라 기존에 비어 있던 마무리 영역을 채울 때 드러난 표시 계약 문제다.
- `closing-red.log`로 재현. NS-01 마무리가 있는 경우에만 표시용 body 하단을 제한하고 일반 A4 마무리를 18px/1.2로 표시한다. 저장된 A4 좌표/이미지/프리셋은 변경하지 않는다.
- 신규 회귀는 overlap/overflow 없음과 A4 저장 레이아웃 바이트 동등성을 확인한다. `closing-green.log`: 주제 은행 11개 + 기존 조판 6개, 17 PASS.

## 검증

- `focused-verified.log`: 주제/명시 적용 10, 추천 UI 5, 편집기 3 = 18 PASS(마무리 회귀 추가 전). 이후 주제 은행 최종 11개와 조판 6개 17 PASS.
- `focused.log`: 기존 editing/newDocument/studentArt 관련 회귀 포함 26 PASS. 이후 변경 없는 회귀를 전체 반복하지 않았다.
- `focused-final.log`의 officialTemplate 3개 PASS는 재사용. 이 실행의 dirty-navigation 실패는 수정 후 focused-verified에서 통과했다.
- production build/전체 Electron TypeScript 최종 확인: 아래 최종 결과 참조. 전체 앱 회귀, Rust, Portable, PNG/PDF 엔진 전수 테스트는 하지 않음.
- `git diff --check` 및 staged 소스/새 인계 문서 비밀정보 검사. 전용 secret scanner 미설치로 정규식 + 범위 diff 수동 검토의 best-effort이며 완전 탐지 보장은 아님.

## Windows 증거와 제약

- 원본 위치(집 PC 로컬 전용): `E:\BOGUNON_DEV\qa-output\NS01_20261113`.
- 최초 흐름은 `0c42721`: 실제 Windows 클릭으로 후보 6개 선택, 첫 주제 해제, 인접 월 학교생활 적응으로 교체, 순서 변경, 확인 체크, 명시적 적용. 원고 1→2/디자인 3→4. 기존 양쪽 history와 manifest 동일. native-before-fix.json에 trusted click 14개와 취소 전후 문서 전체 동등성 기록.
- 진입 IPC 및 파일 주입은 하네스(Playwright setInputFiles), Windows 네이티브 파일 열기 대화상자를 통과한 것으로 표시하지 않는다. 문서 비교는 QA 전용 합성 React 상태를 읽기만 했다. 앱의 성공 플래그를 임의 주입하지 않았다.
- 모든 프로필/TEMP/TMP/RUNNER_TEMP는 E: QA 경로의 프로세스 전용 값. 전역 Windows 환경/일반 앱 프로필은 변경하지 않았다. C: 공간은 별도 감시했다.
- 실제 과거 발행 원본의 정리·권리/출처 검토와 사용자 제공 은행 구축은 미실시. Drive 검색·운영 자료 입력·외부 AI API·실제 출판 출력은 NOT RUN/범위 밖이다.
- 증거 원본은 Git에 업로드하지 않았다. 이 문서만으로 다른 PC에서 원본 캡처를 검토할 수 있다고 주장하지 않는다.

## 기존 미추적 문서 보존

| 문서 | SHA-256 |
|---|---|
| NEWSLETTER_SKILL_GAP_AUDIT.md | 7683d35df0762a91715dafd3f0f0771e7f53f0ab5ab10f1fa306e20fd5cf3834 |
| NEWSLETTER_STUDENT_ART_ASSET_AUDIT.md | 19fe07b7891465fa0f1786b8931e77ef3d7bf7049581646e378378ed98ccc50a |
| NEWSLETTER_STUDENT_ART_LIBRARY_PLAN.md | 93b8a9b4a8dac127259e26269ea85a61441c34ba43577203c325adf63a77f36d |
| NEWSLETTER_NS_ASSET05_APPROVAL_READINESS.md | 22e6400dd5892b91740f8b33c7359ff06c8bb65366e6f725298a9583e705bdc6 |

4개 모두 변경/스테이징/커밋하지 않았다. 따라서 제품 tracked diff가 없어도 전체 working tree는 이 4개 때문에 clean이 아니다.

## 재현 명령

```powershell
# 기존 의존성 사용. TEMP/TMP는 이 PowerShell 프로세스에만 E:의 별도 QA temp로 지정.
node node_modules/vitest/vitest.mjs run src/newsletter/monthlyTopicBank.test.ts src/newsletter/NewsletterTopicPlanner.test.tsx src/newsletter/rendering/NewsletterDesignEditor.test.tsx src/newsletter/rendering/renderDocument.test.ts --maxWorkers=1 --no-file-parallelism
npm run electron:p0:build
git diff --check
```

## 최종 결과

최종 수정 소스의 Windows 재확인·정상 종료·원격 검증 결과를 이 항목에 추가한다. 제품 구현과 실물 검증, 원격 Git 동기화를 구분한다.

### 최종 실행 결과 (2026-11-13)

- **NS-01 CONDITIONAL WIP**: 핵심 기능·집중 검증·Windows 기본 사용자 흐름 완료. 기존 기본 월별 제목의 표지 overflow P2가 남아 전체 디자인/출판 완료라고 표시하지 않는다.
- 최종 제품/실행본 `sourceSha`: `a8c7aa719e0dca24f161c35ac202b4ba81ff8d80`. `build-verified.log`에서 Main/Renderer/tests TypeScript 및 production build PASS. 실행 `electronP0.info()`와 build-meta source 일치.
- `dirty: true`는 보존한 미추적 문서와 본 인계 문서 때문이며 제품 tracked 수정은 없다. QA 중 임의 metadata를 바꿔 source를 위장하지 않았다.
- 실제 Windows 입력: 선택/교체/순서/확인/적용, 원고 1→2·디자인3→4, 과거 history/manifest 유지, 두 실행 버전의 취소 전후 문서 전체 동등성 확인. `native-before-fix.json`, `windows-results.json` 참조.
- 최종 빌드에서 이전 실행의 합성 JSON 재열기 PASS. A4 마무리 겹침 12건 해소. 기본 긴 제목 `2026년 11월 · 남녀공학 보건소식지`는 카드 표지 285px > 260px 경고 1건이 남는다. 그 제목/프레임/스타일은 추천 적용 전후 동일하며, 이번에 기본 프리셋을 자동 변경하지 않았다. **사용자가 명시적으로 합성 제목을 `11월 보건소식지`로 줄인 후** 전체 조판 오류 0, 표지 예고4·카드 선택7·본문 수칙4 확인. 이는 기존 긴 제목 문제의 해결 커밋이 아니다.
- 최종 소스 캡처 07–20. 08/12의 `full` 파일명은 실제 전체 페이지 보장을 뜻하지 않으며 프레임 밖 하단이 비는 부분 캡처다. 실제 스크롤 캡처17–20으로 본문 마무리/하단 경계, A4 5/6번 주제/마무리/푸터를 추가 확인했다.
- 독립 시각 검토 2인: 모든 최종 캡처10개 + 보완4개 직접 확인. 보이는 추천 모달·출처·원고 비교 및 보완 영역 PASS, 기존 긴 표지 제목은 REVISE/P2. 최종 확인 체크 후 활성 Apply의 **최종 소스 정지 화면은 NOT CAPTURED**이며 초기 버전의 실제 클릭 증거·최종 DOM 테스트와 구분한다. 작은 물리 디스플레이·모든 키보드 focus trap/복귀는 별도 실물 PASS를 주장하지 않는다.
- 앱 메뉴의 **BOGUNON 완전 종료** 사용. 대기 후 해당 QA 실행 경로의 Electron 잔여 프로세스 **0**. 다른 앱/프로세스 강제 종료 없음. cleanup.json 참조.
- C: 실제 GUI 실행 직전719MiB → 종료 후665MiB. E: 종료 후832.88GiB. 정리·전역 TEMP 변경·사용자 데이터 변경 없음. 후속 GUI 전 C: 공간 확보 권장. E:에서 실행해도 Windows의 C: 사용을 완전히 없앨 수 없다.

### 변경 파일과 Git 보존

- 신규: `monthlyTopicBank.ts`, `applyTopicPlan.ts`, `NewsletterTopicPlanner.tsx`, `topic-planner.css` 및 주제은행/추천UI 테스트.
- 관련 수정: 프로젝트 schema, renderDocument, NewsletterDesignEditor/EditorialCopy/OfficialElementCopy/EditorialControls/OfficialTemplateControls 및 편집기 회귀 테스트.
- 성능 56MB 인라인 이미지 청크, 원본 PNG, 기존 프리셋/템플릿, 출력 엔진, 모니터 lifecycle, Finance/SCHOOL 소스 변경 없음.
- 문서 제출 전 Git HEAD는 제품 소스 a8c7aa7. 이 문서의 정상 커밋은 후속 문서 HEAD를 만든다. 최종 문서 HEAD/원격 일치 값은 완료 응답 및 원격 브랜치의 이 파일 소속 커밋으로 식별한다.
- 일반 push 후 원격 HEAD 일치와 divergence0/0을 검증한다. tracked working tree clean과 **기존 미추적 문서4개 유지로 전체 working tree non-clean**을 구분한다. 강제 push/병합/배포 없음.

### 다음 작업

1. 사용 허가된 과거 자료를 위 JSON 형식으로 사용자가 정리·가져오기. 실제 발행 사실/의학 내용/권리 검토는 사람의 확인이 필요하다. 이번 합성 은행을 실제 과거 이력으로 재사용하지 않는다.
2. 기존 긴 월별 제목의 표지 자동 맞춤 P2는 별도 최소 개선 대상으로 남긴다. 당장 검수 시 기존 월별 제목 입력에서 짧게 명시 수정할 수 있다. 기존 문서 자동 수정 금지.
3. 학생 삽화 출판/재배포 승인, 56MB 성능 개선, UX-07E/F 잔여 실물 QA는 별도 기존 항목으로 유지한다. 운영 설치·통합 QA·배포 승인으로 해석하지 않는다.
