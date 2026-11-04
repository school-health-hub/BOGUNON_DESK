# Purchase Helper IMAGE-IMPORT P1

기준: `integration/electron-feature-baseline@195f3375e91348d2bbc7145b0e3743ca5f54385f`.
작업 브랜치: `feature/electron-purchase-image-import`.
판정: **CONDITIONAL — 구현·Cloud 실제 오프라인 OCR·집중 자동 검증 완료 / Windows 패키징·실기기 GUI NOT RUN**.

## 사용자 흐름

Purchase Helper → 장바구니 이미지 선택 → 선택한 순서/썸네일 확인 → 선택 이미지 OCR 실행 → 이미지별 원문·좌표·신뢰도 확인 → 상품명/옵션/규격/주문 수량/적용 단가/상품금액 수정 → 품목별 승인 → 기존 목록 추가 또는 확인 후 교체.

- JPG/JPEG/PNG, 최대 10장·장당 10MiB. 파일 선택창이 반환한 배열 순서를 그대로 유지한다. Windows의 실제 마우스 선택 순서는 이번에 검증하지 않았다.
- 최소 256×128, 한 변 최대 8192, 최대 1200만 픽셀. 작은 가로폭(<600)은 별도 경고. 실제 시그니처/PNG CRC/구조/크기를 먼저 확인하고 Electron nativeImage로 해독·PNG 정규화한다. APNG·손상·과도한 입력은 거절한다.
- Main이 읽은 원본 바이트의 SHA-256, 원본명, 순서, 썸네일, OCR 줄 좌표를 검토 모델에 연결한다. 원본 파일에는 쓰지 않는다.
- 수량·가격을 임의로 1/0으로 채우거나 묶음 구성 수량을 주문 수량으로 추론하지 않는다. 현재 파서는 명시적 라벨 위주이며 복잡한 쇼핑몰 레이아웃은 직접 보완한다.
- 할인 전 가격은 적용 단가로 사용하지 않고, 상품 할인은 자동 차감하지 않는다. 배송비/주문 합계는 별도 근거로 표시하며 구매 품목으로 추가하지 않는다.
- 동일 이미지 SHA / 같은 상품명+옵션·규격은 중복 후보로 표시한다. 겹친 캡처·다른 옵션을 자동 삭제/병합하지 않는다.
- 필수값이 유효한 품목만 개별 승인할 수 있다. 필드 수정 시 승인을 해제하며 상품 식별 필드 변경 시 다른 품목의 승인도 해제해 중복을 재확인한다. 전체 적용 전 명시적 확인을 받는다.
- 분석 중 기존 구매 목록이 바뀌면 적용을 거부한다. 교체를 거절하거나 취소/실패하면 기존 품목·품의문·정산 상태를 유지한다.
- 승인한 임시 행만 기존 `PurchaseItem`으로 바꾸고 기존 세션 ID 부여·계산·금액 검토·품의문·정산·CSV/XLSX·에듀파인 출력을 재사용한다. 금액 불일치 승인 플래그를 우회하지 않는다.

## OCR 엔진과 오프라인 배포

Tesseract.js 6.0.1, lockfile의 tesseract.js-core 6.1.2, 한국어/영어 데이터 패키지 각각 1.0.0의 `4.0.0_best_int`를 사용한다. 엔진/코어는 Apache-2.0, npm 언어 패키지 메타데이터는 MIT, upstream traineddata는 Apache-2.0이며 Leptonica BSD-2-Clause 고지도 함께 배포한다. `electron-p0/ocr/licenses/`와 배포된 각 package.json/license가 근거다.

- `npm run electron:p0:build`가 `build/purchase-ocr`에 필요한 Node 의존성·LSTM SIMD/비SIMD WASM·kor/eng 데이터·라이선스를 선별한다. 개발 도구는 제품에 포함하지 않는다.
- 배포 자원 약 **14.7MiB**, 파일별 크기·SHA-256 manifest 생성. 기존 locked 패키지 버전은 변경하지 않았다.
- electron-builder `extraResources`의 `purchase-ocr`에 배치한다. ASAR 안에 WASM worker를 억지로 넣지 않는다. 기존 native CLI 3개를 유지한다.
- beforePack에서 자원 무결성을 검사하고 누락/변조 시 패키징을 차단한다. Main도 선택 전에 검사하며 모델 누락 시 CDN으로 대체하지 않는다.
- 설치/빌드에는 npm 의존성이 필요하지만 배포된 OCR은 로컬 자원만 사용한다. runtime 언어 다운로드·외부 AI·이미지 업로드가 없다.
- **실제 Windows EXE에 넣어 실행한 결과는 NOT RUN**이다. 이번에는 실제 electron-builder 파일 선택 규칙에 모든 배포 파일이 포함되는지와 Linux Node에서 같은 staged runtime이 동작하는지를 검증했다.

## Electron 경계와 자원 제한

Typed IPC는 `p2:purchase:images:pick`, `:analyze({token})`, `:cancel`뿐이다. sender/frame/URL, 인자 개수, opaque token을 검사한다. Renderer는 파일 경로·실행 파일·URL을 지정할 수 없다. OCR과 모델은 Renderer 번들에 들어가면 빌드를 실패시킨다.

Main은 명시적으로 선택한 일반 파일만 읽고 심볼릭 링크/변경된 파일을 거절한다. 정규화 PNG는 격리된 `bogunon-purchase-images-*` 임시 디렉터리에 저장한다. 정규화 전체 100MiB, 장당 48MiB 상한, 검토 행 200개 상한(초과 시 명시적 거절, 조용한 잘라내기 없음)을 둔다.

