# Newsletter Studio Design System

## 1. Direction

Newsletter Studio는 인쇄물의 신뢰감과 계절 보건소식지의 따뜻함을 함께 유지한다. 2026년 9월 레퍼런스의 구체적인 위계와 정보 밀도를 디자인 마스터로 삼되, 원본 삽화와 수달 캐릭터를 복제하지 않는다.

참고용 `skill.zip` 및 9월 보건소식지 자산은 구조·밀도 연구에만 사용한다. 출처와 사용권이 승인되지 않은 이미지나 수달 캐릭터는 제품·출력에 포함하지 않는다.

### Reference-derived geometry

- A4: 장식이 있는 상단 타이틀 밴드, 캐릭터 교체 슬롯, 학교명·월, 번호가 붙은 2×3 주제 모듈, 하단 안내 띠의 순서다. 모듈은 삽화 약 38~42%, 원고 약 58~62%를 사용한다.
- Cover: 상단 월 배지, 좌측 대형 제목·짧은 문구, 우측 대형 캐릭터/학생 장면, 하단 4개 핵심 주제 미리보기다. 6개 제목 상자를 표지 중심에 나열하지 않는다.
- Inner card: 녹색 라운드 테두리, 월 배지, 대형 제목·한 줄 lead, 좌측 대표 삽화, 우측 행동 수칙, 우하단 캐릭터 교체 슬롯, 하단 closing 띠다.
- Reference 이미지는 제품 번들에 복사하지 않으며 비교 캡처에서만 출처가 구분된 상태로 사용한다.

## 2. Output surfaces

- A4: 1240×1754 logical canvas, 2480×3508 PNG, 10mm(59 logical px) safe margin.
- Card: 1200×1200 logical canvas, 1800×1800 PNG.
- Card set: cover 1 + topic 6, exactly 7 pages.
- Preview, SVG, PNG, and PDF image input use the same Scene and z-order.
- Layout errors block export. Text is never silently reduced, clipped, deleted, or ellipsized.

## 3. Color tokens

| Token | Value | Use |
|---|---:|---|
| `--newsletter-paper` | `#fffaf0` | A4/card paper |
| `--newsletter-paper-deep` | `#f5ecdc` | secondary paper |
| `--newsletter-ink` | `#183b4e` | titles |
| `--newsletter-body` | `#29434e` | body copy |
| `--newsletter-muted` | `#60726f` | metadata |
| `--newsletter-line` | `#d8e2dc` | separators |
| `--newsletter-mint` | `#4f9178` | seasonal accent 1 |
| `--newsletter-apricot` | `#d98251` | seasonal accent 2 |
| `--newsletter-sky` | `#5f8fb9` | seasonal accent 3 |
| `--newsletter-lavender` | `#8a76ad` | seasonal accent 4 |
| `--newsletter-aqua` | `#4f9699` | seasonal accent 5 |
| `--newsletter-leaf` | `#6d8d67` | seasonal accent 6 |

Accent colors identify modules and cards; they do not replace readable navy body text.

## 4. Typography and spacing

- Family: Pretendard only for exported text.
- Display: 72–82 logical px, weight 800, line-height 1.12–1.2.
- Topic title: A4 28–30px, card 54–60px, weight 800.
- Body: A4 20–21px, card 29–32px, weight 500, line-height 1.42–1.5.
- Metadata/badge: 16–22px, weight 600–700.
- Korean uses word-first wrapping. One-character orphan lines and standalone short particles are blocking issues.
- Primary rhythm: 8 / 12 / 16 / 20 / 24 / 32 logical px.

## 5. Layout primitives

### A4 topic module

- 2 columns × 3 rows; six fixed modules.
- `balanced`: illustration 34%, copy 66%.
- `image-focus`: illustration 42%, copy 58%.
- `text-focus`: illustration 27%, copy 73%.
- Frames appear in order: title → optional lead → action list or paragraph → optional closing.
- Illustration and copy columns never overlap. Empty optional frames do not render.

### Card cover

- Month badge and title form the primary hierarchy.
- Neutral hero placeholder occupies the approved image frame.
- Six topic names form a 2×3 overview grid sourced from canonical topic titles.
- `topics-grid` is the default. `feature-right` and `feature-center` remain valid explicit variants.

### Topic card

- Month/newsletter badge, topic title, optional lead, illustration, source-derived actions or paragraph, optional closing.
- `balanced`, `image-focus`, and `text-focus` variants are expressed through the existing V2 frames and `imageTextColumnRatio`; no canonical copy is stored in the design sidecar.
- Marker styles are `source`, `number`, `dot`, and `check`. Markers are presentation only; action text remains source-derived.

