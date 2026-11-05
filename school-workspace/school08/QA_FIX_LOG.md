# 자율 QA 기록

| 결함 | 수정 및 검증 | 실질적 시도 |
|---|---|---:|
| ThreadPool fixture 이름 concurrent가 모듈을 가림 | 함수 concurrent_replay로 분리, 실제 동시 설치 재실행 | 1 |
| alias05 동안 fixture SQL이 원래 컨테이너08을 참조 | 본인 alias 사용 중에만 executor 이름 전환, finally 복원 | 1 |
| S07 재고 `s.item` nullable TS18048 | optional access2곳, 새 strict/Main/Renderer/Web 재검증 | 1 |
| 원본 frozen foundation을 누적 설치 후 반복하면 부모 지문 불일치 | 누적 entry가 검증된 S08 장부가 있으면 부모 재실행을 건너뜀. 공개/차단도 S08 전체54 lifecycle로 명시적 관리 | 1 |
| 개인 Finance 검사2건 중 renderer boundary 파일 없음 | 실제 renderer build로 파일 생성 후 재검증, 실패를 지우거나 mock 파일로 대체하지 않음 | 1 |
| Finance 기대 리소스6 vs 기존 실제7 | S07 기준 동일 실패 확인, 범위 밖 Finance/builder 정책 수정 안 함 | 분리 |
| xlsx403, root13 | 원래 버전/정책 유지하고 기준과 비교 | 분리 |

S07 최종 보고의 strict PASS 표기와 달리 동일 SHA에서 TS18048이 재현됐다. 이를 기존 루트13개로 숨기거나 PASS를 승계하지 않고 S08에서 수정 후0임을 확인했다. 기존 Windows142c2d9 PASS는 무효화하지 않는다.

회귀 중 본인 격리 컨테이너의 합성 데이터만 reset/permission fixture로 변경했다. RLS 비활성화·서비스 역할 우회·운영 변경 없음. 같은 명령을 근거 없이 반복하지 않았으며 Source/설치제어/빌드 산출물이 바뀐 영향 범위만 재검증했다.
