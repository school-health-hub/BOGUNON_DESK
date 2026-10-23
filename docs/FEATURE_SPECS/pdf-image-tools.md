# PDF & Image Tools

## 목적

학교 업무 파일을 외부 업로드 없이 로컬에서 정리하는 작은 PDF·이미지 도구 모음을 제공한다.

## 확정 요구사항

- 다중 이미지에서 단일 PDF 생성
- 이미지 순서 변경, 회전, A4 설정
- 로컬 처리
- PDF 병합·분할 확장
- 이음오피스의 PDF 처리 엔진을 좁게 검토하고 Electron UI나 전체 앱은 복사하지 않음

## 현재 구현 범위

main에는 공문·Record Helper의 PDF 읽기/문서 가져오기 코드가 있으나 독립 PDF & Image Tools 기능은 없다.

구현 상태: `PLANNED`.

## QA 상태

`NOT RUN`.

## 아직 구현하지 않은 범위

독립 도구 UI, 순서·회전 모델, A4 출력, 병합·분할, 대용량·손상 파일 처리, 라이선스 검토 모두 미구현이다.

## 근거 및 연결 관계

- 기존 내부 처리: `src-tauri/src/record_helper_import/pdf.rs`, `official_document_import.rs`
- 외부 참고 엔진은 아직 저장소 근거와 승인된 provenance가 없다.
- Newsletter, Official Document, Workspace Library의 출력 흐름과 연결될 수 있다.

## 위험 및 다음 작업

이음오피스의 정확한 소스·라이선스·재사용 가능 범위를 먼저 확인한다. 파일 크기, 메모리, EXIF 회전, 암호화 PDF와 오류 복구 계약을 설계한 뒤 별도 worktree에서 시작한다.