### Topic illustration and mascot slots

- 여섯 주제에는 서로 다른 교육용 삽화를 제공하며 동일 나뭇잎 placeholder 반복은 최종 디자인에서 금지한다.
- 삽화는 공식기관의 건강정보를 확인한 뒤 AI로 새로 제작할 수 있지만, 원고에 없는 건강정보나 행동 수칙을 이미지 또는 텍스트로 임의 생성하지 않는다.
- AI 이미지 속 한글은 최소화하고 제목·본문·행동 수칙은 별도의 편집 가능한 텍스트 레이어로 조판한다.
- 수달쌤은 사용자가 제작한 기존 캐릭터의 외형과 스타일을 유지한다. 원본 비율과 `contain` 정책을 지키며 사용 승인 전에는 출력에 포함하지 않는다.

## 6. Asset provenance and official references

자산 원장은 `USER_CREATED`, `AI_GENERATED`, `OFFICIAL_REFERENCE`, `LICENSED_EXTERNAL`을 구분하고 `reference`와 `output` 목적을 별도로 기록한다. `OFFICIAL_REFERENCE`는 출력 자산이 될 수 없다. 출력에는 이용 승인이 명시된 자산만 허용한다.

공식기관 자료는 건강정보 확인을 위한 우선 참고자료다. 각 항목에 기관명·자료명·URL·확인일과 개별 이용조건을 기록한다. 원본 포스터·캐릭터·삽화를 그대로 재배포하지 않으며, AI 생성 삽화와 공식 참고자료를 동일 자산으로 취급하지 않는다.

| 자료명 | 기관 | URL | 확인일 | 사용 상태 |
|---|---|---|---|---|
| 호흡기감염병 예방을 위한 5대 예방수칙 | 질병관리청 | https://www.kdca.go.kr/bbs/kdca/42/309592/download.do | 2026-10-26 | `OFFICIAL_REFERENCE`; 원문 건강정보 검토용, 이미지 미포함 |
| 올바른 손씻기 수칙 관련 보도자료 | 질병관리청 | https://www.kdca.go.kr/bbs/kdca/41/215433/artclView.do | 2026-10-26 | `OFFICIAL_REFERENCE`; 페이지 표시 공공누리 출처표시 조건은 개별 이용 전 재확인 |
| 학생 마음건강 지원방안 | 교육부 | https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=105017&lev=0 | 2026-10-26 | `OFFICIAL_REFERENCE`; 내용 참고만, 이미지 미포함 |
| 공공누리 이용조건 안내 | 한국문화정보원 공공누리 | https://www.kogl.or.kr/recommend/recommendList.do?agcCode=03&agcName=03&atcUrl=agency | 2026-10-26 | 라이선스 판정 기준 |

공공누리 제2유형은 출처표시와 비상업 조건, 제3유형은 출처표시와 변경금지, 제4유형은 세 조건을 모두 적용한다. 기관 페이지의 라이선스 표시는 자산별로 다시 확인하고, 표시가 없거나 불명확하면 `pending`으로 유지한다.

## 7. Editor states

- V1 state: show impact explanation and an explicit “V2 디자인으로 전환” action. No automatic conversion.
- Upgrade review: show preserved revision count, canonical revision, affected page count, and Cancel/Confirm actions.
- V2 state: page selector, accent, layout variant, image/text ratio, marker style, and frame controls.
- Comparison state: baseline revision and current revision render side by side from their own Scene snapshots.
- Error state: identify page and overflowing/colliding layer, and block export without modifying content.
- Revision restore: restoring creates a new revision and keeps prior snapshots.

## 8. Accessibility and responsive QA

- Controls have visible labels, focus rings, and at least 40px hit areas.
- Status is conveyed by text as well as color.
- Desktop uses editor + preview columns; tablet stacks comparison previews; narrow QA windows stack editor above preview without horizontal clipping.
- Reduced motion removes nonessential transitions. No decorative animation is required.

## 9. Accepted debt

- Real approved illustrations and the 수달쌤 asset remain pending provenance and license approval.
- A4 1장과 표지 1장 + 주제 카드 6장(총 7장) 계약은 이미지 자산 교체와 무관하게 고정한다.
- Physical school-printer inspection remains a manual gate.
- V1 layouts with historical overlap are readable but export-blocked until the user explicitly upgrades or repairs them.
