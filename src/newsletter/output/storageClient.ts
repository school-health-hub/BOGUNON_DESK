import { invoke, isTauri } from "@tauri-apps/api/core"
import { z } from "zod"
import type { NewsletterOutputBundle, OutputArtifact } from "./outputEngine"

const fileStatusSchema = z.enum(["pending", "saved", "preserved", "failed"])
const saveOutcomeSchema = z.object({
  operationId: z.string(),
  projectId: z.string(),
  projectRevision: z.number().int().positive(),
  designRevision: z.number().int().positive(),
  profile: z.string(),
  profileVersion: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  targetLabel: z.string(),
  status: z.enum(["pending", "partial", "succeeded", "failed", "reconciliation-required"]),
  files: z.array(z.object({
    stableId: z.string(),
    fileName: z.string(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    status: fileStatusSchema,
    failureReason: z.string().optional(),
  }).readonly()).readonly(),
}).readonly()
const targetSchema = z.object({ token: z.string().uuid(), label: z.string().min(1) }).readonly()
const recoverySchema = z.object({
  inspected: z.number().int().nonnegative(),
  recovered: z.number().int().nonnegative(),
  reconciliationRequired: z.number().int().nonnegative(),
}).readonly()

export type SelectedOutputTarget = z.infer<typeof targetSchema>
export type OutputSaveOutcome = z.infer<typeof saveOutcomeSchema>
export type OutputRecoveryReport = z.infer<typeof recoverySchema>
export type OutputSelection = "a4-png" | "a4-pdf" | "card-pngs" | "cards-pdf"

export class NewsletterNativeOutputUnavailableError extends Error {
  readonly name = "NewsletterNativeOutputUnavailableError"
  constructor() { super("Newsletter 출력 저장은 Windows 앱에서 사용할 수 있습니다.") }
}

function requireNative(): void {
  if (!isTauri()) throw new NewsletterNativeOutputUnavailableError()
}

function encodeBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ""
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function selectedArtifacts(bundle: NewsletterOutputBundle, selection: OutputSelection): readonly OutputArtifact[] {
  switch (selection) {
    case "a4-png": return [bundle.a4Png]
    case "a4-pdf": return [bundle.a4Pdf]
    case "card-pngs": return bundle.cardPngs
    case "cards-pdf": return [bundle.cardsPdf]
  }
}

export async function pickNewsletterOutputTarget(): Promise<SelectedOutputTarget | null> {
  requireNative()
  const result = await invoke<unknown>("newsletter_output_pick_target")
  return result === null ? null : targetSchema.parse(result)
}

export async function saveNewsletterOutput(
  target: SelectedOutputTarget,
  bundle: NewsletterOutputBundle,
  selection: OutputSelection,
  collisionPolicy: "deny" | "replace",
): Promise<OutputSaveOutcome> {
  requireNative()
  const artifacts = selectedArtifacts(bundle, selection)
  const result = await invoke<unknown>("newsletter_output_save", {
    request: {
      targetToken: target.token,
      operationId: crypto.randomUUID(),
      projectId: bundle.manifest.projectId,
      projectRevision: bundle.manifest.projectRevision,
      designRevision: bundle.manifest.designRevision,
      profile: selection,
      profileVersion: 1,
      createdAt: new Date().toISOString(),
      collisionPolicy,
      artifacts: artifacts.map((artifact) => ({
        stableId: artifact.stableId,
        fileName: artifact.fileName,
        mediaType: artifact.mediaType,
        sha256: artifact.sha256,
        bytesBase64: encodeBase64(artifact.bytes),
      })),
    },
  })
  return saveOutcomeSchema.parse(result)
}

export async function getLastNewsletterOutput(projectId: string): Promise<OutputSaveOutcome | null> {
  requireNative()
  const result = await invoke<unknown>("newsletter_output_last_success", { projectId })
  return result === null ? null : saveOutcomeSchema.parse(result)
}

export async function recoverNewsletterOutputs(): Promise<OutputRecoveryReport> {
  requireNative()
  return recoverySchema.parse(await invoke<unknown>("newsletter_output_recover"))
}
