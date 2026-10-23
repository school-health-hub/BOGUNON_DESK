# IM-1B-4 폐기 RPC

`inventory_dispose_stock`은 학교·품목·lot 복합 경계를 잠근 뒤 지정 lot에서만 차감한다. 만료·격리 lot도 폐기할 수 있고 초과 폐기는 거부한다. `DISPOSE` movement와 audit 및 멱등 응답은 잔량과 함께 원자적으로 확정한다.

