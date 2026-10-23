# IM-1B-4A reversal 상태 정책

상태 이력이 없는 현재 스키마에서는 `depleted` 이전 상태를 추측하지 않는다. reversal은 수량만 복원하며, 복원 후 잔량이 양수인데 상태가 `depleted`이면 공통 응답의 `reactivation_required=true`를 반환한다. 만료·격리·사용불가 lot는 자동 가용화하지 않는다. 명시적 상태 변경 업무와 상태 이력은 후속 계약이다.

