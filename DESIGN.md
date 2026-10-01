# BOGUNON DESK Integrated Work Desk 디자인 시스템

## 1. Product identity

- BOGUNON DESK는 보건교사가 출근 후 하루 종일 켜 두고 자신의 업무 방식에 맞게 구성하는 Windows 데스크톱 작업 공간이다.
- 핵심은 고정된 정보를 보여주는 웹 대시보드가 아니라 필요한 업무 영역을 선택하고 이동·크기 조절하여 개인화하는 데스크 경험이다.
- TeacherDesk에서는 화면 위에서 직접 꾸미는 customization UX와 Dock 개념을 참고하되, 시각 디자인이나 교과교사 기능을 복제하지 않는다.
- BOGUNON과는 Pretendard, muted mint/navy, 차분한 실무 톤, compact Korean typography를 공유한다. 카드 구조, 정보 계층, spacing, 배치는 BOGUNON DESK가 독립적으로 결정한다.
- 마케팅 페이지, 모바일 앱을 늘린 듯한 화면, Windows Gadget식 장식, 모든 정보를 동일한 정보 계층으로 묶는 구성을 피한다. View mode에서도 각 위젯은 사용자가 놓고 쓰는 독립된 데스크 객체로 읽혀야 한다.

## 2. Experience priorities

디자인 판단이 충돌할 때 다음 순서를 따른다.

1. BOGUNON DESK 고유의 Desktop Workspace UX
2. TeacherDesk의 화면 꾸미기·위젯 배치·개인화 경험
3. BOGUNON과의 브랜드 연결성
4. 이전 고정형 Dashboard 스타일과 기존 세부 규칙

View mode는 조용한 업무 화면이어야 하고, Edit mode는 현재 화면의 맥락을 유지한 채 구조를 직접 편집하는 도구여야 한다. 별도 설정 페이지로 이동시키지 않는다.

시각 계층은 `desktop canvas → independent widget objects → live work data`로 읽혀야 한다. canvas의 의도적인 여백이 배치 가능성을 드러내고, View mode에서도 각 widget boundary를 낮은 대비로 유지한다. 민트는 배경 재료가 아니라 상호작용과 선택 상태의 accent다.

## 3. View mode / Edit mode

### View mode

- 위젯 drag, resize, 숨기기, 설정 chrome을 렌더링하지 않는다.
- 상단 행동은 canvas 위의 낮고 차분한 compact control로 제공한다. 독립적인 floating pill이나 강한 shadow를 사용하지 않는다.
- 업무 콘텐츠가 먼저 읽혀야 하며 편집 기능은 발견 가능하되 시각적 주인공이 되지 않는다.
- 위젯 외곽은 약 12px radius, 낮은 대비의 blue-gray border, 절제된 shadow로 독립성을 전달한다. canvas가 보이는 gutter와 intentional gap을 유지한다.
- 사용자가 저장한 배치, 크기, 표시 여부, appearance, Dock 순서를 그대로 복원한다.
- 기본 desk 배치는 서로 다른 가로·세로 비율을 사용하며, 달력도 여러 위젯 중 하나로 취급한다. x=5 부근의 여백처럼 일부 빈 grid 영역을 의도적으로 남겨 solid dashboard table로 보이지 않게 한다.
- workspace 상태 안내와 비어 있는 상태는 별도 card를 만들지 않는다. 일반 안내는 muted inline state로, 오류와 명시적 사용자 조치가 필요한 상태만 의미 있는 강조를 유지한다.

### Edit mode

- 현재 화면 위에서 drag, resize, 위젯 추가·숨김, 프리셋, appearance, Dock 편집을 제공한다.
- `위젯 → 배치 → 스타일 → Dock → 초기화 → 완료` 순서의 compact desktop editor palette를 canvas의 의도적인 빈 영역에 띄운다. 활성 도구는 민트 tonal state와 label로 구분하고, `완료`는 항상 같은 위치에서 발견할 수 있어야 한다.
- 네 편집 도구는 동일한 floating palette 문법을 사용한다. viewport 우측을 가득 채우는 settings drawer가 아니라 desktop 일부를 남기는 compact inspector로 뜨며, 현재 desktop과 선택된 widget을 계속 보이게 한다.
- 상단 안내는 toolbar 밖의 `끌어서 이동 · 모서리에서 크기 변경`처럼 짧은 micro hint로 제한한다.
- 편집 상태는 workspace의 얇은 mint inset line, 낮은 대비의 grid guide, widget chrome으로 구분한다. 큰 배너, 강한 색 면, 개발 도구처럼 보이는 점선 테두리는 사용하지 않는다.
- View mode의 독립 widget boundary 위에 Edit mode의 선택 outline과 조작 chrome을 더해 drag와 resize 대상을 식별할 수 있어야 한다.
- 위젯 panel은 category와 사용 여부, 배치 panel은 arrangement preview와 현재 preset, 스타일 panel은 배경·위젯 스타일·모서리의 live preview, Dock panel은 순서와 표시 여부를 짧고 직접적으로 보여준다.
- 수동 이동·크기 조절·표시 변경 뒤에는 preset 선택 상태를 주장하지 않는다. 기존 optional `presetId`를 비워 custom layout으로 표현하며 persistence schema는 늘리지 않는다.
- 초기화 확인은 현재 데스크 배치만 기본 데스크형으로 되돌리고 계정 설정과 업무 데이터는 유지된다는 경계를 명시한다.
- 편집을 마치면 같은 위치의 View mode로 돌아가며 업무 상태는 유지한다.

## 4. Widget behavior

- 모든 위젯은 typed registry의 제목, 설명, category, component, default/min/max size를 사용한다.
- 위젯은 12-column grid에 snap되고 서로 겹치지 않는다. 픽셀 단위 자유 배치는 허용하지 않는다.
- singleton 위젯은 중복 추가할 수 없다. 숨기기는 `visible=false`로 처리하며 복원해도 checklist와 memo의 세션 상태를 잃지 않는다.
- 위젯 크기 변경 시 container query와 내부 overflow를 사용한다. 작은 크기에서 중요한 정보가 잘리면 minimum size를 우선 강화한다.
- 날짜·시간, 달력의 오늘, 주간 오늘, 주요 일정 상태, D-Day는 하나의 local date source를 사용한다. mock 일정 날짜와 오늘 기준을 혼합하지 않는다.

