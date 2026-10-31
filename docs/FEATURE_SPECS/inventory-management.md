# Inventory Management

## 목적

공유 재고의 단일 원장을 제공하고 보건교사 DESK 관리자와 보건지원강사 웹 사용자의 권한을 분리한다.

## 확정 요구사항

- 보건교사: 등록·입고·폐기·정정·구매 연결을 관리하는 DESK 관리자
- 보건지원강사: 재고·유효기간 조회, 사용 기록 입력, 허용된 본인 이력 확인
- 보건지원강사에게 등록·삭제·입고·폐기 확정·재고 정정·구매 품의 권한을 부여하지 않음
- Purchase Helper의 구매 후보·입고와 재고 갱신 연결
- 공유 저장소가 재고의 단일 원장

## 현재 구현 범위

`feature/inventory-management@5e97478`에 IM-0/IM-1A 설계 문서 25개가 커밋돼 있다. 스냅샷 시점에는 IM-1B SQL, RLS, RPC, QA harness와 보고서 등 60개 untracked 항목이 있다.

구현 상태: `PARTIAL`. untracked 코드를 공식 통합 또는 완료 상태로 간주하지 않는다.

## QA 상태

`NOT VERIFIED`. 커밋된 `IM-1A-qa-contract.md`는 향후 검증 계약이며 실행 PASS가 아니다. untracked `IM-1B-*qa-results.md`와 SQL 결과는 보존돼 있으나 공식 commit/SHA에 고정되지 않았다.

## 아직 구현·확정하지 않은 범위

- 운영 Supabase 대상과 migration authority
- 최종 tenancy/RLS/RPC 승인
- Purchase Helper 입고 연결
- DESK 관리자 UI와 웹 사용자 UI
- 백업·복구·감사·동시성의 통합 QA

## 근거 및 연결 관계

- branch 문서: `docs/inventory-management/IM-0-*`, `IM-1A-*`
- untracked: `inventory-management/qa/**`, `docs/inventory-management/IM-1B-*`
- Decision Log의 `INV-001`~`INV-003`을 따른다.

## 위험 및 다음 작업

먼저 60개 untracked 자산의 소유권·민감정보·재현성·검증 결과를 감사해 안전한 checkpoint를 만든다. 운영 DB에는 적용하지 않고 로컬/합성 QA에서 계약을 고정한다.
