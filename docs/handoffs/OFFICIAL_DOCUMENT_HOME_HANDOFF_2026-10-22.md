# 공문작업실 집 PC 인계 — 2026-10-22

## Git 기준

- 저장소: `school-health-hub/BOGUNON_DESK`
- 브랜치: `feature/official-document-enhancement`
- 체크포인트 직전 HEAD: `9c12a2084733e48fb0648df70547cdbbab932d2b`
- 인계 체크포인트: 이 문서를 포함한 `wip: checkpoint official document desktop redesign` 커밋
- upstream: `origin/feature/official-document-enhancement`
- 학교 PC QA EXE, `target-official-document-qa/`, `dist-official-document-qa/` 및 로컬 QA 데이터는 GitHub에 포함하지 않는다.

## Phase 1B QA 상태

확인된 PASS 범위:

- 합성 JSON 참고자료 반입, 검증, 로컬 저장 및 재시작 복원
- 승인 해시 불일치 거부와 개인정보 의심 행 제외
- 참고자료 검색, 선택, 명시적 적용과 사용자 입력 보호
- 참고자료 패키지 교체, 삭제, 합성 fixture 재반입 복원
- 합성 PDF, HWPX, ODT 가져오기
- 신규 공문 작성, 받은 공문 수정, 공문 핵심정리
- 제목, 본문, 전체 복사와 Windows 클립보드
- 392px fallback 및 키보드 접근성 수동 QA
- Rust `cargo check`, TypeScript 검사, 공문 집중 테스트와 기존 전체 Vitest 회귀

미검증 또는 제한 사항:

- 실제 Google Sheets, Drive, Apps Script 연결은 Phase 1B 범위 밖이며 HOLD 상태다.
- 실제 AI, Supabase, 운영 계정 및 운영 공문 데이터는 사용하지 않았다.
- Desktop-first 리디자인이 반영된 새 QA EXE의 네이티브 WebView2 수동 QA는 완료하지 못했다.
- 학교 PC release 재빌드는 `openssl-sys`의 MSVC C1083 오류와 장시간 재컴파일 때문에 중단했다. 소스 오류로 확인된 사항은 없다.

## Desktop-first 리디자인 구현 상태

- compact toolbar와 작성·수정·핵심정리 mode tabs
- 왼쪽 작성 panel과 오른쪽 white paper document preview
- 로컬 초안 primary action, AI 기능 secondary utility 배치
- 참고자료 찾기·관리 분리 및 기본 접힘
- 새 작업 시 참고자료 펼침 상태 초기화
- 제목·본문·붙임의 단일 문서 surface
- 교직원 메신저, 체크리스트, 표 복사용 본문의 appendix 분리
- panel body 중심 단일 scroll과 카드 중첩 감소
- 기존 navy, mint, ivory token 및 Pretendard 체계 재사용
- 1920px 최대 폭 제한과 900px 이하 기존 single-column fallback 보존

비즈니스 로직, Phase 1B 데이터 모델, session reducer, JSON 검증·저장, 문서 추출, AI service, privacy guard, clipboard 및 Rust command는 변경하지 않았다.

## 검증 결과

- `npx tsc --noEmit`: PASS
- 공문 관련 Vitest: 5 files, 43 tests PASS
- 운영 frontend production build: PASS
- 공문 QA frontend production build: PASS
- 전체 Vitest: 1,258 PASS, MY FINANCE packaging 3건이 병렬 5초 제한에서 timeout
- timeout 파일 단독 재실행: 8/8 PASS (`--testTimeout=20000`)
- `git diff --check`: PASS
- lockfile 변경: 없음
- 개인정보, API key, secret 및 실제 공문 자료 유입: 발견 없음

## 시각적 QA

제품과 동일한 QA React entry, inert AI context 및 실제 공문 컴포넌트를 Edge headless로 렌더링했다.

- 1440×900: 2열 균형, compact toolbar, 빈 문서 및 생성 문서 surface PASS
- 1366×768: 주요 toolbar와 입력 항목 잘림 없음
- 1100×720: 좁은 desktop 2열 유지
- 900×680: 가로 scroll 없이 single-column fallback
- 1920×1080: 작업실 최대 폭과 문서 줄 길이 유지
- 참고자료 관리 펼침, 로컬 초안 생성, 제목·본문·붙임·appendix 표시 확인

## 집 PC에서 이어 할 작업

1. 브랜치를 fast-forward로 동기화하고 이 문서와 체크포인트 SHA를 확인한다.
2. 집 PC의 정상 Rust/OpenSSL 환경에서 공문 QA EXE를 다시 빌드한다.
3. 새 QA EXE에서 1440×900, 1366×768, 1100×720, 900×680, 1920×1080 화면을 확인한다.
4. Tab, Shift+Tab, Enter, Escape와 focus 표시를 새 레이아웃에서 최종 수동 확인한다.
5. 참고자료 찾기·관리 접힘, 새 작업 초기화, 초안 생성과 복사 버튼을 네이티브 WebView2에서 확인한다.
6. 화면 검토 후 필요한 디자인 수정만 별도 커밋한다.
7. 이음오피스 참고 코드의 재사용 범위와 오픈소스 출처·라이선스를 별도 문서로 정리한다.
8. Phase 1B 실제 Google 읽기 전용 연결과 운영 배포는 별도 승인 전까지 진행하지 않는다.

## 릴리스 상태

이 체크포인트는 집 PC 인계를 위한 WIP 보존이다. PR, main 병합, 배포 또는 운영 릴리스 승인이 아니다.