## 5. Desktop canvas, widget surface, and chrome rules

### D.2 transparent neutral glass

- Windows main window는 system decorations와 opaque WebView hit target을 유지한다. 실제 투명 WebView는 빈 영역 입력이 뒤쪽 창으로 전달되는 회귀가 있어 사용하지 않으며, `html`, `body`, app root는 매우 옅은 neutral fallback canvas를 그린다.
- desktop click-through는 이 재료 시스템의 일부가 아니다. 빈 영역도 계속 BOGUNON DESK window가 소유하며 drag, resize, focus, tray restore 계약을 바꾸지 않는다.
- 기본 widget material은 white glass다: `rgba(255,255,255,0.84)` 수준의 fill, 30px blur, 150% saturation, white/cool 1px rim, contact shadow와 넓은 low-opacity floating shadow를 조합한다.
- Soft corner는 20px, Compact corner는 14px을 기준으로 한다. 민트는 selected state, active indicator, icon과 D-Day 같은 작은 semantic emphasis에만 사용한다.
- widget title은 14px/600, primary content는 13px 이상, secondary content와 empty state는 12px 이상을 기본으로 한다. 10px은 device tag와 Dock tooltip 같은 genuine micro-label에만 허용한다.
- monthly calendar는 neutral glass parent 안에서 cell fill을 제거하고 divider만 낮은 대비로 유지한다. 현재 날짜와 event chip만 pastel accent를 사용한다.

### D.3 floating desktop glass polish

- 안전한 opaque window는 유지하되 desktop backdrop은 `#f4f8f8` 계열의 near-white base와 3–7% 수준의 cool mint·gray-blue·lavender ambient light만 사용한다. backdrop은 glass 깊이를 드러내는 역할이며 독립적인 색 blob이나 teal wash가 되어서는 안 된다.
- 대형 work sheet는 약 0.76–0.82, 작은 information object는 약 0.82–0.86의 white glass를 사용한다. 공통 blur는 32px, saturation은 145%, rim은 white/cool alpha 0.58–0.66을 기준으로 한다.
- desktop object separation은 1440px 기준 outer inset 18px, inter-widget gap 14px을 기본으로 한다. Dock reserve를 포함한 10-row desk는 1440×900 viewport 안에 맞아야 하며, content를 숨겨 scrollbar를 제거하지 않는다.
- widget title은 14–15px, normal status/body는 12.5–13px, calendar weekday/date는 12.5px, calendar event는 12px을 기본으로 한다. Dock tooltip과 genuine device metadata는 기존 micro scale을 유지한다.
- floating Quick Memo panel은 `rgba(255, 250, 225, 0.9)`에 가까운 warm paper material, warm rim, neutral floating shadow를 사용한다. session-only 상태와 action contract는 바꾸지 않는다.

- View mode에서 widget chrome은 DOM과 화면 모두에서 사라진다.
- View mode workspace는 배경 ID가 드러나는 desktop canvas다. 전체 grid를 감싸는 통합 surface, outer border, outer shadow를 만들지 않는다.
- View mode의 widget wrapper가 개별 surface를 소유하되 모든 위젯에 같은 흰색 카드 문법을 반복하지 않는다. 정보형은 `information glass`, 일정·업무형은 `work sheet`, 메모는 `personal object` 재질을 사용한다.
- 기본 surface는 밝은 반투명 fill, cool border, 상단 edge highlight, 낮은 layered shadow, 12~18px backdrop blur를 조합한 하나의 glass recipe를 공유한다. backdrop-filter를 지원하지 않는 환경에서도 밝은 translucent fill과 border만으로 읽을 수 있어야 한다.
- Information glass는 가장 가볍고 투명한 톤, Work glass/sheet는 본문 가독성을 위해 한 단계 높은 opacity, Personal object는 warm paper tint와 작은 재질 차이로 구분한다. 이 분류는 CSS presentation이며 persistence ID를 추가하지 않는다.
- signed-out/empty widget도 크기를 축소하거나 없애지 않는다. 대신 더 조용한 glass fill과 상단 정렬 inline notice를 사용해 비어 있는 흰 상자가 아니라 잠시 쉬고 있는 desktop object로 보이게 한다.
- Section heading은 작은 icon, 짧은 heading height, 일정한 baseline을 사용한다. icon box는 View mode에서 제거하고 제목과 콘텐츠 사이 간격을 줄인다.
- 월간 일정은 다른 widget과 같은 surface 규칙을 사용한다. Calendar cell boundary는 읽기 쉽게 유지하되 크기나 elevation으로 desktop 전체의 정체성을 독점하지 않는다.
- Edit mode chrome은 작은 overlay drag handle, 설정, 숨기기, resize handle로 구성한다. 위젯 내부에 이미 표시되는 제목을 편집 chrome에서 반복하지 않는다.
- drag는 전용 handle에서만 시작한다. button, input, textarea, select, link, resize handle은 drag cancel 영역이다.
- 설정 버튼은 실제 registry 기반 상세 정보를 제공한다. 동작하지 않는 gear icon은 노출하지 않는다.
- chrome은 콘텐츠 위에 떠 있는 compact control cluster로 처리해 콘텐츠 높이와 layout 계산을 바꾸지 않는다. 설정·숨기기 action은 widget hover, 선택 또는 focus-within에서만 선명하게 드러난다.
- 위젯 내부에서 card-in-card를 반복하지 않는다. 정보 그룹은 divider와 spacing으로 구분하며, signed-out/empty 상태는 상단에 조용한 inline 안내로 배치한다.

## 6. Drag / resize UX

