# Newsletter Studio

## 목적

월별 학교 보건소식지와 카드뉴스를 일관된 수달 캐릭터·학교 유형별 문맥으로 제작하고 로컬 프로젝트로 저장한다.

## 확정 요구사항

- 과거 발행자료 기반 주제 추천과 핵심 주제 6개
- A4 소식지 이미지 1장, 정사각형 카드뉴스 7장
- 여고·남고·남녀공학 버전
- 고정 수달 캐릭터
- 개별 카드 수정·재생성
- PNG/PDF 출력과 로컬 프로젝트 저장
- `sungandi86-max/otter-nest`와 `monthly-school-health-newsletter` Skill의 제작 규칙을 참고
- Skill 자체를 Tauri에서 직접 실행하지 않고 독립 엔진 구현

## 현재 구현 범위

`feature/newsletter-studio@2ffadef`는 `wip(newsletter): checkpoint NS-2 engine pending native QA` 로컬 checkpoint다. repository, schema, editing, topic bank, legacy import와 Rust command/storage 구현을 포함하며 upstream은 없다.

구현 상태: `PARTIAL`.

## QA 상태

`NOT VERIFIED`. 테스트와 구현은 checkpoint에 포함됐지만 commit message 자체가 native QA pending을 명시하며 완료된 native QA 결과를 확인하지 않았다.

## 아직 구현·확정하지 않은 범위

- 콘텐츠 생성 엔진과 이미지/PDF pipeline
- 고정 캐릭터 asset/provenance
- 학교 유형별 품질 기준
- 개별 카드 재생성 UX
- otter-nest 자료의 라이선스·가져오기 경계

## 근거 및 연결 관계

`feature/newsletter-studio@2ffadef`의 `src/newsletter/**`, `src-tauri/src/newsletter/**`, `docs/newsletter/**`. Workspace Library에 프로젝트와 출력물을 등록하고 PDF & Image Tools를 내보내기 처리에 사용할 수 있다.

## 위험 및 다음 작업

local checkpoint의 외부 자료·Skill 규칙 provenance와 비밀정보를 검사하고 native QA를 완료한다. upstream 부재 상태에서는 다른 PC에서 복구 가능하다고 간주하지 않는다.
