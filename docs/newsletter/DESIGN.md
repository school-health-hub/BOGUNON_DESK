# Newsletter Studio Design System

## 1. Direction

Newsletter Studio는 인쇄물의 신뢰감과 계절 보건소식지의 따뜻함을 함께 유지한다. 2026년 9월 레퍼런스의 구체적인 위계와 정보 밀도를 디자인 마스터로 삼되, 원본 삽화와 수달 캐릭터를 복제하지 않는다.

참고용 `skill.zip` 및 9월 보건소식지 자산은 구조·밀도 연구에만 사용한다. 출처와 사용권이 승인되지 않은 이미지나 수달 캐릭터는 제품·출력에 포함하지 않는다.

### Reference-derived geometry

- A4: 장식이 있는 상단 타이틀 밴드, 캐릭터 교체 슬롯, 학교명·월, 번호가 붙은 2×3 주제 모듈, 하단 안내 띠의 순서다. 모듈은 삽화 약 38~42%, 원고 약 58~62%를 사용한다.
- Cover: 상단 월 배지, 좌측 대형 제목·짧은 문구, 우측 대형 캐릭터/학생 장면, 하단 4개 핵심 주제 미리보기다. 6개 제목 상자를 표지 중심에 나열하지 않는다.
- Inner card: 녹색 라운드 테두리, 월 배지, 대형 제목·한 줄 lead, 좌측 대표 삽화, 우측 행동 수칙, 우하단 캐릭터 교체 슬롯, 하단 closing 띠다.
- Reference 이미지는 제품 번들에 복사하지 않으며 비교 캡처에서만 출처가 구분된 상태로 사용한다.

### September structure restoration

- Template version 2 restores the September hierarchy as live Scene layers rather than a pasted reference image.
- A4 reserves independent slots for the header mascot and seasonal decoration, then renders six numbered topic modules and separate utility/closing strips.
- The cover keeps all six canonical topics but previews exactly four. The mascot, seasonal decoration, and supporting illustration are separate replaceable layers.
- Each topic card has a topic illustration slot and a distinct lower-right mascot slot. Missing assets render an explicit role-specific `QA PLACEHOLDER` instead of silently repeating one botanical image.
- Reference files remain outside the bundle. A layout match never changes an asset from reference-only to output-approved.

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

### Asset registry contract

- Registry records use a stable asset ID, SHA-256, origin, classification, purpose, approval status, usage scope, safe `asset:<sha256>` reference, media type, original file name, and contiguous change history.
- Classifications are `USER_CREATED`, `AI_GENERATED`, `OFFICIAL_REFERENCE`, and `LICENSED_EXTERNAL`.
- Purposes are `mascot`, `illustration`, `decoration`, and `reference`.
- `OFFICIAL_REFERENCE` and `reference`-purpose records can never be promoted into the output manifest.
- Only a file-level `approved` record with `newsletter-output` scope is converted into a DesignState asset manifest entry.
- Registration records provenance; it does not copy or bundle the original file.

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

- Topic illustrations remain pending separate production and approval. The user-approved 수달쌤 기본형 v1 is bundled only for Newsletter rendering; print/export approval remains pending actual output review.
- A4 1장과 표지 1장 + 주제 카드 6장(총 7장) 계약은 이미지 자산 교체와 무관하게 고정한다.
- Physical school-printer inspection remains a manual gate.
- V1 layouts with historical overlap are readable but export-blocked until the user explicitly upgrades or repairs them.

## NS-3E-3B-6 approved mascot

- `otter-primary-v1`: USER_CREATED / mascot, 1254×1254 RGBA; SHA-256 `fd90b63e8d78ee53eb796c130315ac71d4c5a2a8b4af92e8e03cefdccc3ce302`.
- The approved binary is bundled once and explicitly attached to eight existing independent mascot frames (A4, cover, six topic cards) with `contain`. Existing V1/V2 files are not silently changed.
- `approvalStatus: approved` authorizes design/product rendering. Optional `exportApproval: pending` separately blocks publication output. Legacy records without this field preserve their existing behavior.
- Explicit QA output verifies the same approval, reference, and binary SHA as Preview, bypasses only the pending output review, and marks its manifest `reviewOnly`. Native publication saving rejects review-only bundles.
- Preview and SVG output share `resolveDesignAssets`; PDF embeds the generated PNG pages. Missing or rejected assets are blocked rather than substituted. Unassigned topic illustrations retain QA placeholders.
- Enlargement warnings use the contained image size at the actual output scale; upsampling does not create new detail. Physical printer approval remains separate.

## NS-3E-3B WIP checkpoint (2026-10-29)

