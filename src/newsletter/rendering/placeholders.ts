export type NewsletterPlaceholderKind = "mascot" | "seasonal" | "cover" | "topic-1" | "topic-2" | "topic-3" | "topic-4" | "topic-5" | "topic-6" | "generic"

const COLORS: Readonly<Record<NewsletterPlaceholderKind, readonly [string, string]>> = {
  mascot: ["#e8f2ec", "#176b45"], seasonal: ["#fff0dc", "#d56a28"], cover: ["#e8eef6", "#173b70"],
  "topic-1": ["#e6f4ee", "#23845c"], "topic-2": ["#fff0e1", "#c76728"], "topic-3": ["#e8f1fb", "#3478b8"],
  "topic-4": ["#f1eafb", "#7653a6"], "topic-5": ["#e5f4f4", "#27858b"], "topic-6": ["#eef3df", "#65843b"], generic: ["#f3eee3", "#7ca28d"],
}

export function placeholderKindForSlot(slotId: string): NewsletterPlaceholderKind {
  if (slotId.includes("mascot")) return "mascot"
  if (slotId.includes("seasonal")) return "seasonal"
  if (slotId === "cover-image") return "cover"
  const match = /(?:a4|topic)-image-(\d)/u.exec(slotId)
  switch (match?.[1]) {
    case "1": return "topic-1"
    case "2": return "topic-2"
    case "3": return "topic-3"
    case "4": return "topic-4"
    case "5": return "topic-5"
    case "6": return "topic-6"
  }
  return "generic"
}

function icon(kind: NewsletterPlaceholderKind, color: string): string {
  switch (kind) {
    case "mascot": return `<circle cx="160" cy="104" r="55" fill="none" stroke="${color}" stroke-width="8"/><circle cx="141" cy="95" r="5" fill="${color}"/><circle cx="179" cy="95" r="5" fill="${color}"/><path d="M140 125q20 18 40 0M112 73l-28-25M208 73l28-25" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`
    case "seasonal": return `<path d="M70 170c72-22 90-76 118-132-2 72 22 120 70 152M147 82c-38-28-72-18-88 15 42 13 70 7 88-15zm18 38c39-31 75-22 92 10-41 15-71 11-92-10z" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`
    case "cover": return `<path d="M78 184h164V75H78zM112 75V48h96v27M160 98v58M131 127h58" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`
    case "topic-1": return `<path d="M92 92q68-62 136 0v92H92zM120 113h80M120 140h80M120 167h55" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>`
    case "topic-2": return `<path d="M92 82h136v112H92zM92 120h136M126 82v112M194 82v112" fill="none" stroke="${color}" stroke-width="9"/>`
    case "topic-3": return `<path d="M160 52c-50 25-70 62-65 104 5 39 34 62 65 62s60-23 65-62c5-42-15-79-65-104z" fill="none" stroke="${color}" stroke-width="9"/><path d="M126 145h68" stroke="${color}" stroke-width="9" stroke-linecap="round"/>`
    case "topic-4": return `<path d="M85 178q75-98 150 0M108 178v-50h104v50M132 128V92h56v36" fill="none" stroke="${color}" stroke-width="9" stroke-linejoin="round"/>`
    case "topic-5": return `<path d="M84 182h152M112 182v-78h96v78M136 104V76h48v28M160 130v28M146 144h28" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>`
    case "topic-6": return `<circle cx="160" cy="132" r="66" fill="none" stroke="${color}" stroke-width="9"/><path d="M160 82v55l38 22" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>`
    case "generic": return `<path d="M64 199c54-16 67-62 91-116 32 44 42 90 101 116" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`
  }
}

export function newsletterPlaceholderDataUrl(kind: NewsletterPlaceholderKind): string {
  const [background, color] = COLORS[kind]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="260" viewBox="0 0 320 260"><rect width="320" height="260" rx="28" fill="${background}"/>${icon(kind, color)}<rect x="80" y="224" width="160" height="24" rx="12" fill="#ffffff" opacity=".86"/><text x="160" y="241" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="${color}" text-anchor="middle">QA PLACEHOLDER</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
