# Record Helper

## 목적

생기부 관련 자료를 가져오고 비식별·개인정보 검사를 거쳐 AI 검토와 결과 정리를 지원한다.

## 확정 요구사항

- 기존 생기부 도우미 흐름 보존
- 파일 가져오기와 보고서 단위 작업
- 개인정보·비식별 경계
- AI 전송 전 사용자 확인

## 현재 구현 범위

`origin/main@97f9ee9`에 `src/record-helper/**`, `RecordHelperPanel`, 세부 list/detail/workspace UI와 `src-tauri/src/record_helper_import/**`가 포함된다.

구현 상태: `IMPLEMENTED`, main 포함.

## QA 상태

`NOT VERIFIED`. 단위·component·Rust smoke 테스트가 존재하지만 현재 main SHA에 대한 독립 최신 Windows 수동 QA 문서는 확인되지 않았다.

## 아직 구현·확정하지 않은 범위

- 최신 통합 실기기 QA
- Workspace Library 결과 저장/재개 계약
- 공문작업실과 공통 import·privacy UI의 통합 여부

## 근거 및 연결 관계

`src/record-helper/**`, `src/components/desktop/RecordHelper*`, `src-tauri/src/record_helper_import/**`, tool/command/file-drop registries. Workspace Library와 AI 연결 경계를 공유한다.

## 위험 및 다음 작업

합성 개인정보 자료로 import·비식별·AI 승인·discard·clipboard 시나리오를 Windows 앱 표면에서 다시 검증하고 결과 SHA를 기록한다.
