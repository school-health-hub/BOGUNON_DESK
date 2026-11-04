from PIL import Image,ImageDraw,ImageFont,ImageFilter
from pathlib import Path
root=Path('electron-p0/tests/fixtures/purchase-image-p2')
font='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
f=ImageFont.truetype(font,36,index=1)
im=Image.new('RGB',(1800,1100),'white');d=ImageDraw.Draw(im)
d.text((40,20),'합성 장바구니 · 개인정보 없는 검토용',font=f,fill='black')
for x,name,option,qty,original,unit,total in [(50,'합성 멸균 거즈','10매 포장 · 중형',2,15000,12000,24000),(950,'합성 니트릴 장갑','100매 포장 · 대형',3,10000,8000,24000)]:
 for i,t in enumerate([f'상품명: {name}',f'옵션: {option}',f'정가: {original:,}원',f'수량: {qty}',f'할인가: {unit:,}원',f'상품금액: {total:,}원']):d.text((x,160+i*95),t,font=f,fill='black')
for i,t in enumerate(['배송비: 3,000원','주문할인: 1,000원','주문총액: 50,000원']):d.text((50,820+i*80),t,font=f,fill='black')
im.save(root/'two-column-cart.png')
# Screenshot-like small text plus mild blur; no real shopping/site assets used.
small=Image.new('RGB',(900,650),'white');sd=ImageDraw.Draw(small);sf=ImageFont.truetype(font,22,index=1)
for i,t in enumerate(['상품명: 합성 알코올 솜','옵션: Small 100 PCS','수량: 3','단가: 2,500원','상품금액: 7,500원','배송비: 0원']):sd.text((32,40+i*85),t,font=sf,fill=(90,90,90))
small.filter(ImageFilter.GaussianBlur(.5)).save(root/'small-blurred-cart.png')
# Rotate clockwise; QA selects 270 degrees to restore it.
small.transpose(Image.Transpose.ROTATE_270).save(root/'rotated-cart.png')
im.crop((0,100,1800,800)).save(root/'overlap-cart.png')
tiny=Image.new('RGB',(900,650),'white');td=ImageDraw.Draw(tiny);tf=ImageFont.truetype(font,14,index=1)
for i,t in enumerate(['상품명: 합성 알코올 솜','옵션: Small 100 PCS','수량: 3','단가: 2,500원','상품금액: 7,500원','배송비: 0원']):td.text((32,40+i*70),t,font=tf,fill=(90,90,90))
tiny.save(root/'tiny-cart.png')
