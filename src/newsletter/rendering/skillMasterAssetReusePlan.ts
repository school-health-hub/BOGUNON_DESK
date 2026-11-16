export type StudentComposition = "female" | "male" | "mixed" | "objects"

export type ReusableIllustration = Readonly<{
  status: "ready" | "partial"
  source: "product-library" | "external-original"
  assetId: string
  fileName: string
  sha256: string
  studentComposition: StudentComposition
  note: string
}>

export type MissingIllustration = Readonly<{
  status: "missing"
  specification: string
  studentComposition: StudentComposition
}>

export type IllustrationSlot = ReusableIllustration | MissingIllustration

export type SkillMasterTopicAssetPlan = Readonly<{
  topic: string
  representative: IllustrationSlot
  actions: readonly [IllustrationSlot, IllustrationSlot, IllustrationSlot, IllustrationSlot]
}>

const ready = (
  source: ReusableIllustration["source"],
  assetId: string,
  fileName: string,
  sha256: string,
  studentComposition: StudentComposition,
  note: string,
): ReusableIllustration => ({ status: "ready", source, assetId, fileName, sha256, studentComposition, note })

const partial = (
  source: ReusableIllustration["source"],
  assetId: string,
  fileName: string,
  sha256: string,
  studentComposition: StudentComposition,
  note: string,
): ReusableIllustration => ({ status: "partial", source, assetId, fileName, sha256, studentComposition, note })

const missing = (specification: string, studentComposition: StudentComposition): MissingIllustration => ({
  status: "missing",
  specification,
  studentComposition,
})

const external = {
  handwash: ["restore-gut-handwash", "gut-handwash.png", "fb1b4a6b1d3afae7afbe341e44d435ffe4cc5e260c0d7405400928a7e97e4bb5"],
  report: ["ns3e-b-candidate-inner-reporting", "inner-reporting.png", "123aaaaaaa6a68f16c0526c6ea73970f28bd02628d4bd7aab8c85f16141d2c16"],
  coldMain: ["02-cold-commute", "02-cold-commute.png", "48d290e964340c06f46705461beb8ddcc523166890f6ea3c3e21beb3f5a3f476"],
  layers: ["cold-layer-clothes", "cold-layer-clothes.png", "cb7f5b7e42ec435c1576fcb6571ff9023fcadbae99525ff62feeda25984040cb"],
  scarf: ["cold-gloves-scarf", "cold-gloves-scarf.png", "3e41bee71b3479bb18f5d6c2a744c5e7b208a73b4a76eb4c43076d221084dde0"],
  indoors: ["cold-move-indoors", "cold-move-indoors.png", "4d5c7bf783672d3d6c3591579ac50fe24e42b7434c05d16a46bb051cc48966da"],
  weather: ["cold-weather-check", "cold-weather-check.png", "25ca2adf2ee162cc3a6e63aac5bb4b8fb8845d6b8502a1546b2f96f0539e64ac"],
  caffeineMain: ["04-caffeine", "04-caffeine.png", "830c80fd045cbd95ed053e7be0e48156ec2213dbb8df07e6643bcc32c80f151c"],
  label: ["caffeine-check-label", "caffeine-check-label.png", "a4fe42917f1288333d72a705bae75010fba4dca885a41de3673080a3cea2de27"],
  evening: ["caffeine-avoid-evening", "caffeine-avoid-evening.png", "5d1f1a8e9a481c633e9e5a225296a3a2c8a45a62409a4e92783e3ac36569ed96"],
  stacking: ["caffeine-no-stacking", "caffeine-no-stacking.png", "8ba3d50c95768a93b056ca01dafe76aa56b968523b741e8d41aa2ad153ac7d3b"],
  waterMove: ["caffeine-water-move", "caffeine-water-move.png", "63a71b7231829b815c2cfedaa1fa8928cef80c25a7074f7f3f53d428762f2fa2"],
  cooking: ["ns3e-b-candidate-inner-cooking", "inner-cooking.png", "dfb500637b750e0614cae68d21fdaf5162cf413a5daaea9a6e5d1cd6d15115f1"],
  refusal: ["05-tobacco-refusal", "05-tobacco-refusal.png", "a26409eeca4696582f735969f0e856bc2f4a3fdc0579c336710c6a4b4be151e8"],
  clearRefusal: ["tobacco-clear-refusal", "tobacco-clear-refusal.png", "c1335a67cdca26d74638189d021721297848f8af86b2613f046af3377f2c73de"],
  seekHelp: ["tobacco-seek-help", "tobacco-seek-help.png", "9504b5d773dea2dd5b4b7cecd22102f511b3584a10a671d8247f5463ce918265"],
} as const

