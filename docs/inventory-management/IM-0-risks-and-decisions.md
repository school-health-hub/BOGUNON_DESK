# IM-0 위험과 결정 기록

## 결정

1. 기준 브랜치는 검증된 원격 `main` SHA로 고정했다.
2. 실제 기술 계보에 맞춰 Firebase가 아닌 기존 Supabase Auth/Postgres 확장을 우선 권고한다.
3. 재고 변경은 서버 RPC가 최종 결정한다.
4. lot 잔량 캐시 + append-only movement 원장을 함께 사용한다.
5. 오프라인 변경은 IM-1 기본 범위에서 허용하지 않는다.
6. 구매 품의와 실제 입고를 분리한다.

## 주요 위험

| 위험 | 영향 | 대응 |
|---|---|---|
| 원본 xlsx Google 함수 손상 | 구매계획/품의 결과 오판 | 구조만 참고, 원본 Google Sheet 또는 운영 DB 대조 |
| 운영 최신본 미확인 | 잘못된 기준 수량 | 담당자 확인과 export timestamp/hash 승인 |
| BOGUNON user_id 소유 모델 | 학교 공유/강사 권한 불가 | school membership와 RLS 재설계 |
| 사용 원장 부재 | 현재고/감사 불완전 | movement+allocation 신규 도입 |
| 단위 혼합 | 과다/과소 차감 | base unit과 package conversion 명시 |
| 동시 차감 | 음수/중복 | DB 잠금·제약·멱등 RPC |
| Purchase Helper 세션 휘발 | 구매건 연결 유실 | Inventory가 purchase_link 상태를 영속화 |
| 실제 데이터 취급 | 개인정보/운영정보 노출 | 합성 QA, 비식별 문서, 승인된 마이그레이션 환경 |

## 미확인

- 제공 xlsx가 현재 운영 Google Sheet의 최신 export인지.
- 운영 BOGUNON에 물품 migration이 실제 적용됐는지와 실데이터 권위.
- 한 학교/여러 학교 지원 범위, 강사 이력 열람 범위, 보관 위치 필드 필요성.
- 유효기간 임박 기준 90일을 학교별 변경 가능하게 할지.
- 개봉 후 사용기한, 격리, 리콜 상태가 필요한지.
- Supabase 백업/PITR 요금제와 운영 책임자.

