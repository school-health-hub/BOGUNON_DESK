# IM-1B-PREP 환경 기준선

## 판정 범위

이 문서는 운영 준비도가 아니라 독립 로컬 QA 준비도를 기록한다. 운영 Supabase 프로젝트 `xxownwxxajzrviuvvfiu`는 접근 금지 식별자로만 사용했으며 연결·조회·변경하지 않았다.

## Git 기준선

- Worktree: `C:\Users\sehwa\Documents\GitHub\BOGUNON_DESK-inventory`
- Branch: `feature/inventory-management`
- HEAD: `5e9747851b278c65c5206d323e85343dba2cad4e`
- 기존 IM-1A 운영 검증 문서 5개: untracked 상태 그대로 보존
- 제품 코드 변경: 없음
- commit, push, PR: 없음

## 실행 환경

| 항목 | 확인 결과 |
|---|---|
| Docker Server | 29.8.0, 실행 가능 |
| Node.js | 22.23.3 |
| npm | 10.9.9 |
| Supabase CLI | 2.121.0, `npm exec`로 프로젝트 한정 실행 |
| npm 무결성 | 고정된 `dist.integrity`와 실행 전에 대조 |
| 전역 CLI/PATH 변경 | 없음 |
| 로컬 프로젝트 ID | `inventory_qa` |
| API / DB / Studio | 56321 / 56322 / 56323 |
| 보조 포트 | 56320, 56324–56327 |

기존 `bogunon` 로컬 스택은 5432x 포트와 기존 컨테이너 ID를 유지했다. 조사 도중 별도 5532x 스택도 관찰했으나 이를 중지·변경·정리하지 않았다.

## 확인된 제한

Supabase CLI는 Windows Docker에서 서비스를 `0.0.0.0`에 publish한다는 경고를 표시한다. 따라서 QA 스택은 검증 중에만 기동하고, 작업 후 중지하며, 신뢰할 수 없는 네트워크에서 기동하지 않는다. 이는 운영 배포 구성이 아니다.

