# Synthetic cart P2 fixtures

Created 2026-11-04 with Pillow and system Noto Sans CJK Regular. The font is not redistributed. All names/amounts are invented; no real school, user, shopping site screenshot or brand asset is used. `create-fixtures.py` records the exact drawing method.

- `two-column-cart.png`: 1800×1100, two independent product cards (합성 멸균 거즈 / 10매 중형 / quantity 2 / list 15000 / applied 12000 / amount 24000; 합성 니트릴 장갑 / 100매 대형 / quantity 3 / list 10000 / applied 8000 / amount 24000). Separate shipping 3000, order discount 1000 and order total 50000.
- `overlap-cart.png`: crop y=100..800 from the same fixture, retaining both products and no footer. It tests overlapping captures without deleting their rows.
- `small-blurred-cart.png`: 900×650, 22px gray text and Gaussian blur 0.5. 합성 알코올 솜 / Small 100 PCS / quantity 3 / unit 2500 / amount 7500 / shipping 0.
- `rotated-cart.png`: clockwise 90° rotation of the unblurred small fixture; the tested OCR correction is 270° clockwise. Original-coordinate evidence must remain within 650×900.

These controlled cases demonstrate supported paths, not real-site accuracy or guaranteed recovery of severely blurred text. Sparse mode sometimes misreads Korean labels in the two-column fixture; block mode plus word geometry is the validated path for that fixture.

`tiny-cart.png`: same invented product/amounts in 14px text at 900×650, gray (90,90,90), without blur. On the tested Cloud runtime the unit-price line was read as `단가: 2.5008`; it remains an empty unit price requiring manual correction. This is an observed unsupported recognition case, not an OCR accuracy PASS. The safety test verifies that an uncertain or inconsistent price cannot silently reach output.
