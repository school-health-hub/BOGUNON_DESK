# PARITY-P1-3 — Electron 전역 파일 드롭

기준: `3216de4be9e4f6e38e4e02025e87fc5915afe9a9`.
브랜치: `feature/electron-global-file-drop`.
판정: **CONDITIONAL** — Cloud 구현/집중 검증 완료, 실제 Windows Explorer 드롭 및 GUI NOT RUN.

## 원본 계약과 연결

- Tauri `src-tauri/src/lib.rs`의 `desktop:file-drop` emit, `DashboardCanvas.routeDroppedFiles`, `src/file-drop/fileDropRouter.ts`, `FileDropRouter`, `extractOfficialDocumentPath`, `extractRecordHelperPaths`, Purchase `analyzePaths` 경로를 확인했다.
- 원본의 세 작업실 후보/추천 규칙과 라우터 UI를 재사용한다. Main의 순수 분류 사본은 원본과 대조 테스트한다. Tauri event/command/service 및 호출부는 변경하지 않는다.
- Electron에는 Tauri native drag event가 없으므로 **격리된 Preload의 신뢰된 native File 이벤트 → Electron webUtils → private Main IPC** 어댑터를 둔다. 실제 경로는 Main 경계로만 전달한다. Renderer main world에는 경로 해석/임의 파일 읽기/stage/명령 실행 API를 노출하지 않는다.
- Main이 검증한 파일명/형식/크기/불투명 token/candidate만 화면에 전달한다. 사용자가 작업실을 선택하고 ‘확인 후 작업실로 전달’을 눌러야 사본을 준비한다.
- 작업실의 기존 가져오기 버튼/검토 흐름에서 해당 token을 소비한다. Main 전용 `DropSelections`가 **기존 pick handler의 selector만 한 번 대체**한다. 기존 CSV/Excel/PDF 분석, 공문 service, Record 추출, 이미지 pick handler/decoder/OCR/AI 및 출력 엔진은 재작성하지 않았다.
- 일반 파일 선택은 기존 dialog를 그대로 사용한다. 승인된 drop override는 다른 작업이나 이후 picker에 남지 않는다.

## 지원 범위

| 파일 | 대상 | 전달 방식 |
| --- | --- | --- |
| CSV / XLS / XLSX | 품의 도우미 | 여러 파일을 순서대로 표시하고 한 파일씩 기존 열 매핑·추가/교체 검토 |
| PDF | 품의 / 공문 / 생기부 | 사용자가 작업실 선택. 공문은 1개, 생기부는 최대 50개 |
| HWPX | 공문 / 생기부 | 사용자 선택, 공문은 1개 |
| ODT | 공문 | 유효한 ODT 1개 |
| HWP 5.x / DOCX | 생기부 | 기존 학생별 추출·자료 추가 계약 |
| PNG / JPG / JPEG | 품의 도우미 | 최대 10장 선택으로 전달, 원본/전송 검토 및 OCR/AI 실행은 별도 사용자 조작 |

- 전체 50개/150MiB, 문서당 15MiB, 이미지당 10MiB. 기존 각 모듈의 압축·추출·이미지 크기·금액 검토 제한도 계속 적용한다.
- 형식별 기존 엔진이 거절하는 암호화·손상·스캔 PDF/구형 HWP 등은 성공으로 표시하지 않는다. 스캔 PDF를 이미지 OCR로 자동 변환하지 않는다.
- 드롭 metadata 검사는 bounded ZIP central directory/문서 entry/ODT MIME, CFB stream metadata, PDF magic, CSV 텍스트, PNG/JPEG 헤더·크기를 확인한다. **본문 추출·디코딩·분석은 승인 후 기존 모듈에서 추가 검증**한다.
- ZIP64/멀티디스크/큰 central directory(256KiB 초과)/선언 해제 합계 50MiB 초과, 제한된 CFB directory probe(16 sector/헤더 DIFAT 범위)로 확인할 수 없는 문서는 드롭에서 거절한다. 형식이 확정되지 않는 경로를 추정해 수용하지 않는다. 기존 개별 파일 선택 기능은 변경하지 않았다.
- 폴더·지원하지 않는 형식·혼합 불가 batch·이미지 10장 초과는 거절한다. 이미지→PDF 병합, 자동 저장/덮어쓰기, 자동 AI 분석은 없다.

## 기존 작업 보존