- Desktop Edit mode에서만 drag와 resize를 활성화한다.
- 이동 중 placeholder는 낮은 채도의 mint outline과 면으로 표시한다. drag 중인 실제 widget에는 한 단계 높은 shadow를 적용한다.
- 선택된 widget은 solid mint outline으로 표시하고, focus-within에서도 같은 상태를 제공한다.
- resize handle은 우측 하단에 명확한 hit area를 가지며 Dock과 겹치는 경우에도 스크롤하여 접근할 수 있도록 canvas 하단 여백을 유지한다.
- grid compaction은 충돌을 방지하되 사용자의 의도와 다른 과도한 재배치를 만들지 않는다.
- 900px 미만의 compact layout에서는 안전성을 위해 drag/resize를 비활성화하고 세로 스크롤형 위젯 목록으로 전환한다.

## 7. Appearance customization

- Background: Cool Blue, White, Warm Gray, Mint, Lavender. 기본값은 Cool Blue다. 저장 데이터 호환을 위해 내부 ID `blue-gray`는 유지한다.
- Cool Blue는 좌측 상단의 밝은 cyan light, 우측 하단의 muted teal depth, `#DDEFF1 → #C8E0E4 → #B7D5DA`의 restrained diagonal gradient를 겹친다. widget 뒤에서 색 변화가 느껴질 만큼 깊이를 주되 dark UI나 wallpaper처럼 보이지 않게 한다. 다른 배경도 동일한 tonal-depth 원칙을 유지한다.
- Card style: Default, Soft, Flat.
- Corner: Compact, Soft.
- appearance 변경은 Edit mode에서 즉시 preview하고 layout과 함께 localStorage에 저장한다.
- 위젯마다 개별 테마나 강한 카테고리 색을 부여하지 않는다. 카테고리 색은 일정 label과 상태 구분에만 사용한다.
- Default는 translucent white surface, low-contrast border, minimal shadow를 사용한다. Soft는 더 부드러운 surface와 한 단계 분명한 low-elevation shadow를 사용한다. Flat은 shadow 없이 border와 tonal separation만 사용한다. 세 style ID와 저장 형식은 그대로 유지한다.
- quick-memo는 warm paper tint, weather는 cool tint, today-summary는 얇은 mint accent를 허용한다. D-Day는 숫자 계층을 강화하고 calendar/tasks/schedule은 neutral surface를 유지한다.

## 8. Dock behavior

- Dock은 화면 하단 중앙의 독립적인 launcher shelf다. workspace 경계나 dashboard footer에 붙이지 않고 canvas 위에 낮게 띄운다.
- View mode에서는 실행 항목만, Edit mode에서는 순서 변경과 표시·숨김 설정을 제공한다.
- Dock은 업무 콘텐츠나 resize handle을 영구적으로 가리지 않도록 canvas 하단 안전 여백을 확보한다.
- 실제 Dock 항목은 icon-first로 구성하고 영구 label을 표시하지 않는다. 항목 이름은 hover와 keyboard focus에서 icon 위 compact tooltip으로 제공하며 `aria-label`, 명확한 focus ring, 논리적인 tab order를 유지한다.
- Dock은 약 56px 높이, 28px icon, 42px hit target, 6px gap, 9px horizontal padding, 16px outer radius의 compact glass launcher shelf를 기준으로 한다. 내용 너비만 차지하고 viewport 가장자리와 canvas 사이에 여백을 남긴다.
- 각 Dock icon은 BOGUNON의 mint, cool blue, lavender, blue-gray 범위에서 낮은 채도의 작은 translucent tile을 가질 수 있다. tile은 launcher 식별성을 높이되 active pill 역할을 대신하지 않으며, 선택 상태는 계속 3px accent dot이 담당한다.
- active 상태는 큰 pill 대신 icon 아래 3px accent dot으로 표시한다. hover는 현재 icon에 최대 1.14 scale과 작은 상향 이동만 적용하고 `prefers-reduced-motion`에서는 제거한다.
- 데스크톱 업무판은 사용 가능한 viewport 높이를 채우되, grid 좌표는 viewport fill 계산과 독립적으로 유지한다. 낮은 높이에서는 콘텐츠를 압축하지 않고 기존 scroll fallback을 사용한다.
- Dock item은 action ID만 참조하며 URL, 로컬 폴더, 내부 이동 같은 실행 세부사항은 Desktop action registry가 소유한다.
- 외부 URL과 로컬 경로는 등록된 action만 Tauri 계층에서 실행하며, 설정되지 않은 action은 실행하지 않고 안전한 안내를 표시한다.
- Dock은 홈, 온라인 보건실, BOGUNON, 업무 도구, 업무 폴더, 빠른 메모, 설정 같은 top-level quick launcher만 기본 제공한다. AED·생기부·검진 같은 세부 도구는 업무 도구 런처 안에서 찾는다.

## 8.1 Menu and navigation structure

- Toolbox는 실제 실행 가능한 보건 업무 도구만 category registry에 따라 보여주는 health work launcher다. 작동하지 않는 placeholder는 표시하지 않는다.
- Settings Center는 계정, 화면, 연결, AI, 이 PC의 다섯 영역을 compact navigation으로 구분한다. 앱 전체를 차지하는 상시 sidebar로 확장하지 않는다.
- 화면 꾸미기, 프리셋, 화면 스타일, Dock 편집은 Settings Center 안에 복제하지 않는다. 진입점을 선택하면 센터를 닫고 현재 workspace의 Edit mode에서 직접 조작한다.
- 외부 launcher는 실행 순간의 행동이며 Dock에 지속 active 상태를 남기지 않는다. Toolbox와 Settings Center처럼 열린 내부 panel만 해당 launcher를 active로 표시한다.
- 480px 이하의 매우 좁은 창에서도 Dock은 icon-first와 42px hit target을 유지하고 tooltip의 세로 노출을 가리지 않는다. Settings Center와 Toolbox는 Dock 높이만큼 하단 안전 여백을 확보한다.
- TeacherDesk 2는 independent widget desktop, varied proportions, intentional negative space, launcher shelf 문법을 참고하되 브랜드 자산과 교과교사 기능은 복제하지 않는다. BOGUNON DESK의 Cool Blue canvas, muted navy, mint accent를 유지한다.

