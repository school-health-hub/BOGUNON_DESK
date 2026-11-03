# Workspace Library

## 목적

공문·교육·구매·보건소식지 등 기능 결과물을 로컬 우선으로 정리하고 기능 간 전달과 최근 작업 재개를 지원한다.

## 확정 요구사항

- 기능별 결과물 정리
- 로컬 우선 저장
- 기능 간 자료 전달
- 최근 작업 이어하기
- 사용자 승인 기반 백업

## 현재 구현 범위

main의 `workspace-data/**`, `workspace-search/**`, 업무 폴더 연결은 부분 기반일 뿐, 확정된 Workspace Library 기능 전체는 아니다.

구현 상태: `PLANNED`.

## QA 상태

`NOT RUN`.

## 아직 구현하지 않은 범위

통합 artifact schema, provenance, recent session, 기능 간 handoff, 검색·filter, 삭제·보존, 백업·복원 UI와 migration 모두 미구현이다.

## 관련 브랜치와 연결 관계

전용 branch/worktree는 확인되지 않았다. Official Document, Purchase, Education Video, Newsletter, PDF Tools가 생산자이며 Library는 결과물 색인과 재개 경계를 제공한다.

## 위험 및 다음 작업

원본 파일 복제와 참조 링크를 구분하고 개인정보·학생자료·개인 재무의 저장 경계를 분리한다. 먼저 artifact ID, source feature/SHA, local path, created/updated, privacy class와 삭제 정책을 설계한다.