- Purchase는 drop 수신/분석만으로 품목을 추가하지 않는다. 기존 임시 검토·개별 이미지 승인·추가/확인 후 교체·금액 검증을 재사용한다. 이전 파일 검토를 다른 drop으로 바꾸는 경우에도 사용자 확인을 거친다.
- 공문은 기존 원문 교체 확인 후 summary source로만 가져온다. 편집 중인 원고를 자동 교체하지 않는다.
- 생기부는 기존 reducer와 세션 개수/텍스트 제한 안에서 추가한다. 학생별 메모·기록·AI 전송 확인·오래된 응답 무효화 계약은 유지한다.
- 다른 작업실/Finance/설정 등이 열린 상태의 **자동 작업실 전환은 차단**한다. 현재 작업을 먼저 정리/닫은 뒤 드롭하도록 안내한다. 같은 작업실 또는 Dashboard에서는 해당 후보를 선택할 수 있다. 기존 화면을 강제로 닫거나 데이터가 사라지도록 unmount하지 않는다. 이는 미구현 전환을 성공으로 처리하는 경로가 아니다.
- 중복 이벤트는 같은 unapproved offer를 재사용하고 다른 pending/approved drop을 자동 교체하지 않는다. 각 source/token은 한 번만 소비하며, 취소/만료/닫기 이후 늦은 결과는 반영하지 않는다.

## 보안 및 임시 자원

- Main에서 sender/window/top frame/renderer URL, exact schema, target/token/sourceId를 확인한다. 승인되지 않은 token이나 대상 작업실·경로 필드 변조는 거절한다.
- 로컬 absolute/canonical 경로만 허용하고 UNC/device/비정규 경로·directory·hardlink/symlink 및 linked ancestor를 거절한다. FD를 열어 identity·size·mtime·ctime와 bounded header hash를 확인한다. 원본은 읽기 전용이다.
- 승인 직전 원본을 다시 검사하고 기존 bounded `readSelectedPurchaseFile`로 읽어 안정된 사본을 만든다. 승인 후 원본이 바뀌어도 읽는 대상은 이미 승인한 사본이다. 사본도 소비 전후 전체 SHA-256을 검사한다.
- 위치: `<userData>/work-data/drop-import-tmp/drop-UUID/<순서>/<원래 파일명>`; 개인 권한의 임시 디렉터리와 읽기 전용 파일을 사용한다. QA profile의 store 목록에도 이 격리 경로를 추가했다.
- offer는 2분, 승인된 사본은 최대 10분. 소비·취소·만료·정상 종료 시 이 작업이 만든 사본만 제거하고 기존 모듈의 요청 취소/flush도 재사용한다. 원본 삭제/수정, 기존 데이터 자동 이전, 외부 API 호출 또는 AI 전송은 없다.
- 기존 개별 Record import는 계속 원래 메모리 계약으로 동작한다. **승인된 전역 드롭**에는 전달용 임시 원본 사본이 생긴다는 점을 UI에 명시한다. 장기 자동 저장 기능은 추가하지 않는다.
- 비정상 OS/프로세스 강제 종료에서의 임시 잔여물 정리와 Windows ACL/reparse/mapped-drive 특성은 실제 Windows 후속 검증 대상이다. 임의의 과거 폴더나 사용자 자료를 자동 삭제하지 않는다.

## 검증과 인계

- 고유 집중 Vitest **161 PASS**: private preload 이벤트/권한, 형식 분류·후보·순서, 승인 전 importer 0회, token/path/caller 변조, 원본/사본 변경, 권한·지원 불가, 중복·취소·만료·늦은 결과, 실제 고정 로컬 CSV/Excel/공문/Record 추출 및 이미지 picker 연결, 기존 UI/자료 보호.
- Purchase P0-1/Finder P0-2/Record P1-1/업무 폴더 P1-2/메모/QA profile의 관련 최소 회귀를 포함한다. 반복 실행 횟수를 합산하지 않는다.
- Electron Main/Renderer/tests TypeScript 및 production build PASS. 실제 ASAR Main/Preload runtime graph 및 기존 5개 native resource/provenance 검사 **6 PASS**. 기존 검증된 Cloud native binary/합성 fixture를 재사용했으며 새 native CLI는 추가하지 않았다.
- 루트 타입 오류는 기준과 같은 기존 13개, 신규 서명 0개. lint script가 없어 새 script를 만들지 않았다. diff 및 변경 파일/민감정보 검사 수행.
- Windows Explorer의 native File drop, sandbox webUtils의 실제 실행, 980×700 버튼/스크롤/포커스, native dialog/실제 window 종료는 **NOT RUN**. GUI capture나 Portable은 생성하지 않았다. Cloud DOM 검증을 Windows 실검증으로 대체하지 않는다.

main/통합 브랜치, native CLI 5개·OCR·AI 인증·Finance·Inventory·학교 프로필·TD2 Glass geometry는 변경하지 않는다. 기능 브랜치만 일반 push한다. 통합 원격이 기준 SHA를 유지하면 Cloud B에서 fast-forward 통합 가능하다.
