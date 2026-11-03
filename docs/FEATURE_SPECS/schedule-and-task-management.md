# 일정 및 업무 관리

## 목적

Dashboard에서 달력, 오늘 업무, D-Day, 급식, Inbox와 Quick Add를 제공하고 기존 BOGUNON 웹과 역할을 분담한다.

## 확정 요구사항

- 기존 위젯과 일정·업무 흐름 보존
- Desktop Surface에는 필요한 정보만 projection
- 기존 BOGUNON 웹앱의 연간 보건업무 캘린더를 DESK에 중복 구현하지 않음
- DESK는 문서 제작·파일 처리·전문 자동화에 집중

## 현재 구현 범위

`origin/main@97f9ee9`에 CalendarPanel, WeekAndNotifications, task/Inbox, Quick Add, workspace data/search, widget layout이 존재한다.

구현 상태: `INTEGRATED`.

## QA 상태

`PASS`는 v1 Dashboard/UI 문서가 다루는 기준 범위다. 최신 Surface projection은 `NOT VERIFIED`다.

## 아직 구현·확정하지 않은 범위

- Desktop Surface의 최종 projection 동기화
- 외부 BOGUNON 연동 실패·offline UX
- Workspace Library와 일정 결과물 연결

## 근거 및 연결 관계

`src/components/CalendarPanel.tsx`, `src/components/dashboard/**`, `src/workspace-data/**`, `src/workspace-search/**`, `src/dashboard/**`. Desktop Surface와 BOGUNON Web에 연결된다.

## 위험 및 다음 작업

웹 캘린더를 복제하지 않도록 source-of-truth를 명시하고, Surface에는 읽기 중심 최소 projection만 제공한다.