## 9. Typography and color primitives

- 글꼴 stack: `Pretendard`, `Noto Sans KR`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`.
- 크기 토큰: 11 / 12 / 13 / 14 / 16 / 18 / 22 / 26px.
- 카드·위젯 제목 600, 일반 본문 400, 중요 본문 500을 사용한다. 700은 현재 시간과 페이지 수준 강조에만 제한한다.
- 숫자와 시간에는 `font-variant-numeric: tabular-nums`, 한국어 문장에는 `word-break: keep-all`을 적용한다.
- Desk 전용 기본 palette는 App fallback `#DCE9ED`, Cool Blue canvas `#DDEFF1 → #C8E0E4 → #B7D5DA`, Workspace surface `#F7F8F8`, Widget surface `#FFFFFF`, Primary text `#243247`, Secondary text `#596675`, Muted text `#87919D`, Accent mint `#39A999`, Accent hover `#2D8F83`, Accent soft `#E7F5F2`, Border `#DCE3E6`, Divider `#E9EEF0`이다.
- CSS에서는 `--desk-bg`, `--workspace-bg`, `--widget-bg`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-hover`, `--accent-soft`, `--border`, `--divider`, `--shadow-widget`, `--shadow-floating`을 canonical token으로 사용한다. 이전 변수명은 호환 alias로만 유지한다.
- View mode surface recipe는 기본 `--widget-surface-*` 외에 `--desktop-information-*`, `--desktop-work-sheet-*`, `--desktop-personal-object-*`, `--desktop-palette-bg`, `--desktop-glass-*`, `--desktop-dock-*` 토큰을 사용한다. Soft와 Flat은 같은 저장 ID를 유지한 채 CSS 재질만 구분한다.
- C.2 glass recipe의 canonical primitives는 `--desktop-glass-bg`, `--desktop-glass-border`, `--desktop-glass-highlight`, `--desktop-glass-shadow`, `--desktop-glass-blur`다. widget family, palette, Dock은 이 recipe를 기반으로 opacity와 tint만 조정하며 임의의 opaque white surface를 추가하지 않는다.
- 11~12px의 설명·category text처럼 작은 보조 문구는 `--text-subtle-readable: #64717F`를 사용해 흰색 및 Cool Blue surface에서 WCAG AA 대비를 확보한다. 장식적이거나 비활성 상태인 텍스트에만 더 옅은 `--text-muted`를 유지한다.
- Widget 기본 radius는 12px이며 Soft corner도 16px을 넘지 않는다. Desktop 생산성 UI의 조밀함을 해치지 않는 범위에서만 radius를 키운다.
- 순수 검정, 과도하게 진한 navy, 강한 gradient, 두꺼운 shadow를 피한다.
- 구매결과 표의 고정 폭은 `--settlement-*-column-width`와 `--settlement-table-min-width` 토큰으로 관리하고, typography·spacing·radius는 공통 `--text-*`, `--space-*`, `--radius-*` 토큰을 사용한다.
- 일정 category는 교육 `#e8edff/#4d63ad`, 검진 `#dff4ee/#16856f`, 행사 `#fff1dc/#a86618`, 보고 `#f1e9fb/#72519c`를 사용한다.

## 10. Workspace layout and responsive rules

- 기준 화면은 1440×900 Windows 앱이며 12-column desktop grid를 사용한다.
- Edit toolbar는 document flow가 아니라 canvas 위 overlay로 띄워 위젯 배치를 밀지 않는다.
- View mode와 Edit mode는 8~10px grid gutter를 유지해 canvas가 카드 사이로 보이게 한다. 모든 위젯에 동일한 내부 구조나 visual weight를 강요하지 않는다.
- 데스크톱 View mode의 widget surface는 약 12px radius를 기준으로 하며 일반 control은 4~8px radius를 사용한다. pill은 상태나 선택처럼 의미가 있을 때만 사용한다.
- 기본 상단 행은 독립된 시계, 날씨, 오늘 요약 위젯으로 구성한다. 좁은 widget 폭에서도 브랜드와 날짜를 임의 ellipsis로 숨기지 않는다.
- 날씨와 급식은 context 정보로서 calendar와 업무 목록보다 낮은 heading weight와 더 조밀한 행간을 사용한다. 연결 안내 같은 empty state도 큰 내부 card를 만들지 않는다.
- 월간 일정의 event는 single-line을 유지하되 cell과 chip의 수평 padding을 절제해 업무 제목에 가능한 폭을 우선 배분한다.
- View mode Dock은 큰 active pill 없이 작은 accent dot만 사용해 canvas 위의 launcher shelf로 표현한다.
- 1440×900과 1280×800에서는 Dock safe inset을 제외한 한 viewport에 기본형 위젯을 배치하고 page-level scroll을 만들지 않는다.
- 폭 820px 이하 또는 높이 680px 이하의 작은 창에서만 사용성을 위해 제한적인 workspace overflow를 허용한다.
- 820px 이하에서는 한 열 목록으로 전환하고 위젯 내부의 넓은 달력·주간 표는 자체 수평 overflow를 사용한다.
- Dock을 위한 하단 안전 영역을 유지하고 fixed/sticky UI가 마지막 콘텐츠를 가리지 않는지 모든 기준 viewport에서 확인한다.

## 11. Shared with BOGUNON / independent choices

### 공유하는 요소

- Pretendard와 compact Korean productivity typography
- muted navy typography와 interaction용 mint accent
- 차분한 행정·보건 실무 톤
- restrained border, subtle shadow, 명확한 focus state
- 짧고 비기술적인 한국어 copy

### 공유하지 않는 요소

- BOGUNON의 mint canvas와 pastel surface hierarchy
- BOGUNON 또는 이전 Dashboard의 고정 정보 계층과 column 배치
- 모든 영역에 동일한 icon box + title + rounded card를 반복하는 문법
- 웹페이지형 넓은 section spacing과 고정형 KPI hierarchy
- 모바일 우선 launcher 구조