고정된 Electron executable의 Run-as-Node child가 staged runner만 실행한다. 프록시·NODE_OPTIONS·인증정보를 상속하지 않으며 원본 경로 대신 Main 임시 복사본만 받는다. preload guard는 child와 내부 worker에서 fetch/http/https/socket/subprocess 호출을 차단한다. Node heap 256MiB, worker heap 256MiB, WASM memory 최대 512MiB로 제한한다. 이는 전체 OS RSS가 512MiB라는 뜻은 아니다. 장당 60초·전체 4분, stdout 512KiB·최대 300줄/32,000자 제한을 둔다.

취소/모드 종료/navigation/renderer 종료/앱 종료는 세대를 무효화하고 소유 OCR child만 종료한다. 진행 중 picker/worker 정리가 끝날 때까지 flush하며 임시 파일 제거는 제한적으로 재시도한다. 강제 OS 종료 뒤 잔여 임시 파일의 자동 복구/청소는 P2 범위다. 업무 데이터·OCR 원문·JWT를 제품 로그에 남기지 않는다.

## 실제 검증 결과

- **Vitest 50 PASS (13개 관련 파일)**: 이미지 형식·저해상도·과대 입력, Main 단일/다중 순서, 원본 불변, 권한/위조 token/추가 경로 거절, 병렬/취소/오래된 결과 무효화, 부분 OCR 실패, 임시 정리·종료 대기, 추출/중복/가격 구분, 개별 승인, 추가/교체·취소·실패 시 기존 품의문 보존, typed preload, 기존 출력/세션 및 Finance 원본 보존.
- **Node 7 PASS**: 실제 electron-builder 자원 선택·오프라인 자원 hash, 실제 kor/eng OCR(PNG/JPEG), worker 네트워크 차단·WASM 제한·실행 중 abort/timeout, 모델 누락/변조 거절, ASAR Main/Preload 전체 그래프·Win32 경로.
- Electron TypeScript(Main/Renderer/tests)·production build PASS. 최종 UI 변경 뒤 UI 6건 재확인 PASS(위 50건과 중복 계산하지 않음).
- 실제 합성 캡처: `합성 멸균 거즈`, `10매 포장`, 주문 수량 `2`, 단가 `12,000원`, 상품금액 `24,000원`, 배송비 `3,000원`, 주문총액 `27,000원`을 인식했다. 상품명 신뢰도 96, 단가 91, 상품금액 89였다. 신뢰도는 정확도를 보증하는 확률이 아니다.
- 이 실제 OCR 결과를 기존 `PurchaseItem`으로 바꿔 기존 Rust CLI의 CSV/XLSX·정산 XLSX를 생성했다. 에듀파인 preview는 `['합성 멸균 거즈','10매 포장',2,12000]`의 기존 고정 4열이며 XLSX 생성도 통과했다. 배송비와 주문총액은 품목에서 제외했다.
- `synthetic-cart-english.png`의 `Alcohol Swab` 및 JPEG의 `24,000`도 실제 staged OCR로 확인했다. 모든 fixture는 합성 자료이며 생성 근거는 fixtures/PROVENANCE.md에 기록했다.
- 새 OCR 의존성 closure의 npm advisory 교집합은 0이었다. 기존 전체 npm audit의 20건(고위험 3건 포함)은 기존 locked 패키지에서 발생하며 이번 범위에서 자동 업그레이드하지 않았다.
- lint 스크립트는 저장소에 없어 실행하지 않았다. 전체 앱/P0/기존 Windows QA를 반복하지 않았다.

실행 명령:

```sh
npm run electron:p0:build
npx vitest run electron-p0/tests/purchase-image-*.test.ts electron-p0/tests/purchase-image-ui.test.tsx electron-p0/tests/purchase-export.test.ts electron-p0/tests/purchase-specialized.test.ts electron-p0/tests/purchase-import-ui.test.tsx electron-p0/tests/purchase-session.test.tsx electron-p0/tests/purchase-save-preservation.test.tsx electron-p0/tests/finance-provenance.test.ts electron-p0/tests/finance-preload.test.ts
node --test scripts/electron-p0/ocr-package.test.mjs scripts/electron-p0/runtime-package.test.mjs
node scripts/electron-p0/check-ocr-package.mjs
```

실제 출력 검사는 기존 Rust Purchase CLI의 locked dev build를 선행했다. Rust 도구는 Cloud 임시 경로에만 두었으며 제품에 추가하지 않았다.

별도 기존 실패: `node scripts/electron-p0/verify-excel-source.mjs`는 `Original Rust function changed: is_total_row`로 실패한다. 변경 전 기준 코드에서도 동일하게 재현했다(195f의 직전 d779 기준에는 날씨/급식 3개 파일 차이만 있음). 이번에 Rust/기존 출력 엔진/그 검증 스크립트를 수정하지 않았다. 실제 출력 계약 테스트 통과와 이 정적 대조 실패를 구분한다.

## P2와 미검증 경계

- Windows의 실제 선택창·nativeImage 해독·packaged Electron Run-as-Node worker·오프라인 최초 실행·취소/종료·작은 창 UI: **NOT RUN**. 기존 외장하드 Portable을 바꾸지 않았으며 새로운 Windows QA workflow/Portable도 만들지 않았다.
- 실제 쇼핑몰/다단 장바구니의 인식률, 흐린 글씨·회전·사진 전처리·반복 캡처의 유사도 후보 확대, 사용자 순서 재배치 및 원본 확대 검토는 P2 후속이다. 현재 PSM 6과 라벨 우선 파서는 완전자동 장바구니 해석기가 아니다.
- 학교·개인정보·실제 주문 자료를 사용하지 않았다. 기존 12개 업무 기능·Tauri·Finance 암호화/키·Inventory JSON/서버 계약·Soft Rose·Native WorkerW는 변경하지 않았다. main/통합 브랜치 병합·운영 배포는 수행하지 않는다.
