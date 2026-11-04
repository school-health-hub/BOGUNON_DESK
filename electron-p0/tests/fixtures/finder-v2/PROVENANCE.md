# 합성 Finder V1/V2 fixtures

실제 사용자·학교 자료나 서비스 응답이 아니다. 외부 요청 없이 작성한 합성 데이터다.

- V1: 기준 `7e791d76cc85bedbc2a270ffa1cdfa5ca939f551`의 `electron-p0/protocol.ts` 및 `main/education-video-library.ts`.
- V2: Tauri `integration/education-video-finder-product-pr@04ad2d2a40f92817aea6e47e2b57078a90876e11`의 `src/education-video/libraryV2.ts`, `aiLibraryMetadata.ts`, `candidateRecord.ts`, `recommendationReason.ts`, `src-tauri/src/education_video/{model,ai_metadata}.rs`.
- V2는 teacher 6필드, nullable provider/duration, AI candidate/sources/provenance, 교사 확인 record, 추천 이유의 실제 계약을 사용한다. 알 수 없는 부가 필드를 만들지 않는다.
- Tauri의 TTL 삭제/official 재정규화는 원형 보존 가져오기에는 적용하지 않는다. source의 출처·공식·확인 값은 원본 기록이며 앱의 재검증 결과가 아니다.
