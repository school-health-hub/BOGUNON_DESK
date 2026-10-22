# 공문작업실 코드 출처 조사 초안

조사일: 2026-10-23. 대상: `feature/official-document-enhancement`,
`a565dccb2ba9b11c5612dd897b700c8729d1a481`.
문서 초안이며 배포 승인이나 전체 의존성 라이선스 감사 완료를 뜻하지 않는다.
기능·디자인·빌드·운영 설치본은 변경하지 않았다.

## 1. 판정 방법과 한계

- 현재 소스, manifest/lockfile, `git log --all`, `git log --follow`, 관련 커밋 diff,
  고정 SHA의 원본 파일을 대조한다. 이번 실제 조회에는 `git log --all --reverse -- src/official-document`,
  `git log --all -G 'openoffice|genoffice|healthroom-document-helper' -- DESIGN.md src src-tauri`,
  `git show 29be6b0`, `git show b8a9f19`와 GitHub contents/tree API를 사용했다.
- 동일 blob 유무만으로 이전·수정·번역을 판정하지 않는다. 함수 구조, 필드·문구,
  실행 방식, 도입 커밋을 함께 비교한다. 유사성만으로 외부 출처를 단정하지도 않는다.
- `확인`은 해당 증거가 뒷받침하는 범위만 의미한다. `확인 필요`는 재사용도 독립 구현도
  확정하지 않은 상태다. 아래 조사로 전체 외부 저장소의 모든 과거 버전과 부분 복사를 배제할 수 없다.
- 실제 EXE를 실행·재빌드·역분석하지 않았다. 배포 포함 여부는 현재 import/command 등록과
  빌드 설정에 근거한 정적 판정이며, 설치된 0.2.2의 구성에 대한 판정은 아니다.

## 2. 자체 프로젝트: healthroom-document-helper

사용자 직접 개발 프로젝트라는 사실은 사용자 진술을 따른다. 외부 프로젝트 무단 사용으로
분류하지 않는다. 저장소를 실제로 찾은 소유자는 `sungandi86-max`이다.

