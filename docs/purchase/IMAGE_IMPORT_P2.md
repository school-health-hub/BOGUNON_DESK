# Purchase IMAGE-IMPORT P2

기준: `integration/electron-feature-baseline@9e8632f0a7c205d2e896a832d5f339e6ec30d5ba` (작업 시작/종료 전 원격 일치 확인).
작업 브랜치: `feature/electron-purchase-image-import-p2`.
판정: **CONDITIONAL — P2 구현·Cloud 실제 오프라인 OCR·집중 검증 완료 / Windows 실기기 NOT RUN**.

## 구현

- OCR 줄/단어의 좌표 간격과 상품명 앵커를 이용해 여러 상품/2열 카드/한 행의 여러 라벨을 분리한다. 상품명·옵션·규격·주문 수량·단가·상품금액의 근거 행/박스/신뢰도를 각각 유지한다. 배송비·주문할인·주문총액은 별도 항목으로 표시하며 자동 가산/차감하거나 구매 품목으로 만들지 않는다.
- 정가/할인 전 가격과 적용 단가를 구분하고 명시적 할인가/최종단가를 우선한다. 같은 우선순위의 가격이 충돌하면 빈칸으로 남긴다. 라벨 없는 여러 가격은 후보만 보여 주며 최소값이나 최대값을 단가로 추론하지 않는다. 묶음 구성 수량을 주문 수량으로 사용하지 않는다.
- 이미지별 0/90/180/270° 수동 회전, 읽기 개선(회색조·제한적 명암 스트레치·가능할 때 2배 bilinear 확대), 한 열/혼합 배치(PSM 6/11)를 제공한다. 전처리 후에도 1200만 픽셀/8192px 경계를 유지하며 원본 파일과 Main의 정규화 이미지에는 쓰지 않는다. 처리 이미지는 child 메모리에만 존재한다.
- 처리 좌표는 레이아웃 해석에 사용하고, 확대 보기/근거 박스는 원본 좌표로 역변환한다. 프런트엔드의 이미지 순서 변경은 ID/수정 값을 보존하고 승인만 해제한다. 새 이미지 선택·전처리 변경·재분석은 검토 중 수정 값이 있으면 먼저 확인한다. 재분석 중에는 검토 입력을 잠그고 실패하면 기존 수정 값을 유지한다.
- 원본 확대는 Main 소유 token/sourceId/정수 영역만 받는 `p2:purchase:images:preview`다. 경로/URL/실행 파일을 받지 않는다. Main에서 원본 영역을 잘라 최대 1600px·4MiB PNG 미리보기로 반환한다. 전체 보기/확대·축소/이동/필드 근거 하이라이트, Escape 닫기·호출자 포커스 복귀를 구현했다. P1의 원본을 시각적으로 보존한 정규화 PNG가 보기의 기준이며, 원본 파일 자체는 수정하지 않는다.
- 동일 SHA 및 로컬 64bit perceptual hash(dHash, 거리<=6·비슷한 종횡비)는 이미지 후보다. 빈 배경 hash는 유사 판단에서 제외한다. 상품명 유사도와 옵션을 함께 검사해 겹친 상품 행을 후보로 표시한다. 명시적으로 다른 옵션/숫자 묶음 구성은 같은 항목으로 묶지 않는다. 유사도는 동일 상품의 증명이 아니며 자동 병합/삭제는 없다.
- 개별 승인 전 기존 Purchase 목록을 바꾸지 않는다. 기존 목록 변경 감지·추가/교체 확인·취소/실패 보존·금액 검토/출력 차단을 유지한다. 기존 PurchaseItem/품의문/정산/CSV/XLSX/에듀파인 고정 4열 엔진을 변경하지 않았다.

## OCR와 배포 경계

Tesseract.js 6.0.1 / core 6.1.2 / kor·eng 학습 데이터는 P1과 동일하며 파일 SHA-256도 같다. 새 전처리 의존성은 **pngjs 7.0.0(MIT)** 한 개다. 기존 locked 의존성은 변경하지 않았다. 기존 선별 빌드가 pngjs/전처리 파일/라이선스도 복사하며 자원은 약 **15.3MiB**(P1 약 14.7MiB)다.

기존 오프라인 guard, heap/worker/WASM/입력 크기·개수/시간 제한, cacheMethod:none, 취소·세대 무효화, 임시 폴더 정리를 유지한다. OCR 출력은 단어 근거를 포함하므로 최대 1MiB, 줄 300/단어 3000/텍스트 32000자다. 단어/처리/원본 좌표를 검증한다. 실제 electron-builder 자원 선택/ASAR 검사와 staged runtime 검사는 수행했으나 **Windows Portable은 만들지 않았다**.

OCR/전처리 라이브러리는 Renderer에 유입되면 빌드가 실패한다. 이미지는 외부 AI/API/CDN에 보내지 않는다. preview는 sender/frame/URL·token/source·영역·응답 크기를 검증하고 취소/종료 시 오래된 결과를 무효화한다. 모델 캐시는 검증된 설정별로 구분하여 이전 설정의 결과를 재사용하지 않는다.

## 실제 합성 이미지 결과

모든 자료는 직접 그린 합성 자료이며 실제 쇼핑몰/학교/개인정보를 포함하지 않는다. fixture 생성 방법/텍스트는 `electron-p0/tests/fixtures/purchase-image-p2/PROVENANCE.md`와 생성 스크립트에 기록했다.

