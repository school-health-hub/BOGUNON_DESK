# PARITY-P0-2 — Finder V2 데이터 호환 복원

기준 제품: `7e791d76cc85bedbc2a270ffa1cdfa5ca939f551`.
원본: `integration/education-video-finder-product-pr@04ad2d2a40f92817aea6e47e2b57078a90876e11`.

## 확인한 원본과 재사용

- Tauri `src/education-video/libraryV2.ts`: `{version:2,entries}`·teacher/provider 분리·1000항목·2 MiB 계약.
- `aiLibraryMetadata.ts`, `candidateRecord.ts`, `recommendationReason.ts`: AI 후보, 교사 사실 확인, 추천 이유의 순수 검증 함수를 Electron Main에 선별 재사용. Tauri 서비스/인증 의존성은 가져오지 않았다.
- `src-tauri/src/education_video/{model,ai_metadata}.rs`: nullable provider/duration, nullable optional 기록 및 legacy AI provenance/verification 쌍의 생략 지원 확인.
- `ConnectedFinder.tsx`/`aiVideo.ts`의 공문 초안 전달은 `candidateDraftInput`과 사용자 확인 뒤 작성 요청을 전달하는 별도 흐름이다. URL·교사 확인 제목/제작자/길이·승인 추천 이유를 전달한다. **이번에는 데이터 계약만 확인했으며 공문 전달을 연결하지 않았다.**
- `request_core.rs`의 서버 검색은 `REAL_DISPATCH_ENABLED=false`이므로 운영 검색으로 복원하지 않았다. 현재 Electron YouTube Data API 검색·전용 Key vault·AI 보조는 유지했다.

## 필드별 호환

| 데이터 | Electron V1 | Tauri V2 | 이번 처리 |
|---|---|---|---|
| 루트 | `version:1,items` | `version:2,entries` | 두 형식을 별도 파일로 유지. 강제 변환·혼합 JSON 없음 |
| 영상 ID | `videoId` | `videoId` | 11자 ID, 파일 내부 중복 거절, 저장소 간 충돌은 기존 우선 |
| 제목·채널·URL·길이 | 평면 필드, 길이 number | `provider` 내부, 길이 nullable, provider nullable | V2 원형 보존. 없는 길이/제목/채널을 만들어 V1로 변환하지 않음 |
| 교사 작성 정보 | 평면 6필드 | `teacher.{educationTitle,target,schedule,instructions,message,notes}` | 6필드 보존·수정·명시적 저장, 최대 20,000자 |
| 제공자 출처 | `mock/youtube` | `live/synthetic-mock`, synthetic, official/evidence, fetchedAt/expiresAt | 이름 바꾸지 않고 원형 보존·읽기 전용 표시. 공식 주장 재검증으로 취급하지 않음 |
| AI 후보 | 없음 | ai: 설명/관련성/이유/출처/시각/needsReview/provenance/verification | 구조화 원형 저장·재내보내기·검토 표시 |
| 교사 사실 확인 | 없음 | candidateRecord | 기존 확인 상태 표시, 명시적 확인 저장, AI 후보와 일관성 검증. needsReview는 true 유지 |
| 추천 이유 | 없음 | recommendationReason: ai-generated/teacher-edited/deleted | 원형 보존, 사용자 편집 시에만 teacher-edited/deleted로 변경 |
| legacy optional | 해당 없음 | AI provenance+verification 쌍 생략, native nullable optional | 입력의 생략/null을 그대로 보존. 가져오기 때 임의 기본 필드를 추가하지 않음 |
| 미지원 필드·버전 | 엄격 V1 | 엄격 V2 | 자동 제거/수용하지 않고 적용 차단. 필드 손실 경고/형식 오류 표시 |

영상 URL은 ID에 일치하는 `https://www.youtube.com/watch?v=<id>`만 허용한다. 교사·제공자·AI 필드는 각 원본 길이/배열/enum/시각 제한을 검사한다.

## 사용자 흐름

1. 기존 Finder의 **V1/V2 JSON 가져오기**에서 Main 파일 선택 대화상자를 연다. Renderer가 임의 경로/URL/JSON 파일 내용을 전달하지 않는다.
2. Main은 선택한 UTF-8 `.json`만 2 MiB 한도로 읽는다. symlink/변경 중 파일/비정상 파일을 거절한다.
3. 엄격한 스키마 검증 후 버전·항목 수·ID 충돌·AI 기록·만료 메타데이터와 보존 안내를 표시한다. 검토 전에는 쓰지 않는다.
4. 충돌은 기존 자료 우선으로 선택 불가/건너뜀 표시한다. 나머지도 사용자가 선택 해제할 수 있다. 확인한 ID만 추가한다.
5. Main 소유 preview token(10분), 저장소 fingerprint를 적용 시 재검증한다. 취소·stale token·중간 저장 변경·파일 오류는 기존 자료를 보존한다.
6. V2 자료는 별도 편집 영역에서 교사 필드·추천 이유·사실 확인 기록을 수정한다. 저장 실패 시 입력을 유지하고, 취소·자료 전환에 확인을 요구한다. 불러오기 갱신 후에도 편집 시작 fingerprint를 유지해 오래된 원고 덮어쓰기를 막는다.
7. 기존 **내보내기**는 V1만, **V2 원본 내보내기**는 V2만 저장한다. 한 파일로 합쳐졌다고 표시하지 않는다. 기존 Main 저장·덮어쓰기 확인·실패 보호를 재사용한다.