BOGUNON DESK는 이 브랜드 재료를 사용하되, 배치와 상호작용은 사용자 구성형 Windows Workspace에 최적화한다.

## 12. Accessibility, motion, and persistence boundary

- 모든 편집 버튼은 명확한 accessible name과 `focus-visible` 상태를 갖는다.
- 상태는 색상만으로 전달하지 않고 label, icon, text를 함께 사용한다.
- transition은 140ms `ease-out`의 color, opacity, transform에 제한하며 `prefers-reduced-motion`에서 제거한다.
- Account settings는 layout, appearance, widget visibility, preset, Dock order/visibility와 개인 launcher URL을 포함한다. 기존 localStorage 및 Tauri Store 키는 호환 adapter 뒤에서 그대로 유지한다.
- Device settings는 업무 폴더, `closeToTray`, autostart와 기타 OS integration만 포함하며 로컬 경로를 계정 동기화 대상으로 올리지 않는다.
- 업무포털은 이 PC에만 저장되는 등록 URL을 기본 브라우저로 여는 launcher다. 자격증명 자동화는 하지 않으며 Account Sync와 기본 Dock에서 제외하고 Command Palette에서 실행한다.
- 업무포털 자동 열기는 이 PC 전용 선택 설정이며 `사용 안 함`·20초·45초를 지원한다. 새 앱 프로세스 시작당 최대 한 번만 예약하고 tray 복원, rerender, 설정 재오픈에서는 다시 실행하지 않는다. 자동 로그인이나 자격증명 처리는 하지 않는다.
- memo 내용, checklist 상태, 학생 정보, 실제 업무 데이터는 저장하지 않는다.
- Account UI는 BOGUNON과 동일한 Supabase Google 계정의 연결 상태와 별도로 `동기화 중`, `동기화됨`, `오프라인 / 동기화 실패` 상태를 표시한다.
- Google OAuth는 embedded WebView가 아닌 system browser에서 진행하고 `school-health-desk://auth/callback` deep link로 복귀한다.
- 인증 session은 localStorage가 아닌 Windows DPAPI 사용자 범위 secure storage에 보관하며 dashboard와 launcher persistence에서 분리한다.
- 로그인한 사용자의 Account settings는 BOGUNON과 동일한 Supabase 프로젝트의 `school_health_desk_settings`에 동기화한다. Device settings와 memo/checklist/학생 정보는 원격 payload에 포함하지 않는다.
- 앱은 마지막 local cache로 즉시 시작하고 원격 응답을 기다리지 않는다. 원격 row가 없으면 현재 local 설정을 최초 업로드하며, row가 있으면 검증된 remote 설정을 local cache에 적용한다.
- v1 충돌 정책은 로그인 시 기존 remote 우선, 로그인 후 이 PC에서 발생한 변경은 local 우선이다. local 변경은 즉시 저장하고 원격에는 trailing debounce 후 전체 Account settings snapshot을 저장한다.
- Realtime 동기화, 동시 편집 conflict UI, SQLite는 현재 범위에 포함하지 않는다.
- Tray, autostart, opener 같은 OS 통합은 공식 Tauri plugin과 Rust command를 경계로 사용한다.

## 13. Command Palette

- `Ctrl+K`는 BOGUNON DESK의 top-level command launcher이며 View mode와 Edit mode에서 동일하게 사용할 수 있다.
- Command Palette는 Dock을 대체하지 않고 보완한다. Dock은 항상 보이는 핵심 바로가기를 유지하고, 기능이 늘어나도 Dock item을 무한정 추가하지 않는다.
- Local command는 입력 즉시 검색한다. 두 글자 이상부터 현재 Workspace filter 범위의 BOGUNON 업무·일정 제목을 함께 검색한다.
- BOGUNON 검색은 제목과 최소 날짜·상태만 조회하고 검색 기록이나 결과를 저장하지 않는다. 결과 열기는 native safe route launcher를 사용한다.
- 최근 command 기록과 AI command는 포함하지 않는다.
- 실행은 별도 navigation 체계를 만들지 않고 기존 Desktop action, Quick Add, Toolbox, Settings, Workspace editor action을 재사용한다.

## 14. Work Inbox

- 미처리 업무 Inbox는 마감, 오늘 마감, 후속 확인, 확인 필요, 회신 대기 업무 전체를 Workspace 표시 범위에 맞춰 모은다.
- 알림 위젯은 같은 actionable 분류의 상위 4건만 요약하며 `전체 보기`로 Inbox를 연다.
- Inbox의 완료 처리는 기존 BOGUNON task completion mutation을 재사용하고, 별도 업무 저장소나 상태 체계를 만들지 않는다.
- Inbox 제목과 알림 위젯의 개별 항목은 기존 parameterized BOGUNON task launcher를 통해 원본 업무를 연다. 완료 control과 navigation control은 별도 button으로 유지한다.
- Inbox 완료 성공 뒤에는 가장 최근 한 건만 7초 동안 되돌릴 수 있는 compact session-only 안내를 표시한다. 되돌리기는 기존 completion mutation에 `completed=false`를 전달하며 별도 history나 저장소를 만들지 않는다.
- Inbox의 상태·후속 확인일 편집은 `planned`, `inProgress`, `waitingForReply`, `needsCheck`, `onHold`만 다루는 compact popover로 제공한다. 완료·완료 해제는 계속 기존 completion mutation만 사용한다.
- 상태·후속 확인일 저장은 authoritative `set_task_action_state` RPC와 `updated_at` optimistic concurrency를 사용한다. 충돌하면 저장 성공으로 표시하지 않고 Workspace를 새로고침하며, 후속 확인일의 설정·변경·명시적 비우기 외에 다른 task field를 수정하지 않는다.
- Inbox는 Command Palette와 알림 위젯에서 접근하며 기본 Dock 항목에는 추가하지 않는다.

## 15. Desktop utilities