| 사례 | 실제 결과 |
| --- | --- |
| 1800×1100 2열 카드, block 모드 | 합성 멸균 거즈 / 10매 중형 / 수량 2 / 정가 15000 / 적용 12000 / 금액 24000; 합성 니트릴 장갑 / 100매 대형 / 수량 3 / 정가 10000 / 적용 8000 / 금액 24000으로 분리 |
| 같은 상품을 포함한 잘린 캡처 | 실제 OCR 두 번의 4개 상품 행을 모두 유지하면서 4개 모두 중복 후보로 표시; 두 원본 유지 |
| 22px 회색 글씨 + Gaussian blur 0.5 | 개선 처리 후 합성 알코올 솜 / Small 100 PCS / 수량 3 / 단가 2500 / 금액 7500 인식; 원본 바이트 불변 |
| 90° 회전 캡처 | 사용자가 270° 보정 후 위 상품/금액 인식; 근거 좌표는 회전 전 원본 650×900 내부로 역변환 |
| 14px 작은 글씨 | 실제 단가 줄 `단가: 2.5008` 오인식. `2500`으로 억지 보정하지 않고 단가 빈칸/검토 경고로 유지. 유효한 품목으로 승인 불가. 인식 정확도 PASS 사례로 세지 않음 |
| sparse 모드의 위 2열 캡처 | 일부 한글 라벨을 `션`, `사푸그애` 등으로 오인식. 선택 가능한 모드이며 모든 이미지에서 더 좋다고 주장하지 않음. 이 캡처의 검증 경로는 block+단어 좌표 분리 |

두 상품의 실제 OCR 결과를 기존 Rust CLI에 전달하여 CSV/XLSX·정산 XLSX·에듀파인 XLSX 생성까지 확인했다. 에듀파인 preview는 기존 고정 4열이며 수량/적용 단가는 각각 `[2,12000]`, `[3,8000]`이다. 품목 합계는 48000원이고 배송/할인/주문총액은 참고 정보로만 유지한다. 정산 비용을 OCR이 자동 입력하지 않는다. 품목 금액을 불일치하게 만들면 기존 Main 검증이 출력을 거부한다.

## 자동 검증

- **Vitest 53 PASS (10개 집중 파일)**: P2 신규 21건과 관련 P1/출력 회귀를 선별했다. 2열/inline/회전 좌표, 가격 우선순위/불명확 가격/저신뢰, 중복/다른 옵션/겹침, reorder·수정 보존·승인 초기화, 확대/원본 영역·위조/경로 거절·늦은 응답 폐기·포커스, 실제 OCR/전처리/기존 실제 출력/금액 차단 포함.
- **Node 7 PASS**: 기존 선별 자원 무결성·실제 오프라인 OCR·네트워크/메모리/timeout/abort·자원 누락 거절, ASAR 전체 Main/Preload 그래프와 Win32 경로 검사를 재사용했다.
- Electron Main/Renderer/tests TypeScript·production build PASS. 전체 앱/P0/Windows QA를 반복하지 않았다. lint 스크립트는 저장소에 없다.
- 기존 `is_total_row` 정적 원본 대조 실패는 P1에 기록된 기존 이슈로 그대로 유지했다. 관련 Rust/Tauri/출력 엔진/대조 스크립트를 수정하거나 무관한 재검증을 하지 않았다.

```sh
npm run electron:p0:build
npx vitest run --maxWorkers=4 electron-p0/tests/purchase-image-p2-*.test.ts electron-p0/tests/purchase-image-p2-ui.test.tsx electron-p0/tests/purchase-image-review.test.ts electron-p0/tests/purchase-image-ui.test.tsx electron-p0/tests/purchase-image-ipc.test.ts electron-p0/tests/purchase-image-preload.test.ts electron-p0/tests/purchase-export.test.ts electron-p0/tests/purchase-specialized.test.ts
node --test scripts/electron-p0/ocr-package.test.mjs scripts/electron-p0/runtime-package.test.mjs
```

실제 출력 테스트에는 기존 Purchase Rust CLI의 locked dev build를 사용했다. 별도 새로운 테스트 프로젝트/workflow를 만들지 않았다.

## 미지원·미검증

- 실제 쇼핑몰별 전체 스킨의 정확도, 강한 흐림/반사/잘린 문자, 90° 단위 이외의 기울기/자동 회전은 보증하지 않는다. 취소선만으로 가격 역할을 정하는 기능은 없다. 모호한 값은 직접 수정한다.
- 흐림 보정은 글자를 복원하는 생성 기능이 아니다. dHash/Dice 유사도 후보는 오탐/미탐이 가능하다. 명시적 옵션이 다르면 유사 상품 후보로 자동 동등 취급하지 않는다.
- Windows의 nativeImage 원본/crop/hash, 실제 창의 DPI/스크롤/키보드·packaged worker·파일 선택/정상 종료: **NOT RUN**. jsdom과 Cloud Node 결과를 Windows GUI PASS로 승계하지 않는다.
- 기존 Soft Rose/Finance/Inventory/WorkerW/외장하드 Portable/통합 브랜치/main은 변경하지 않는다. 새 Windows workflow·Portable 빌드·운영 배포는 수행하지 않는다.
