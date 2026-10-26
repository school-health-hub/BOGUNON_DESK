import { invoke, isTauri } from "@tauri-apps/api/core"
import { z } from "zod"
import { createNewsletterProject } from "../newsletter/project"
import { BrowserSvgRasterizer } from "../newsletter/output/browserRasterizer"
import { generateNewsletterOutputs, type NewsletterOutputBundle } from "../newsletter/output/outputEngine"
import { PdfLibImageComposer } from "../newsletter/output/pdfComposer"
import {
  getLastNewsletterOutput,
  pickNewsletterOutputTarget,
  recoverNewsletterOutputs,
  saveNewsletterOutput,
  type OutputSelection,
  type SelectedOutputTarget,
} from "../newsletter/output/storageClient"
import { createNewsletterDesignState } from "../newsletter/rendering/designSchema"
import "./storage-qa.css"

type QaState = {
  target: SelectedOutputTarget | null
  bundle: NewsletterOutputBundle | null
  busy: boolean
}

const state: QaState = { target: null, bundle: null, busy: false }
const qaInfoSchema = z.object({
  sourceSha: z.string().regex(/^[a-f0-9]{40}$/),
  identifier: z.literal("kr.sungandi.schoolhealthdesk.newsletterqa"),
  dataPathIsolated: z.literal(true),
}).readonly()

function root(): HTMLElement {
  const element = document.querySelector<HTMLElement>("#app")
  if (element === null) throw new Error("Newsletter storage QA root is missing")
  return element
}

function status(title: string, detail: string, files: readonly string[] = []): void {
  const element = document.querySelector<HTMLElement>("#storage-status")
  if (element === null) return
  element.replaceChildren()
  const strong = document.createElement("strong")
  strong.textContent = title
  const paragraph = document.createElement("p")
  paragraph.textContent = detail
  element.append(strong, paragraph)
  if (files.length > 0) {
    const list = document.createElement("ul")
    list.className = "storage-files"
    for (const file of files) {
      const item = document.createElement("li")
      item.textContent = file
      list.append(item)
    }
    element.append(list)
  }
}

function setBusy(busy: boolean): void {
  state.busy = busy
  for (const button of document.querySelectorAll<HTMLButtonElement>("button")) button.disabled = busy
}

async function outputBundle(): Promise<NewsletterOutputBundle> {
  if (state.bundle !== null) return state.bundle
  const now = "2026-10-26T00:00:00.000Z"
  const project = await createNewsletterProject({ projectId: "storage-qa", title: "출력 저장 검증", now })
  const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now, schoolName: "합성고등학교" })
  state.bundle = await generateNewsletterOutputs({
    project,
    projectRevision: 1,
    design,
    designRevision: 1,
    createdAt: now,
    rasterizer: new BrowserSvgRasterizer(),
    pdfComposer: new PdfLibImageComposer(),
  })
  return state.bundle
}

async function chooseTarget(): Promise<void> {
  const selected = await pickNewsletterOutputTarget()
  if (selected === null) {
    status("취소됨", "출력 위치가 변경되지 않았습니다.")
    return
  }
  state.target = selected
  const label = document.querySelector<HTMLElement>("#target-label")
  if (label !== null) label.textContent = selected.label
  status("출력 위치 선택 완료", "절대경로는 화면이나 로그에 표시하지 않습니다.")
}

async function save(selection: OutputSelection): Promise<void> {
  if (state.target === null) {
    status("출력 위치 필요", "먼저 출력 위치를 선택하세요.")
    return
  }
  const collision = document.querySelector<HTMLSelectElement>("#collision-policy")?.value === "replace" ? "replace" : "deny"
  setBusy(true)
  status("저장 중", "출력 생성, 원자적 저장 및 SHA-256 사후 검증을 진행합니다.")
  try {
    const outcome = await saveNewsletterOutput(state.target, await outputBundle(), selection, collision)
    status(`저장 결과: ${outcome.status}`, `${outcome.files.length}개 파일 처리`, outcome.files.map((file) => `${file.fileName}: ${file.status}${file.failureReason === undefined ? "" : ` · ${file.failureReason}`}`))
  } catch (error: unknown) {
    status("저장 실패", error instanceof Error ? error.message : "알 수 없는 저장 오류")
  } finally {
    setBusy(false)
  }
}

