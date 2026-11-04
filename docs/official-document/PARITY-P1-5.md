# PARITY-P1-5 공문작업실 세부 기능

기준/원격 통합 SHA: `99bad954b519b63b1b94c525f1d3e3001ffa28fc`.
작업 브랜치: `feature/electron-official-ai-parity`.

## 원본 조사와 기능 판정

Tauri 근거는 현재 계보의 `src/components/desktop/OfficialDocumentPanel.tsx` (`2de999ac3bfc6ffec738634866780ab72ddb6d41`), `OfficialDocumentOutput.tsx`, `OfficialDocumentAiConfirmation.tsx`, `OfficialDocumentLocalSummary.tsx`, `src/official-document/promptBuilder.ts`, `officialDocumentAiService.ts`, `summaryToQuickAddDraft.ts`다. 원본 reducer 전체를 이식하지 않았다. 원본 `officialDocumentSession.ts`의 알려진 타입 오류는 이번 범위 밖으로 유지했다.

| 기능 | 기존 Tauri 계약 | Electron 기준본 → 이번 결과 (코드/Cloud 기준) |
| --- | --- | --- |
| 원문 가져오기/편집/미리보기 | 파일 추출·작업별 입력·출력 분리 | FULL → FULL, 기존 Electron Main/CLI 경로 유지 |
| AI 초안 | 작성 정보 prompt + 검토 후 선택 route 호출 | PARTIAL → FULL, 기존 prompt/검토 gate 재사용 |
| AI 수정·다듬기 | 원문+요청 prompt, 별도 응답 표시/복사 | PARTIAL → FULL, 원문/현재 원고 선택, 별도 제안 검토 |
| AI 요약 | 요약 prompt, 별도 응답 표시/복사 | PARTIAL → FULL, 요약 편집·복사·재요청 및 실패 시 이전 결과 유지 |
| 로컬 핵심정리 | 명시된 항목만 규칙 추출 | FULL → FULL, 동일 extractor/formatter 유지 |
| 요약→업무 | **로컬 규칙 요약의 첫 업무**를 `createOfficialDocumentQuickAddDraft`로 BOGUNON QuickAdd에 전달 | MISSING → PARTIAL, Electron 전용 로컬 업무로 연결. 서버 일정·계정 동기화는 미지원 |
| 개인정보 전송 검토 | 최종 전송문 편집·검사·사용자 확인 | PARTIAL → FULL, 원본 확인 UI를 embedded로 재사용 + 기존 SurfaceDialog/Main 최종 검토 |
| 신규 ODT 저장 | home-v1 로컬 초안, 원본 서식 보존 아님 | FULL → FULL, Main/CLI/ODT schema 변경 없음 |

현재 원고에 전체 제안 적용/선택 문구 끝에 추가, AI 요약에서도 복수 업무 후보 검토는 **이번 요청에 따른 확장**이다. Tauri 원본이 자동 diff/부분 적용이나 AI 요약의 구조화 업무 일괄 생성을 지원했다고 주장하지 않는다. AI 응답의 4개 출력 구획을 자동 파싱하지 않으며 교사가 제목·본문을 직접 정리한다. 구조화되지 않은 요약은 규칙으로 확인 가능한 후보만 표시하고, 후보가 없으면 빈 제목을 직접 입력해야 한다. 최대 10개 후보는 기존 extractor 한도다.

## 보안과 원고 보호

- `OfficialAiWorkflow` → 기존 `window.electronWork.chatgpt.generate({tool:'official-document',prompt})` 또는 `ai.generate` → 기존 Main 서비스/인증 helper. 새 OAuth/IPC/vault/외부 네트워크 코드 없음. 토큰/Key/경로는 Renderer로 전달하지 않는다. OpenAI/Gemini 연결 변경 없음. 자동 provider 전환 없음.
- status 조회는 로컬 연결 snapshot만 읽는다. 로그인/모델 네트워크 갱신/유료 호출을 자동 실행하지 않는다. 로컬 ready 조건에 더해 Main이 전송 시 실제 계정·권한·모델을 재검증한다. 연결 상태 확인을 실서비스 호출 성공으로 표시하지 않는다.
- 원본 `buildCreatePrompt`/`buildRevisionPrompt`/`buildSummaryPrompt`, `evaluateOfficialDocumentOutbound`, `prepareOfficialDocumentAiSend`, `OfficialDocumentAiConfirmation`을 재사용한다. 검토 창에서 편집한 **최종 전송문**만 승인 후 보낸다. 개인정보 패턴/64KiB 제한 유지. 자동 탐지는 보조 수단이며 실제 개인정보를 보내지 말라고 안내한다. 기존 Main 확인과 요청 timeout도 유지한다.
- 원문/작성 정보/편집 원고/작업 탭 변경 시 전송 검토와 소유 요청을 취소하고 이전 결과는 stale로 표시한다. request epoch와 문서 snapshot을 함께 확인해 늦은 응답의 반영 및 오래된 제안 적용·업무 전달을 차단한다. 이미 전송한 내용은 취소로 회수되지 않는다.
- AI 응답은 별도 수정 가능한 검토본이다. 원고 자동 덮어쓰기/자동 파일 저장 없음. 전체 적용·선택 문구 끝에 추가에 사용자 확인이 필요하다. 적용은 기존 `editOfficialDocumentBody`를 사용해 붙임 metadata와 본문을 동기화한다. 실패/전송 취소는 기존 원고와 이전 제안을 유지한다.
- 새 작업/닫기/제안 취소의 폐기 확인. session key 변경 시 AI 작업 메모리도 재생성하며 종료 시 소유 요청을 정리한다. 원문·AI 입력/응답·개인정보를 로그/설정/임시 파일에 기록하지 않는다. 자동 장기 저장 없음.