- 업무 계산기는 Workspace를 밀지 않는 compact floating internal tool이며 Command Palette와 Toolbox의 `일반 도구` category에서 연다.
- 계산기는 일반 사칙연산, 퍼센트, local calendar date 차이, 비의료 단위 변환만 지원한다. 약물 용량·투약·의학적 위험도처럼 의료 판단과 연결되는 계산은 제공하지 않는다.
- 계산 입력과 결과는 Supabase, Account Settings, Device Settings, localStorage, Tauri Store 어디에도 저장하지 않는다. Panel을 닫으면 현재 계산 상태를 폐기한다.
- Toolbox registry는 외부 launcher와 내부 desktop tool을 구분하며, 내부 도구를 URL이나 Account launcher 설정에 끼워 넣지 않는다.
- 일반 도구 category는 향후 타이머·스톱워치·날짜 도구를 확장할 수 있는 위치지만, 기본 Dock 항목을 늘리는 근거로 사용하지 않는다.

## 16. Quick Memo

- 빠른 메모는 앱 프로세스가 살아 있는 동안만 유지되는 session-only scratchpad다. Supabase, Account/Device Settings, localStorage, sessionStorage, Tauri Store, 파일에 저장하지 않는다.
- Workspace widget과 compact floating panel은 같은 `WidgetSessionContext` 상태를 사용한다. Command Palette와 Dock의 빠른 메모 action은 위젯 표시 여부와 무관하게 floating panel을 연다.
- URL 감지는 `http`와 `https`만 허용하며 preview나 metadata fetch를 하지 않는다. 링크 실행은 Rust native command에서 scheme과 host를 다시 검증한 뒤 기본 브라우저로 연다.
- `업무로 보내기`는 첫 번째 non-empty line만 120자 이내 업무 제목 draft로 Quick Add에 전달한다. 메모 전체 복사, 자동 저장, 자동 submit, 성공 후 자동 삭제는 하지 않는다.
- floating panel은 기존 surface, border, shadow, focus 상태를 재사용하고 폭은 `--quick-memo-panel-width` 토큰을 사용한다.

## 17. Windows Native Notifications

- Windows 업무 알림은 명시적 opt-in이며 이 PC에만 저장하고 계정과 동기화하지 않는다.
- Inbox actionable 업무를 재사용해 하루 최대 한 번 건수만 요약한다.
- `overdue`, `dueToday`, `followUp`, `needsCheck`는 이 PC에서 선택할 수 있으며 기존 사용자는 네 종류가 모두 켜진 상태로 유지된다. 선택 변경은 당일 전송 기록을 초기화하지 않는다.
- `waitingForReply` 단독 항목은 제외하고, 후속 확인일이 된 항목은 `followUp`으로 포함한다.
- 업무 제목, ID, 학생 정보, 상세 내용은 OS 알림과 알림 Store에 남기지 않는다.
- 권한은 사용자가 기능을 켤 때만 요청하며 테스트 알림은 일일 중복 방지와 분리한다.
- Windows 알림 클릭 연결은 v1 범위가 아니며 Tray의 `미처리 업무`로 Inbox를 연다.

## 18. Work Folder Favorites

- 업무 폴더 즐겨찾기는 별도 Tauri Store에만 저장하는 device-only 데이터이며 raw local path를 Account Settings, Supabase, 브라우저 저장소로 전송하지 않는다.
- Dock의 기존 `work-folder` action은 식별자를 유지한 채 compact folder panel을 열고, Command Palette는 즐겨찾기 이름을 즉시 검색한다.
- 개별 폴더 열기는 frontend가 path 대신 stable favorite ID만 전달하고 Rust가 store에서 path를 resolve한 뒤 존재하는 directory만 연다. arbitrary path opener는 제공하지 않는다.
- 기존 `desktop-launchers.json`의 단일 `workFolderPath`는 새 favorites store가 비었을 때 한 번만 migration하며, 새 store 저장 성공 전에는 legacy 값을 지우지 않는다.
- 즐겨찾기는 최대 12개이며 이름 변경과 순서 변경만 지원한다. 삭제는 favorite entry만 제거하고 실제 filesystem은 절대 변경하지 않는다.
- 일시적으로 찾을 수 없는 폴더는 자동 삭제하지 않고 unavailable 상태로 유지한다.

## 19. Calendar Quick Add

- 월간 실무일정의 날짜 숫자는 선택한 local calendar date를 미리 채운 Quick Add 일정 화면을 연다.
- 일정 종류와 `schoolSchedule` 영역은 기존 Quick Add 기본값을 사용하며, 사용자가 명시적으로 저장하기 전에는 BOGUNON mutation을 실행하지 않는다.
- 날짜 셀 전체나 일정 preview는 클릭 대상으로 만들지 않고 날짜 버튼만 entry point로 사용한다. v1은 context menu, event navigation, month navigation을 제공하지 않는다.
- 선택 날짜는 panel open state에서만 유지하며 별도 persistence, query, DB/schema 변경을 추가하지 않는다.

## 20. Weekly Schedule Preview

- 이번 주 실무일정은 source order의 앞 2건만 표시하고 나머지는 `+N`으로 요약한다.
- 일정 제목은 DOM 원문과 hover용 `title`을 유지하되 카드 안에서는 한 줄 ellipsis로 제한한다.
- 이 preview 규칙은 기존 7열 구조, widget 크기, workspace geometry를 변경하지 않는다.

## 21. Today Task Ordering

- 오늘 업무는 날짜 단위이며 미완료 업무 안에서 오늘 마감, 오늘 수행, priority, title, stable ID 순으로 정렬한다. 완료 업무는 항상 마지막에 둔다.
- row에는 높이를 늘리지 않는 `오늘 마감`, `오늘 수행`, `완료` metadata만 표시한다.
- BOGUNON task schema에 task 시작·종료 시간이 없으므로 title이나 timestamp에서 가상의 업무 시간을 만들지 않는다.

## 22. Today Task Navigation