function render(): void {
  root().innerHTML = `
    <div class="storage-shell">
      <header class="storage-header"><h1>Newsletter 출력 저장·복구 QA</h1><p>NS-3B-2 독립 검증 화면 · 합성 데이터 전용</p></header>
      <section class="storage-panel"><h2>출력 위치</h2><div class="storage-controls"><button id="pick-target" class="storage-button">폴더 선택</button><strong id="target-label">선택되지 않음</strong><label>충돌 처리 <select id="collision-policy"><option value="deny">덮어쓰기 금지</option><option value="replace">기존 파일 보호 후 교체</option></select></label></div></section>
      <section class="storage-grid">
        <div class="storage-panel"><h2>A4</h2><div class="storage-controls"><button class="storage-button save-output" data-output="a4-png">A4 PNG 저장</button><button class="storage-button save-output" data-output="a4-pdf">A4 PDF 저장</button></div></div>
        <div class="storage-panel"><h2>카드뉴스</h2><div class="storage-controls"><button class="storage-button save-output" data-output="card-pngs">PNG 7장 저장</button><button class="storage-button save-output" data-output="cards-pdf">7페이지 PDF 저장</button></div></div>
      </section>
      <section class="storage-panel"><h2>복구 및 이력</h2><div class="storage-controls"><button id="recover" class="storage-button secondary">중단 작업 복구</button><button id="last-success" class="storage-button secondary">마지막 정상 출력</button></div></section>
      <section class="storage-panel"><h2>진행 상태</h2><div id="storage-status" class="storage-status" role="status" aria-live="polite"><strong>준비됨</strong><p>출력 위치를 선택한 뒤 저장 형식을 선택하세요.</p></div></section>
    </div>`
  document.querySelector<HTMLButtonElement>("#pick-target")?.addEventListener("click", () => {
    void chooseTarget().catch((error: unknown) => {
      status("출력 위치 선택 실패", error instanceof Error ? error.message : "알 수 없는 위치 선택 오류")
    })
  })
  for (const button of document.querySelectorAll<HTMLButtonElement>(".save-output")) {
    button.addEventListener("click", () => { void save(button.dataset.output as OutputSelection) })
  }
  document.querySelector<HTMLButtonElement>("#recover")?.addEventListener("click", () => {
    void recoverNewsletterOutputs().then(
      (report) => status("복구 완료", `${report.inspected}건 확인 · ${report.recovered}건 복구 · ${report.reconciliationRequired}건 조정 필요`),
      (error: unknown) => status("복구 실패", error instanceof Error ? error.message : "알 수 없는 복구 오류"),
    )
  })
  document.querySelector<HTMLButtonElement>("#last-success")?.addEventListener("click", () => {
    void getLastNewsletterOutput("storage-qa").then(
      (entry) => status(entry === null ? "정상 출력 없음" : "마지막 정상 출력", entry === null ? "아직 성공 이력이 없습니다." : `${entry.createdAt} · ${entry.profile} · ${entry.files.length}개 파일`),
      (error: unknown) => status("이력 조회 실패", error instanceof Error ? error.message : "알 수 없는 이력 조회 오류"),
    )
  })
  if (!isTauri()) {
    status("브라우저 미리보기", "Native 폴더 선택과 파일 저장은 Tauri 앱에서만 실행됩니다.")
    for (const button of document.querySelectorAll<HTMLButtonElement>("button")) button.disabled = true
  }
}

render()
if (isTauri()) {
  void invoke<unknown>("newsletter_storage_qa_info").then(
    (value) => {
      const info = qaInfoSchema.parse(value)
      status("Native QA 준비됨", `${info.identifier} · source ${info.sourceSha.slice(0, 12)} · 격리 데이터 경로 확인`)
    },
    (error: unknown) => status("Native QA 무결성 확인 실패", error instanceof Error ? error.message : "알 수 없는 QA 무결성 오류"),
  )
}
