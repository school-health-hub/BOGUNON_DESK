import {
  BriefcaseBusiness,
  Calculator,
  CalendarDays,
  Command,
  Database,
  FileText,
  FolderOpen,
  Newspaper,
  PackageSearch,
  Plus,
  Search,
  ShoppingCart,
  Stethoscope,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const toolGroupIds = ["health", "documents", "schedule", "quick", "personal"] as const;
export type ToolGroupId = (typeof toolGroupIds)[number];

export const toolIds = [
  "school-health-room",
  "newsletter",
  "inventory-local",
  "inventory-preview",
  "inventory-qa",
  "education-video",
  "official-document",
  "purchase-helper",
  "school-admin",
  "record-helper",
  "local-calendar",
  "local-tasks",
  "quick-add",
  "work-folder",
  "calculator",
  "command-palette",
  "finance",
] as const;
export type ToolId = (typeof toolIds)[number];

export type ToolDefinition = {
  readonly id: ToolId;
  readonly group: ToolGroupId;
  readonly title: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly icon: LucideIcon;
  readonly developmentOnly?: boolean;
};

export const toolGroups: readonly { readonly id: ToolGroupId; readonly title: string; readonly description: string }[] = [
  { id: "health", title: "보건실 업무", description: "자주 쓰는 보건실 업무를 바로 시작합니다." },
  { id: "documents", title: "문서·행정", description: "공문과 학교 행정 문서를 준비합니다." },
  { id: "schedule", title: "일정·정리", description: "일정과 해야 할 일을 한곳에서 정리합니다." },
  { id: "quick", title: "빠른 도구", description: "계산과 명령 실행을 빠르게 처리합니다." },
  { id: "personal", title: "개인", description: "개인 업무 자료를 별도로 관리합니다." },
];

export const toolDefinitions: readonly ToolDefinition[] = [
  { id: "school-health-room", group: "health", title: "우리 보건실", description: "학교 구성원과 함께 쓰는 보건실 업무 공간", keywords: ["공유", "학교"], icon: Stethoscope },
  { id: "newsletter", group: "health", title: "보건소식지 제작소", description: "월별 보건소식지 원고와 디자인을 준비합니다.", keywords: ["가정통신문", "소식지", "월간"], icon: Newspaper },
  { id: "inventory-local", group: "health", title: "물품관리", description: "보건실 물품의 수량과 사용 내역을 관리합니다.", keywords: ["재고", "소모품"], icon: PackageSearch },
  { id: "inventory-preview", group: "health", title: "물품관리 미리보기", description: "예시 화면에서 물품관리 흐름을 확인합니다.", keywords: ["재고", "체험"], icon: PackageSearch },
  { id: "inventory-qa", group: "health", title: "물품관리 점검 화면", description: "개발 전용 격리 환경에서 물품관리를 점검합니다.", keywords: ["재고", "qa", "개발"], icon: Database, developmentOnly: true },
  { id: "education-video", group: "health", title: "교육영상 찾기", description: "보건교육에 활용할 영상을 찾고 보관합니다.", keywords: ["유튜브", "교육", "영상"], icon: Search },
  { id: "official-document", group: "documents", title: "공문작업실", description: "공문을 가져와 편집하고 초안을 저장합니다.", keywords: ["공문", "문서"], icon: FileText },
  { id: "purchase-helper", group: "documents", title: "품의 도우미", description: "품목을 계산하고 품의문 작성을 준비합니다.", keywords: ["구매", "품의"], icon: ShoppingCart },
  { id: "school-admin", group: "documents", title: "학교 행정 도우미", description: "학교 업무 시스템과 행정 문서 작업을 돕습니다.", keywords: ["행정", "업무포털", "복무"], icon: BriefcaseBusiness },
  { id: "record-helper", group: "documents", title: "생활기록부 도우미", description: "활동 자료를 검토하고 문장 초안을 준비합니다.", keywords: ["생기부", "활동보고서"], icon: FileText },
  { id: "local-calendar", group: "schedule", title: "내 일정", description: "월간 일정과 시간별 일정을 이 PC에서 관리합니다.", keywords: ["달력", "캘린더"], icon: CalendarDays },
  { id: "local-tasks", group: "schedule", title: "일정·업무 관리", description: "할 일과 마감일, 완료 상태를 관리합니다.", keywords: ["업무", "마감", "할 일"], icon: FileText },
  { id: "quick-add", group: "schedule", title: "빠른 업무 추가", description: "새 업무의 제목과 일정을 빠르게 기록합니다.", keywords: ["추가", "할 일"], icon: Plus },
  { id: "work-folder", group: "schedule", title: "업무 폴더", description: "자주 쓰는 폴더를 등록하고 바로 엽니다.", keywords: ["즐겨찾기", "탐색기"], icon: FolderOpen },
  { id: "calculator", group: "quick", title: "업무 계산기", description: "퍼센트, 날짜와 단위를 빠르게 계산합니다.", keywords: ["계산", "변환"], icon: Calculator },
  { id: "command-palette", group: "quick", title: "빠른 명령", description: "이름을 검색해 지원 기능을 바로 실행합니다.", keywords: ["명령", "검색", "ctrl k"], icon: Command },
  { id: "finance", group: "personal", title: "MY FINANCE", description: "개인 수입과 자산 정보를 암호화해 관리합니다.", keywords: ["금융", "자산", "세금"], icon: Wallet },
];

export function getVisibleToolDefinitions(isDevelopment: boolean): readonly ToolDefinition[] {
  return toolDefinitions.filter((tool) => isDevelopment || tool.developmentOnly !== true);
}

export function matchesToolSearch(tool: ToolDefinition, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  if (normalized.length === 0) return true;
  return [tool.title, tool.description, ...tool.keywords]
    .join(" ")
    .toLocaleLowerCase("ko-KR")
    .includes(normalized);
}
