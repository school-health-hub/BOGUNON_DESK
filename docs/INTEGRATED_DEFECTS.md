# BOGUNON DESK 2.0 통합 결함 목록

## 이식 완료 후 재검증

- **Purchase PDF 요약 행** — WIN-QA-04에서 `예상 합계: 23,500원`이 다섯 번째 품목으로 생성됨. Electron Rust CLI 경로 수정(`03e31e2`)과 회귀 테스트는 PASS이나 새 Windows GUI 실행본 재검증은 전략 전환으로 NOT RUN.
- **Newsletter 긴 제목 및 출력** — 긴 한글 제목의 A4 lead 겹침 수정(`ba23090`)은 구현·집중 테스트 완료. 정상/긴 제목 실제 출력, A4 PDF 1페이지, 카드뉴스 PDF 7페이지, 덮어쓰기 취소 보호는 부분 확인 또는 NOT RUN.
- **Newsletter 이미지 승인 정책** — approved 이미지 재연결·SHA 변경 감지와 pending 출력 차단은 실제 합성 manifest 부재로 BLOCKED.

반복적인 개별 Windows GUI QA와 추가 QA 자동화는 중단한다. 앱 실행 불가, 데이터 손상, 보안 위험을 제외한 결함은 핵심 Tauri 기능의 Electron 이식 완료 후 통합 처리한다.
