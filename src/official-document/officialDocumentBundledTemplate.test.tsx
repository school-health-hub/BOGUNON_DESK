// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfficialDocumentOutput } from "../components/desktop/OfficialDocumentOutput";
import { saveOfficialDocumentOdt } from "./officialDocumentExportService";
import { createEmptyOfficialDocumentInput, generateOfficialDocumentDraft } from "./documentGenerator";

describe("bundled home-v1 save routing", () => {
  it("uses bundled bytes by default without adding a template path to the request", async () => {
    const draft = generateOfficialDocumentDraft(createEmptyOfficialDocumentInput());
    const invoke = vi.fn().mockResolvedValue({ status: "cancelled" });
    await expect(saveOfficialDocumentOdt(draft, invoke)).resolves.toEqual({ status: "cancelled" });
    expect(invoke).toHaveBeenCalledWith("save_official_document_odt_with_default_template", {
      request: { title: draft.title, body: draft.body, attachments: draft.attachments, hasTableText: false },
    });
  });

  it("retains the manual file picker command when explicitly selected", async () => {
    const invoke = vi.fn().mockResolvedValue({ status: "saved", fileName: "synthetic.odt" });
    await saveOfficialDocumentOdt(generateOfficialDocumentDraft(createEmptyOfficialDocumentInput()), invoke, true);
    expect(invoke.mock.calls[0]?.[0]).toBe("save_official_document_odt");
  });

  it("offers default save and manual selection independently without changing the draft", () => {
    const draft = generateOfficialDocumentDraft(createEmptyOfficialDocumentInput());
    const onExportOdt = vi.fn();
    const view = render(<OfficialDocumentOutput aiResponse="" aiStatus="idle" draft={draft}
      isExportingOdt={false} localSummary={null} mode="create" onCopy={vi.fn()}
      onExportOdt={onExportOdt} onSendSummaryToQuickAdd={vi.fn()} prompt="" />);
    fireEvent.click(screen.getByRole("button", { name: "K-에듀파인용 ODT 저장" }));
    expect(onExportOdt).toHaveBeenNthCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "다른 승인 서식 선택 후 저장" }));
    expect(onExportOdt).toHaveBeenNthCalledWith(2, true);
    expect(screen.getByRole("heading", { name: draft.title })).toBeTruthy();
    view.unmount();
  });
});
