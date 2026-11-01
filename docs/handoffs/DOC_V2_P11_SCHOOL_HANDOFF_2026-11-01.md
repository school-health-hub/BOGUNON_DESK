# DOC-V2-P11 학교 PC 인계 — 기본 home-v1 포함

## 이번 승인으로 달라진 사항

기존 f5666cf 기준 인계는 home-v1 비공개 원본의 별도 전달을 전제로 했다. 이후 사용자가 정확한 원본을 공개 저장소에 포함하도록 명시적으로 승인했다. 이 문서의 기본 서식 정책이 종전의 별도 전달 요구를 대체한다. 다른 비공개 파일·실제 공문·개인정보의 공개 허용으로 확장하지 않는다.

- 브랜치: `feature/official-document-enhancement` (main 병합/운영 배포 승인 없음).
- 기본 서식: `resources/templates/official-document/home-v1.odt`.
- SHA-256: `8BC0FD240B1BEA06758794D9F07A75ABF7FAF13BAC1FBDBCDD3556BE3FF6C285`.
- 기본 `K-에듀파인용 ODT 저장`: 내장 home-v1 사용 후 저장 위치만 선택.
- `다른 승인 서식 선택 후 저장`: 기존 원본 파일 선택 후 저장 위치 선택.
- 기존 승인 서식/변환기/북마크 및 스타일 계약은 유지된다. 취소·실패 시 원고는 유지된다.

## 검증 범위

기존 Rust24/계약6/제품4/작성59 PASS와 사용자 확인 K-에듀파인 성공은 반복하지 않는다. 새 검증은 내장 파일의 실제 SHA/구조, 변경 파일 차단, 기존 제품 함수를 통한 합성 원고 저장, 기본/수동 UI 분기만 대상으로 한다.

기존 수동 방식 실행본의 GUI 결과를 이번 내장 방식의 GUI PASS로 간주하지 않는다. 새 Actions 결과와 실제 캡처를 기준으로 판정한다. 최신 실행은 [공문 Windows QA workflow](https://github.com/school-health-hub/BOGUNON_DESK/actions/workflows/official-document-qa-windows.yml)에서 소스 SHA와 대조한다.

## 학교 PC 복원/실행 순서

1. 실제 학교 저장소/worktree 경로, 브랜치, HEAD, 미커밋·미추적 파일 및 다른 Codex 세션 확인. 집 PC 경로를 학교 PC 경로로 가정하지 않는다.
2. `git fetch origin` 후 원격 feature HEAD 확인. 로컬 변경이 없고 조상 관계가 확인된 해당 브랜치에서만 `git pull --ff-only origin feature/official-document-enhancement`. 충돌/로컬 전용 작업은 reset/clean/stash로 강제 해결하지 않는다.
3. `git rev-parse HEAD`, `git status --short`, `git rev-list --left-right --count HEAD...origin/feature/official-document-enhancement` 확인.
4. 위 서식 파일의 SHA 확인. 기본 저장에는 원본 파일을 별도로 전달할 필요가 없다.
5. 실행본은 해당 소스 SHA의 새 Windows Actions artifact에서 실제 다운로드하고 SHA256SUMS.txt와 비교한 후 사용한다. 과거 f5666cf 실행본에는 새 기본 서식 흐름이 없다. Artifact 존재만으로 학교 다운로드 완료라고 기록하지 않는다.
6. Windows WebView2 Runtime, C: 보호 하한 5GiB, QA identifier/data 격리 및 외부 연결 차단 조건을 확인한다. 운영 설치본은 교체/실행하지 않는다. 집·학교 E:는 서로 다른 저장소다.
7. 합성 원고만 사용한다. 실제 학교 환경에서 추가 확인이 필요하면 기본 저장의 저장 위치창·취소 후 원고 유지만 확인하고 결과를 통합 QA로 전달한다. GUI를 실제 실행하지 않으면 NOT RUN.

소스만 복원해도 빌드에 필요한 기본 서식이 포함된다. 소스가 곧 Windows 실행본은 아니므로 실행에는 해당 SHA의 빌드 산출물과 WebView2 Runtime이 별도로 필요하다. 기존 실제 문서/로그/인증정보는 업로드하지 않는다.