V1의 현재 선택 영상·메모·안내문은 가져오기 후 보관함 목록이 바뀌어도 자동 교체하지 않는다. V2와 같은 ID를 V1 save로 덮으려 하면 거절하고 V2 편집을 안내한다.

## 저장·실패 보호

경로: `<Electron userData>/work-data/education-video/`.

- 기존 `library.json`, `library.backup.json`은 V1 그대로 유지한다.
- 추가 `library-v2.json`, `library-v2.backup.json`은 원본 V2 루트/필드 그대로 저장한다. 각 파일 최대 2 MiB/1000항목.
- 모든 변경은 공통 직렬화 큐로 처리한다. 가져오기는 선택한 한 버전의 파일만 변경하므로 V1/V2 다중 파일 절반 저장을 만들지 않는다.
- 기존 SettingsStore의 임시 파일→sync→rename·Windows EPERM 제한 재시도와 이전 정상 백업을 재사용한다. 손상/미지원 버전에서 백업을 읽으면 변경은 차단하고 원본 bytes를 보존한다. 백업 읽기를 성공한 쓰기로 표시하지 않는다.
- Tauri 프로필·토큰·계정 데이터 탐색이나 자동 이전은 없다. 알려진 저장소 파일 외 읽기는 명시적으로 선택한 JSON에 한정한다.

## 명시적 복원 경계

- Tauri의 `parseLibraryV2/expireMetadata`는 읽기 중 만료 provider/AI를 제거하고 공식 채널 주장을 레지스트리로 재정규화한다. 이는 가져오기 원형 보존과 충돌하므로 이번 archive 호환 경로에서는 호출하지 않는다. 만료/공식/AI 확인은 **가져온 기록**으로 표시한다.
- 자동 메타데이터 갱신·만료 삭제·제공자 메타데이터 편집은 복원하지 않았다. 원본을 임의 삭제하거나 사실로 승격하지 않기 위한 범위 구분이다.
- 구조화 AI 기록은 가져오기·저장·검토·교사 확인을 지원한다. 새로운 구조화 AI 검색/생성 또는 공문 전달은 추가하지 않았다.
- V2 → 단일 V1 변환은 nullable/AI/시각/확인 정보 손실 때문에 제공하지 않는다. 이 데이터를 V1 내보내기에 몰래 포함하거나 삭제하지 않는다. V2 전용 내보내기를 사용한다.
- 미지원 버전·필드·잘못된 URL·불완전한 교사/AI 기록·한도 초과는 차단한다. 인식하지 못한 데이터의 부분 적용이나 추측한 필드 생성은 없다.

## 검증 기록

- 신규 합성 fixture 출처: `electron-p0/tests/fixtures/finder-v2/PROVENANCE.md`. 실제 사용자·학교 자료·외부 서비스 호출 없음.
- 집중 Vitest: **101 PASS** (신규 데이터/IPC/UI 34개 + 기존 Finder 검색·vault·V1 보관함/메모/export, AI/ChatGPT Preload 및 Purchase 설정 회귀 67개). 중복 실행 횟수를 합산하지 않은 개수다.
- V1 round-trip, V2 원형 재내보내기, null/legacy 필드, ID 충돌, 선택 적용, 손상·미지원 필드, 취소/늦은 결과, stale fingerprint/token, 쓰기 실패·원본 보호, 새 store 인스턴스 재시작 복원, 교사 메모·구조화 검토를 확인한다.
- Electron Main/Preload·Renderer·테스트 TypeScript 및 production build PASS. 기존 ASAR 전체 런타임 의존성 검사 3 PASS. 별도 Node Main-store 프로세스를 종료·재기동해 V1/V2 원형 재내보내기 PASS를 확인했다. 실제 Electron GUI 재실행과는 구분한다.
- 실제 Windows GUI/Portable·네이티브 파일 대화상자·YouTube/AI 실서비스: NOT RUN. Portable 빌드·새 workflow·기존 Tauri 브랜치 병합 없음.

현재 통합 기준이 `7e791d7…`를 유지하면 기능 커밋으로 fast-forward 가능하다. 이번 작업에서 통합 브랜치·main은 변경하지 않는다.