- Today Tasks와 Priority Task의 제목은 기존 검증된 native BOGUNON launcher로 원본 업무를 연다.
- widget session의 local date를 calendar highlight 날짜로 전달하며, checkbox는 완료 처리이고 제목은 navigation으로 분리한다.
- DESK 안에 상세 업무를 복제하지 않고 BOGUNON 원본 화면에서 관리한다.

## 품의 도우미

- 품의 도우미는 Command Palette와 업무 도구의 기록·행정에서 여는 내부 데스크톱 도구다.
- 자동 인식되지 않는 스프레드시트 열은 사용자가 직접 품의 필드에 연결할 수 있다.
- 가져오기 템플릿은 Rust가 만든 정규화된 머리글의 정확한 순서 signature와 열 매핑만 계정 동기화하며, 실제 품목·가격·원본 행·파일 경로는 저장하거나 동기화하지 않는다.
- 동일 signature에서는 저장 템플릿을 alias 자동 인식보다 먼저 적용하며 fuzzy mapping은 하지 않는다.
- XLSX/XLS/CSV와 텍스트 객체·표 구분이 보존된 PDF를 로컬에서만 분석한다. PDF도 기존 자동 인식, 수동 열 지정, exact signature 템플릿 흐름을 공유한다.
- 스캔 PDF와 PNG/JPG OCR은 지원하지 않는다. PDF 원문·추출 텍스트·preview 행은 저장하거나 업로드하지 않고 현재 앱 프로세스에서만 사용한다.
- 원본 파일, 경로, 품목 데이터는 저장하거나 업로드하지 않고 현재 앱 프로세스의 메모리에만 둔다.
- 계정 동기화에는 개인정보가 아닌 출력 열 ID와 순서만 포함한다.
- 선택 품목을 HTML/TSV로 복사하거나 CSV/XLSX로 저장하며, 의료 판단이나 학생 건강기록 용도가 아니다.
- `품목내역`과 `품의문 작성`을 같은 도구 안의 연속 단계로 제공한다. 품의문은 선택 품목의 합계와 공통 구매처·예산항목을 반영하는 deterministic template이며 AI/API를 호출하지 않는다.
- 품의문 입력과 preview는 품목과 같은 session-only 상태다. 패널을 닫아도 현재 프로세스에서는 유지하지만 `새 작업`에서 품목·source·mapping candidate와 함께 초기화한다.
- 계정에는 사용자 품의문 템플릿의 이름, placeholder pattern, 본문 항목 순서, 붙임 형식만 동기화한다. 실제 제목·목적·금액·구매처·예산항목·품목표는 저장하거나 동기화하지 않는다.
- 품의문은 plain text로 복사할 수 있고, 품목표와 함께 복사할 때는 같은 text에 TSV를 덧붙이며 지원 환경에서는 paragraph HTML과 기존 HTML table을 함께 제공한다.
- 품의문 작성은 로컬 문서 준비 기능이며 BOGUNON mutation을 실행하지 않는다.
- `구매결과`는 선택 품목의 품의 계획과 실제 수량·단가·상태를 분리해 비교하는 정산 단계다. 배송비와 할인까지 반영하되 행정·회계상 적정 여부는 판단하지 않는다.
- 계획 `PurchaseItem`은 변경하지 않고 실제 구매값은 별도 `PurchaseSettlement`에 둔다. 이 상태는 패널을 닫아도 현재 앱 프로세스에서는 유지하지만 `새 작업`에서 초기화되며 저장·계정 동기화·BOGUNON mutation을 하지 않는다.
- 구매결과는 HTML/TSV 표, plain-text 정산 요약, 숫자 cell 기반 XLSX로 내보낼 수 있다. 향후 입고 연결을 고려한 범용 구조지만 v1.4에서는 재고·예산 집행을 변경하지 않는다.

## AI connection

- OpenAI와 Gemini는 BOGUNON DESK의 향후 AI 도구가 공유하는 선택형 연결이다. AI를 연결하지 않아도 기본 도구와 deterministic 초안·프롬프트 준비 기능은 사용할 수 있다.
- provider와 model은 DESK가 관리하는 allowlist에서만 선택하며, 사용자가 임의 model ID를 입력하지 않는다.
- API Key는 현재 앱 프로세스의 메모리에만 유지한다. localStorage, sessionStorage, Tauri Store, Account/Device Settings, Supabase, 파일, 환경변수, DPAPI secure session에 저장하지 않는다.
- 앱을 완전히 종료하거나 재시작하면 AI 연결은 항상 해제된다. 설정 패널을 닫았다 다시 여는 것은 같은 앱 프로세스이므로 연결 상태를 유지한다.
- provider 검증과 향후 AI 요청은 WebView fetch가 아니라 native Tauri gateway를 통한다. Rust는 요청 동안에만 key를 사용하고 raw provider 응답, Authorization header, key, request body를 로그나 UI 오류에 노출하지 않는다.
- AI provider, model, key, connection status는 Account Sync 및 Supabase payload에 포함하지 않는다.
- 향후 공문 작업실 같은 DESK AI consumer는 이 shared connection을 사용하되, 전송 직전 사용자가 선택한 provider와 외부 전송 범위를 명확히 알 수 있어야 한다.

## Official Document Workspace

