import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn(() => true) }))
vi.mock("@tauri-apps/api/core", () => mocks)

import type { NewsletterOutputBundle, OutputArtifact } from "./outputEngine"
import { pickNewsletterOutputTarget, saveNewsletterOutput } from "./storageClient"

function artifact(stableId: string, fileName: string): OutputArtifact {
  return {
    stableId,
    fileName,
    mediaType: fileName.endsWith(".pdf") ? "application/pdf" : "image/png",
    bytes: new Uint8Array([1, 2, 3]),
    sha256: "a".repeat(64),
  }
}

function bundle(): NewsletterOutputBundle {
  const cards = Array.from({ length: 7 }, (_, index) => artifact(`card-${index}`, `${index}.png`))
  return {
    a4Png: artifact("a4-page", "a4.png"),
    cardPngs: cards,
    a4Pdf: artifact("a4-pdf", "a4.pdf"),
    cardsPdf: artifact("cards-pdf", "cards.pdf"),
    manifest: {
      projectId: "newsletter-project",
      projectRevision: 2,
      designRevision: 3,
      templateVersion: 1,
      assetSha256: [],
      createdAt: "2026-10-26T00:00:00.000Z",
      outputs: [],
    },
  }
}

describe("Newsletter native output storage client", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.isTauri.mockReturnValue(true) })

  it("returns null when folder selection is cancelled", async () => {
    mocks.invoke.mockResolvedValueOnce(null)

    await expect(pickNewsletterOutputTarget()).resolves.toBeNull()
  })

  it("sends exactly seven card PNG artifacts", async () => {
    mocks.invoke.mockResolvedValueOnce({
      operationId: "operation-1",
      projectId: "newsletter-project",
      projectRevision: 2,
      designRevision: 3,
      profile: "card-pngs",
      profileVersion: 1,
      createdAt: "2026-10-26T00:00:00.000Z",
      targetLabel: "QA",
      status: "succeeded",
      files: Array.from({ length: 7 }, (_, index) => ({ stableId: `card-${index}`, fileName: `${index}.png`, sha256: "a".repeat(64), status: "saved" })),
    })

    const result = await saveNewsletterOutput(
      { token: "550e8400-e29b-41d4-a716-446655440000", label: "QA" },
      bundle(),
      "card-pngs",
      "deny",
    )

    const call = mocks.invoke.mock.calls[0]
    expect(call?.[0]).toBe("newsletter_output_save")
    expect(call?.[1].request.artifacts).toHaveLength(7)
    expect(result.status).toBe("succeeded")
  })
})
