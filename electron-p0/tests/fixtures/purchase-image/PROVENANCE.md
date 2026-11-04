# Synthetic cart fixtures

Created solely for IMAGE-IMPORT P1 on 2026-11-04. No real shopping cart, school record, student information or external image was used.

`synthetic-cart.png` is a white 1800×750 image with 44px Noto Sans CJK Regular Korean type (system font, not distributed). JPEG is the same image at quality 90. Rendered text, top to bottom:

합성 장바구니 검토 자료
상품명: 합성 멸균 거즈
옵션: 10매 포장
수량: 2
단가: 12,000원
상품금액: 24,000원
배송비: 3,000원
주문총액: 27,000원

The bundle is test input, not an accuracy benchmark for real shopping sites. It verifies Korean, numerals, comma-separated prices, option/quantity separation and exclusion of order-level totals. OCR remains review-only.

`synthetic-cart-english.png` uses the same font/method on a 1600×480 white canvas: 상품명: Alcohol Swab / 옵션: Small 100 PCS / 수량: 3 / 단가: 2,500원 / 상품금액: 7,500원. It checks mixed Korean/English recognition without an external service.