- 공문 작업실은 업무 도구의 기록·행정에서 여는 DESK internal tool이며 새 공문 작성, 받은 공문 수정, 공문 핵심정리의 세 mode를 제공한다.
- 새 공문은 로컬 deterministic template으로 제목, 번호 체계가 있는 본문, 붙임, 교직원 메신저 문구, 기안 전 체크리스트를 만든다. 별도 품의 도우미와 겹치는 품목·금액 중심 품의 흐름은 포함하지 않는다.
- 모든 mode에서 OpenAI나 Gemini에 종속되지 않은 `AI 프롬프트 만들기`를 로컬에서 사용할 수 있다. shared AI connection이 있으면 같은 prompt를 native Tauri gateway를 통해 연결한 provider에 보낸다.
- 공문 입력, 원문, 수정 요청, 초안, prompt, AI 응답은 앱 프로세스 메모리에만 유지한다. localStorage, Tauri Store, Account/Device Settings, Supabase, 파일에는 기록하지 않으며 기본 history도 만들지 않는다.
- AI 직접 실행 전 명백한 학생 이름, 학번, 연락처, 건강정보와 개인 식별 가능한 사고 내용을 로컬에서 점검한다. 탐지 시 외부 전송은 차단하지만 로컬 초안 및 prompt 작성은 계속 사용할 수 있다.
- Local document import v1은 받은 공문 수정과 공문 핵심정리에서 텍스트형 PDF와 HWPX 한 파일을 로컬로 읽는다. 원본 파일은 복사·저장·업로드하지 않고 frontend에는 basename, 형식, 추출 text만 전달한다.
- 추출 text와 filename metadata는 현재 앱 프로세스의 session에만 유지하며 import만으로 AI provider나 Supabase에 전송하지 않는다. 연결한 AI로 직접 작성·정리할 때만 기존 개인정보 preflight를 통과한 text가 선택 provider로 전송된다.
- 스캔 PDF와 OCR, legacy HWP, DOC/DOCX, 다중 파일 병합, 파일 history는 지원하지 않는다.
- 공문 핵심정리의 `기본 핵심정리`는 붙여넣거나 PDF/HWPX에서 추출한 원문을 TypeScript deterministic rule로만 분석한다. AI 연결이나 외부 요청 없이 명시적인 대상, 제출기한, 제출방법, 제출자료, 붙임, 담당자 확인사항과 요청 action을 근거 문장과 함께 정리한다.
- local summary는 원문에 없는 사실을 추정하지 않고 명확하지 않은 값은 `확인 필요`로 남긴다. 원문 변경, 새 파일 import, `새 작업`에서 폐기하며 다른 공문 입력·prompt·AI 응답과 마찬가지로 현재 앱 session에서만 유지한다.
- Quick Add 업무의 `scheduled_date`는 계획한 수행일, 선택적인 `due_date`는 제출·회신 같은 실제 마감일이다. 두 날짜는 서로 독립적이며 마감일을 수행일에서 자동 계산하거나 선후 관계로 저장을 제한하지 않는다.
- `BOGUNON 업무로 보내기`는 local summary의 첫 action과 명시적인 전체 연월일만 기존 Quick Add에 미리 채운다. 제출기한은 마감일에만 채우고 수행일은 Quick Add의 기존 기본값을 유지한다. 사용자가 제목·수행일·마감일·영역·카테고리·우선순위를 확인하고 `저장`하기 전에는 BOGUNON mutation을 실행하지 않는다.
- Quick Add handoff는 `healthWork`, `officialDocument`, `normal`을 사용하며 공문 원문, 근거, 제출자료, 붙임, 담당자, source filename, AI prompt와 응답은 전달하거나 업로드하지 않는다. 연도가 없거나 기간인 기한은 추정하지 않고 마감일을 비워 두어 사용자가 직접 선택한다.
- domain asset은 `healthroom-document-helper` main `57e433ac34e7a0670c403c7d19813b5bbe5fee28`의 options, templates, deterministic generator, reference-document 개념을 참고해 TypeScript pure function과 local registry로 재작성했다. 기존 웹 UI, Google Apps Script, Google Sheet live dependency, admin Gemini cleanup pipeline은 이식하지 않는다.

## Shareable Windows beta

- BOGUNON DESK 0.1.0 공유 베타의 first-run 안내는 Workspace 소개, 선택적 BOGUNON 연결, 개인정보·로컬 처리의 최대 3단계 compact dialog다.
- onboarding 완료값은 `school-health-desk.desktop-settings.v1`의 device-only `onboardingVersion`으로만 저장하며 Account Settings와 Supabase sync에 포함하지 않는다.
- Settings Center의 `이 PC`에서 안내를 다시 열 수 있지만 완료값을 초기화하지 않는다. version은 Tauri app version API에서 읽고 `공유 베타` 단계만 UI label로 유지한다.
- 배포 artifact는 Windows 10/11 x64용 unsigned NSIS installer, SHA256, 사용자 안내로 구성한다. SmartScreen·게시자 확인 가능성을 사실대로 안내하고 보안 기능 비활성화를 유도하지 않는다.
- release preflight는 package/Tauri/Cargo version 일치, HTTPS Supabase URL, 공개 publishable key만 허용한다. secret/service-role key, credential, 학생정보, 실제 학교 문서와 `.env.local`은 source와 artifact metadata에 포함하지 않는다.

## Desktop updates

- 업데이트 확인은 Workspace 렌더와 복원을 막지 않는 device-local 기능이며 계정 설정이나 Supabase payload에 포함하지 않는다.
- 새 버전 안내는 connected desk의 얇은 divider와 mint/navy accent를 재사용한 low-elevation status strip으로 표시한다. 강제 modal이나 marketing alert 형태로 Workspace를 가리지 않는다.
- 설치 확인 dialog는 앱 종료로 사라질 수 있는 session-only 작업을 명시하고, 사용자가 확인하기 전에는 다운로드나 설치를 시작하지 않는다.
- 다운로드 진행, 설치 준비, 복구 가능한 실패 상태는 같은 status strip에서 표현하며 focus-visible과 최소 control target을 유지한다.

## Desktop practical tools

- 빠른 실행은 별도 링크 저장소를 만들지 않고 중앙 `DesktopActionId`와 기기에 등록된 업무 폴더를 재사용하는 기본 숨김 위젯이다.
- launcher tile은 2열 compact icon-first 구조와 기존 glass surface·corner·focus token을 사용한다. 로컬 폴더와 업무포털에는 색상만이 아닌 `이 기기` 표식을 함께 둔다.
- 빠른 메모는 단일 session-only 상태를 유지하며 문자 수는 action row의 보조 정보로만 표시한다.
- Dock tile accent는 표시 순서가 아니라 `data-dock-item` identity에 연결해 숨김·복원·재정렬 후에도 같은 기능의 색을 유지한다.