export const skillMasterAssetReusePlan: readonly SkillMasterTopicAssetPlan[] = [
  {
    topic: "손 위생과 기침 예절",
    representative: ready("product-library", "handwash-composition-candidate", "handwash-composition-candidate.png", "79778701e41c14a559c3926e6d5f2ef95a2ffcc1a24921eb90db8f69575eacce", "female", "기존 1254px 손 씻기 대표 장면"),
    actions: [
      ready("product-library", ...external.handwash, "female", "비누와 흐르는 물로 손 씻기"),
      missing("교복 고등학생이 휴지 또는 옷소매로 입과 코를 가리는 독립 투명 삽화", "mixed"),
      missing("사용한 휴지를 휴지통에 버린 뒤 손을 씻는 두 행동이 읽히는 독립 투명 삽화", "mixed"),
      ready("product-library", ...external.report, "female", "학생이 보호자·보건교사에게 증상을 알리는 장면"),
    ],
  },
  {
    topic: "추워지는 날씨, 안전한 학교생활",
    representative: ready("product-library", ...external.coldMain, "mixed", "혼합 학생의 겨울 통학 장면"),
    actions: [
      ready("external-original", ...external.layers, "female", "겹쳐 입기"),
      ready("external-original", ...external.scarf, "mixed", "장갑과 목도리 착용"),
      ready("external-original", ...external.indoors, "mixed", "실내에서 몸 움직이기"),
      ready("external-original", ...external.weather, "objects", "등교 전 날씨 확인"),
    ],
  },
  {
    topic: "나의 생활 리듬 점검",
    representative: partial("product-library", ...external.caffeineMain, "female", "생활 리듬 중 음료 선택 장면에 한정"),
    actions: [
      partial("external-original", ...external.label, "objects", "카페인·영양표시 확인에 사용 가능"),
      partial("external-original", ...external.evening, "female", "저녁 카페인 회피에 사용 가능"),
      partial("external-original", ...external.stacking, "objects", "여러 카페인 음료 중복 섭취 방지"),
      partial("external-original", ...external.waterMove, "mixed", "물 마시기와 가벼운 움직임"),
    ],
  },
  {
    topic: "시험 기간, 마음 돌보기",
    representative: missing("시험 기간 교실 또는 책상에서 잠시 호흡을 고르는 고등학생 장면", "mixed"),
    actions: [
      missing("짧은 휴식과 호흡을 표현하는 독립 삽화", "female"),
      missing("신뢰하는 사람에게 마음 상태를 말하는 상담 장면", "male"),
      missing("수면과 공부 시간을 균형 있게 계획하는 장면", "objects"),
      missing("위기 시 보호자·상담교사·보건교사에게 도움을 요청하는 장면", "mixed"),
    ],
  },
  {
    topic: "급식 시간, 건강한 식사 습관",
    representative: partial("product-library", ...external.cooking, "male", "조리 장면으로 식생활 주제에 부분 활용"),
    actions: [
      partial("external-original", "gut-cook-food", "gut-cook-food.png", "213faa471f630ef6a115893774cafc8ae7309cd64519d7057d8c506bc15cce3e", "mixed", "충분히 익힌 음식 선택"),
      missing("급식에서 채소·단백질·곡류를 골고루 담는 장면", "mixed"),
      missing("천천히 씹고 식사에 집중하는 고등학생 장면", "male"),
      partial("external-original", ...external.waterMove, "mixed", "단 음료 대신 물 선택 부분에 사용 가능"),
    ],
  },
  {
    topic: "몸과 경계를 존중하기",
    representative: partial("product-library", ...external.refusal, "mixed", "또래에게 분명히 거절하는 자세만 부분 활용"),
    actions: [
      partial("external-original", ...external.clearRefusal, "mixed", "불편한 제안에 명확히 거절하는 장면"),
      missing("상대의 동의를 먼저 묻고 거리를 존중하는 또래 장면", "mixed"),
      missing("온라인에서 사적인 사진과 정보를 공유하지 않는 장면", "objects"),
      partial("external-original", ...external.seekHelp, "male", "신뢰하는 어른에게 도움을 요청하는 장면"),
    ],
  },
] as const