- [원본 고정 커밋](https://github.com/sungandi86-max/healthroom-document-helper/tree/57e433ac34e7a0670c403c7d19813b5bbe5fee28)
- 기준 SHA: `57e433ac34e7a0670c403c7d19813b5bbe5fee28`.
- `DESIGN.md`의 Official Document Workspace 절에 이 SHA와 TypeScript 재작성 방침이 명시돼 있다.
- DESK 공개 이력에서는 `26fcb929efcdcc5176812372ecf179430a901b15`
  (`Initial open-source release`)에 이미 기본 공문 모듈과 해당 설계 기록이 존재한다.
  공개 이전의 개별 편집 순서·개발 세션은 이 Git 이력만으로 복원할 수 없다.

| 원본 파일/개념 | 현재 대응 파일 | 확인한 대응 및 변경 | 판정 |
| --- | --- | --- | --- |
| [`src/data/options.js`](https://github.com/sungandi86-max/healthroom-document-helper/blob/57e433ac34e7a0670c403c7d19813b5bbe5fee28/src/data/options.js) | `src/official-document/options.ts`, `types.ts` | 업무 분야 목록, 목적, 입력 필드 대응. 원본의 품의 목적은 DESK 목적 목록에서 제외하고 타입화 | 자체 자산 이전·수정 확인 |
| [`src/data/templates.js`](https://github.com/sungandi86-max/healthroom-document-helper/blob/57e433ac34e7a0670c403c7d19813b5bbe5fee28/src/data/templates.js) | `src/official-document/templates.ts` | 기본 체크리스트 5문장, 보건 기본계획 등 목적·붙임·메신저 기본 문구 대응. `createTemplate` 구조와 필드명을 TypeScript 모델에 맞게 재작성 | 자체 자산 이전·수정 확인 |
| [`src/utils/generateDocument.js`](https://github.com/sungandi86-max/healthroom-document-helper/blob/57e433ac34e7a0670c403c7d19813b5bbe5fee28/src/utils/generateDocument.js) | `src/official-document/documentGenerator.ts` | 목적별 종결·제목 접미어, `optionalLine`, 붙임 분리, 가~자 항목 순서, 본문 조립 구조 대응. 입력 객체/타입 변경 및 참고자료 초안 기능 확장 | 자체 생성 로직 이전·재작성 확인 |
| [`src/api/documents.js`](https://github.com/sungandi86-max/healthroom-document-helper/blob/57e433ac34e7a0670c403c7d19813b5bbe5fee28/src/api/documents.js), `ReferenceDocuments.jsx` 개념 | `referenceRepository.ts`, `referenceTypes.ts`, `referenceMapper.ts`, 참고자료 UI | 자료명·분야·목적·템플릿·붙임·메신저·표 본문 등의 개념 대응. DESK는 29열 검증·명시적 적용·수정 필드 보호 및 로컬 패키지 방식 사용 | 개념 계승 확인; 파일 단위 그대로 이식으로 분류하지 않음 |
| 원본 웹 UI, Apps Script, CSV 원격 조회 | DESK Tauri/React 공문 패널 및 로컬 패키지 | 원본의 Google Sheets 조회·관리 스크립트는 현재 공문 참고자료 런타임 의존성으로 채택되지 않음. 원격 원본 자료를 이 조사에서 호출하지 않음 | 이식 제외 방침 및 현재 구현 경계 확인 |

Phase 1A 참고자료 확장: `29be6b0996780d78d26571c3baf15c948b5c738f`.
Phase 1B 패키지·저장 확장: `07643d6ad34eecc3a66393121469f49aecdd39e2`.
이 커밋이 존재한다는 사실만으로 제3자 코드 미포함을 보증하지 않는다.

원본 트리에 LICENSE/NOTICE가 없고 package.json에는 React/react-dom 및 개발용 Vite가 있다.
자체 코드 이전에 별도 타인 허가 문제를 추가하지 않는다. 해당 프로젝트의 모든 자산·의존성까지
사용자가 작성했다고 간주하지 않으며, 폰트·그림·외부 자료의 별도 이전이 발견되면 추가 확인한다.
원본 참고자료 데이터 및 개인정보는 코드 출처와 별개이며 저장소·설치본에 반입하지 않는다.

## 3. 이음오피스 / GenOffice

사용자가 이음오피스 원작자로부터 사용 허락을 받았다는 사실은 사용자 진술로 기록한다.
이를 부정하거나 재허가를 요구하지 않는다. 허락의 구체적인 대상 파일·버전·조건은 이 조사에서
증빙을 보지 않았으므로 `확인 필요`이며, 확인된 공개 라이선스 정보와 구분한다.

이번 대조 원본은 조사 당시 조회된
[`5fda8298a042318048a768e10fadadcc02a6d49c`](https://github.com/pblsketch/openoffice/tree/5fda8298a042318048a768e10fadadcc02a6d49c)이다.
커밋 메시지는 `docs: 0.12.3 공개 기록` PR 병합이다. package.json의 version은 `0.1.0`이므로
버전 이름만으로 출처를 고정하지 않는다. **이 SHA가 DESK 개발 당시 실제 참고·복사한 버전이라는 증거는 없다.**

| 원본 후보 | DESK 대응 조사 범위 | 실제 비교 결과 | 재사용 판정 |
| --- | --- | --- | --- |
| [`packages/file-parse/src/odt.ts`](https://github.com/pblsketch/openoffice/blob/5fda8298a042318048a768e10fadadcc02a6d49c/packages/file-parse/src/odt.ts) | `src-tauri/src/official_document_import.rs`의 `extract_odt_content`, `extract_odt_text` | 원본은 `@genoffice/odt-engine` 호출. DESK는 Rust `ZipArchive`와 `quick_xml`로 `content.xml`을 제한적으로 읽음. ODT 도입은 `b8a9f19a6aeeb3d0e6341194e84262fe2a53c892` | 이 파일의 직접 이식은 확인되지 않음. 하위 엔진·과거 버전 참고 여부 확인 필요 |
| [`packages/file-parse/src/hwp.ts`](https://github.com/pblsketch/openoffice/blob/5fda8298a042318048a768e10fadadcc02a6d49c/packages/file-parse/src/hwp.ts) | 같은 Rust 파일의 HWPX 추출 | 원본은 `@rhwp/core` WASM 및 문서/표 API. DESK는 HWPX ZIP section XML을 순서대로 추출하고 legacy HWP 편집 엔진을 포함하지 않음 | 해당 WASM/모듈의 현재 의존성 편입 증거 없음. 부분 로직 참고 여부는 미확정 |
| [`packages/ai-provider/src/subscription.ts`](https://github.com/pblsketch/openoffice/blob/5fda8298a042318048a768e10fadadcc02a6d49c/packages/ai-provider/src/subscription.ts), `subscription/service.ts` | `src/official-document/officialDocumentAiService.ts`, `src-tauri/src/chatgpt/oauth.rs` | 원본은 Node/Electron의 CLI 연결·상태 관리. DESK는 기존 shared AI gate 및 Rust OAuth/PKCE 사용. 인증 도입 이력 `cd0786284f9cf71f9c3f4962626a828402183068` | 같은 기능 범주라는 이유로 코드 재사용으로 판정하지 않음. 당시 참고 대상 확인 필요 |
| 이음오피스 UI·문서 편집기·디자인 | `OfficialDocument*.tsx`, `src/styles/components.css` | 현재 공문 UI는 DESK 컴포넌트·디자인 토큰에 연결. 특정 이음오피스 파일을 지목하는 주석/도입 기록은 이번 검색에서 발견되지 않음 | 디자인 참고만인지, 수정 이식인지 확정 불가 |

현재 manifest와 lockfile에서 `@genoffice`, `@rhwp`, `pblsketch`, `ieumoffice` 이름은 검색되지 않았다.
현재 `src`, `src-tauri`, `scripts`, `qa`에서도 이음오피스 출처 표시는 검색되지 않았다.
이는 **이름 있는 패키지 의존성·표시의 부재**이며, 이름을 바꾼 복사·수정·번역 코드가 없다는 증거가 아니다.
공개 Git 이력 검색에서도 이음오피스 특정 파일/원본 SHA를 지목하는 변경은 찾지 못했다.

결론: **현재 증거로 의무 고지 대상에 추가할 특정 이음오피스/GenOffice 재사용 파일은 확정되지 않았다.**
반대로 재사용이 없었다거나 완전 독립 구현이라고 선언하지 않는다. 기능 설계만 참고했다는 단정도 하지 않는다.

## 4. 라이선스·저작권·NOTICE

- 이음오피스의 고정 SHA [`LICENSE`](https://github.com/pblsketch/openoffice/blob/5fda8298a042318048a768e10fadadcc02a6d49c/LICENSE)는 Apache-2.0이며
  말미에 Mainfunc, Inc.의 2026년 저작권 표시가 있다.
- 같은 SHA의 [`NOTICE`](https://github.com/pblsketch/openoffice/blob/5fda8298a042318048a768e10fadadcc02a6d49c/NOTICE)는 GenOffice 기원,
  이음오피스 수정 관계, Unicode·브랜드·슬라이드·폰트·내장 skill·HWP 관련 개별 항목을 구분한다.
  상위 원본은 [genspark-ai/genoffice](https://github.com/genspark-ai/genoffice)라고 명시한다.
- 원본 NOTICE의 모든 구성요소를 DESK에 사용했다고 옮겨 적지 않는다. 실제 포함된 부분에 해당하는
  원본 저작권·라이선스·NOTICE를 선별하되, 관련 있는 고지를 임의로 생략하지 않는다.
- 실제 Apache-2.0 코드 재사용이 확인되면 [제4조](https://www.apache.org/licenses/LICENSE-2.0#redistribution)를 기준으로
  수령인에게 라이선스 사본 제공, 변경 파일의 변경 사실 표시, 관련 저작권·특허·상표·출처 고지 보존,
  해당 부분의 NOTICE 제공을 점검한다. 제6조는 상표 사용 권한을 일반적으로 부여하지 않는다.
  별도 허락이 제3자 권리·상위 NOTICE까지 모두 면제한다고 추정하지 않는다.

`THIRD_PARTY_NOTICES.md` 기존 표에는 React, Tauri, Pretendard, Lucide 등이 있지만,
GenOffice/이음오피스 항목과 구체 파일 대응 기록은 없다. 현재는 재사용 미확정이므로 의무 표에
추가하지 않고 조사 보류 상태만 연결한다. 이 문서 자체를 법률 검토나 라이선스 준수 보증으로 사용하지 않는다.

## 5. 현재 코드와 배포 경계

- `OfficialDocumentPanel`과 `src/official-document/*`는 앱에서 사용하는 frontend 경로이며,
  QA 앱도 같은 패널을 import한다. options/templates/generator의 자체 이전 자산이 현재 소스에 있다.
- `src-tauri/src/lib.rs`가 `official_document_import`와 `official_reference_package` 모듈 및 command를 등록한다.
  실제 바이너리의 각 함수 보존 여부·최적화 결과까지 확인한 것은 아니다.
- 운영 Tauri 설정은 `../dist`, QA 설정은 별도 frontendDist를 사용한다. 조사한 운영 bundle 설정에
  루트 `LICENSE`·`THIRD_PARTY_NOTICES.md`를 resource로 복사하는 명시는 없다. 다른 패키징 경로까지
  확인하지 않았으므로 설치본에 고지가 들어간다고 가정하지 않는다.
- 배포 전 수동 복사 코드를 포함한 전체 포함 목록, 정확한 의존성 라이선스 본문,
  설치본/portable EXE와 함께 전달되는 고지 위치를 별도로 검증해야 한다.
  루트 고지 문서의 존재나 upstream 링크만으로 라이선스 사본 전달을 대신하지 않는다.

## 6. 추가 확인할 최소 증거

1. 이음오피스에서 실제로 보았거나 가져온 파일 경로와 당시 커밋/태그, 수정 전 사본 또는 패치.
2. 복사·번역·수정 이식인지 기능 설계 참고인지에 대한 당시 작업 기록.
   개발 세션은 이번에 열람하지 않았다. 필요한 경우 별도 범위를 정해 확인한다.
3. 해당 원본 버전의 LICENSE, NOTICE, 개별 파일 헤더 및 상위 GenOffice 변경 이력.
4. 사용자에게 이미 있는 허락 기록의 대상·조건. 비공개 원문을 Git에 넣을 필요는 없으며
   안전하게 확인 가능한 범위만 기록한다.
5. 배포 대상 소스 SHA에 맞춘 라이선스 목록과 실제 패키지 내 고지 전달 확인.

이 증거가 확보되면 재사용 확인 행만 확정 고지로 승격한다. 원본 전체 복사, 새 의존성 추가,
라이선스 서버 구현, 운영 앱 변경은 이 문서 작업 범위에 포함하지 않는다.