- Implementation is preserved as WIP, not final design or print approval. One approved PNG is reused by eight mascot frames; A4 1 page and cards 7 pages remain unchanged.
- Existing validation records: Vitest 208 files / 1,297 tests PASS (`npm test -- --maxWorkers=2 --testTimeout=30000`), `npx tsc --noEmit` PASS, and `npm run build` PASS. These checks were not unnecessarily rerun for this checkpoint.
- Native validation is **BLOCKED**: `cargo test --manifest-path src-tauri/Cargo.toml newsletter -j 2` failed in the `openssl-sys v0.9.117` custom build (`expando.c`, exit 101), before Newsletter Native tests executed. Root cause is unconfirmed; no Native dependency change is included.
- Final newsletter design remains incomplete: seasonal QA placeholders overlap the topic heading region, and the cover retains its separate illustration placeholder behind the mascot. Actual print/export approval remains `pending`.
- QA evidence, raw build logs, and September masters remain outside Git. This checkpoint preserves code and the explicitly approved mascot only; it is not a complete cross-PC evidence handoff.
- NS-3E-3C preparation: six topic illustrations, with selectable female students, male students, mixed students, or props/actions without students. Female/male base characters may be managed as separate reusable assets. Official health information informs the content; illustrations will be newly generated AI assets. No student illustration generation or selection UI is implemented in this checkpoint.
- Security review: no dedicated secret scanner was available; staged text received best-effort credential/identifier scans and manual review, and the approved PNG was visually reviewed. No secret or personal data was found; this does not replace a dedicated scanner.

## NS-3E-3D editorial card system
November user reference images define composition only and are never output layers. Existing September cream/navy/green brand remains. V2 documents gain an optional editorial setting: absent means the existing rendering, TYPE A cover uses a central student scene and four topic previews; TYPE B maps exactly four canonical actions to a 2×2 grid; TYPE C combines a main scene with four secondary modules; TYPE D maps four actions to service rows. Layout selection creates a design revision. The editor exposes available approved illustration references, student composition, season, accent, image fit/size, and mascot position/size. Missing source actions are explained before selecting an incompatible layout. Canonical section edits use the existing applyUserEdit history; project/topic titles remain current top-level metadata, with no claim that section-only historical snapshots restore title metadata. No new rendering engine, no reference-image bundle, no automatic health copy, no new dependencies.

The shared editor now exposes the existing four output selections through `generateNewsletterOutputs`, `BrowserSvgRasterizer`, `PdfLibImageComposer`, and the existing Native picker/save adapter. Publication approval gates are retained; there is no QA bypass in the UI. Save collision policy is `deny`. Browsers show the Native-unavailable error without starting rasterization. The explicit A4 editorial preset creates a design revision. Module illustration sizes are adjusted within a bounded 50–120% range; invalid Scene bounds still block output. Host persistence remains the existing host's responsibility through the optional editor onChange callback; no new storage contract is introduced.

## Optional September master composition

The explicit `9월 스킬 기본형` editor action applies the reusable master to A4 (all six topics), the cover, and the selected topic card. The five other topic card layouts and Scenes remain unchanged. It does not apply automatically. The underlying optional V2 `compositionPreset: september-master` preserves documents without the field; A/B/C/D and legacy selections leave the master route. Every application is recorded in design revision history.

The cover uses a large live month/title, theme lead, central student illustration, integrated approved mascot, four lower topic previews, season decoration and closing. The default body uses the green issue pill, large navy headline, lead, left main illustration, four right action rows with circular markers, lower-right mascot, and bottom closing. Canonical actions, topic titles and editable design copy remain text Scene layers. Existing A/B/C/D remain available as extensions.

Images support optional `edgePolicy`: absent or `rounded` retains the legacy 12-unit clip; `none` preserves transparent organic artwork without a hard mat; `soft` blends existing A4 artwork with a luminance mask. The same policy and Scene geometry are used by React SVG Preview and export SVG; PNG and PDF continue through the existing rasterizer/composer. Original source image bytes, asset SHA approval and output approval gates are unchanged. No image generation provider, backend or new output engine is introduced.

Representative visual review and physical printer approval remain separate from implementation and unit validation. Generated illustration derivatives require ordinary asset registration, SHA verification and explicit publication approval.

## Illustrated A/B revision (cards only)

The explicit illustrated A/B preset creates a cover TYPE A and selected body TYPE B revision while preserving A4 and the five other body Scene snapshots. Its optional `illustrated-ab` composition leaves the September master and existing A/B/C/D behavior available. The body has one organic main student scene and four protected action regions in a two-by-two arrangement; each canonical rule has a large, filled educational mini-scene (for example soap and hands, steaming cookware, drinking water, clinic). Soft organic color fields connect the scenes without dashboard borders. All action, title, lead and closing copy remain live text. The cover places central students and the approved otter on one seasonal campus field with four illustrated topic previews. Images retain their original asset bytes and approval policy.