## 로컬 업무 전달

- 원본 action/title/명확한 연월일 parser를 재사용한다. 마감 연도·날짜를 추론하지 않는다. 교사가 수행일·마감·제목·4분류·중요도를 수정하고 **개별 선택 + 저장 확인**해야 한다. 시간·기간 일정·서버 동기화·담당자·제출방법·붙임은 로컬 업무에 저장하지 않음을 표시한다.
- 기존 `LocalWorkspaceProvider.commit`/`localQuickTask`/Main tasks store만 사용한다. `<Electron userData>/work-data/local-tasks/tasks.json`, backup, version 1/revision, 원자적 저장 계약 그대로다. 저장 성공은 같은 provider로 Dashboard에 반영된다.
- 하나의 결과/후보에 안정적인 UUID를 유지한다. 같은 후보 재열기/저장 응답 유실 후 refresh/재시도에 중복 생성하지 않는다. ID가 같고 내용이 다르면 덮어쓰지 않는다. batch를 한 번 원자적으로 저장한다. 쓰기 실패 시 후보 입력과 기존 자료 보존, recovered backup은 읽기 전용 유지.
- 저장 중 중복 제출·후보 수정·작업실 종료/문서 전환을 막는다. 진행 중인 원자적 저장을 취소 성공으로 표시하지 않는다. 취소 전에는 mutation 0회다. 이미 저장한 업무는 제안 취소/새 작업으로 삭제하지 않는다.

## 변경 범위

- `electron-p0/renderer/P0App.tsx`: 공문 전용 AI adapter 연결만 교체.
- `electron-p0/renderer/official-document/OfficialAiWorkflow.tsx`: AI 작업/승인/수명주기/제안 적용.
- 같은 디렉터리의 `SummaryTaskReview.tsx`, `summaryTasks.ts`, `workflow.css`: 업무 후보 검토와 scoped 스타일.
- `src/official-document/OfficialDocumentWorkspace.tsx`, `electronWorkflow.ts`: session-only adapter와 원고 보호.
- `src/components/desktop/OfficialDocumentAiConfirmation.tsx`: optional embedded mode. Tauri 기본 동작 유지.
- `electron-p0/tests/official-ai-workflow.test.tsx`, `official-summary-tasks.test.tsx`: 합성 자료 집중 검증.
- 본 문서. 기존 native CLI 5개/OCR, Main/Preload/auth/저장/ODT 엔진·Finance·Inventory·다른 모듈·Dashboard geometry·TD2 Glass·workflow·의존성 변경 없음.

## 검증과 남은 한계

- 집중 Vitest: **231 PASS / 24 파일**. 추가 기존 Main AI/ChatGPT 및 Preload 경계: **23 PASS / 4 파일**. 반복 실행 합산이 아닌 서로 다른 테스트 집합이다. 신규 14개는 전송 승인/원고 분리/제안 적용·취소/늦은 응답/실패·API route/실제 합성 로컬 파일 저장·재실행/Dashboard 반영/응답 유실 후 중복 방지 등을 검증한다.
- 기존 PDF/HWPX/ODT 합성 fixture를 **실제 고정 Rust CLI**로 가져오고 ODT 생성·재가져오기 통과. 기존 산출물의 native 실행 파일을 재사용했으며 Rust 엔진 변경/새 Portable 빌드 없음. 사용자 원본 ODT 서식 보존 검증을 대신하지 않는다.
- Electron Main/renderer/tests TypeScript 및 production build PASS. 루트 타입 오류는 기존 **13개 그대로**, 새 오류 signature **0개**. 루트 전체 build PASS로 표시하지 않는다. lint script는 없어 추가하지 않았다.
- ASAR runtime graph·기존 5개 native 자원/provenance: **6 PASS**. package/new worker/CLI/IPC 추가 없음. 기존 출력 chunk 경고는 유지한다.
- Windows GUI/980×700 geometry·실제 ChatGPT/API 호출·실제 원본 ODT 저장·Portable은 **NOT RUN**. 기존 TD2 PARTIAL 판정 유지. Cloud 모의 호출/DOM 검증을 Windows 실서비스 PASS로 승계하지 않는다.
- Cloud B에서 원격 통합 HEAD가 기준 SHA를 유지하면 fast-forward 가능. 이번 작업은 기능 브랜치 일반 push까지만 수행한다.
