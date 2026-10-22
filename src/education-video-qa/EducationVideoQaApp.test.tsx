// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EducationVideoQaApp } from "./EducationVideoQaApp";

const api = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: api.invoke }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("runs Finder IPC only after the isolated native identity is verified", async () => {
  let loadCount = 0;
  api.invoke.mockImplementation(async (command: string) => {
    if (command === "education_video_qa_info") {
      return {
        identifier: "kr.sungandi.schoolhealthdesk.educationvideoqa",
        sourceSha: "a".repeat(40),
        localData: "synthetic-qa-local",
        integrationsDisabled: true,
      };
    }
    if (command === "education_video_search") {
      throw { code: "REAL_DISPATCH_DISABLED" };
    }
    if (command === "education_video_library_load") {
      loadCount += 1;
      if (loadCount === 1) return { library: { version: 2, entries: [] }, recovered: false };
      return { library: { version: 2, entries: [{ videoId: "qaVideo0001" }] }, recovered: false };
    }
    if (command === "education_video_library_save") {
      return { library: { version: 2, entries: [{ videoId: "qaVideo0001" }] }, recovered: false };
    }
    if (command === "education_video_library_export") {
      return JSON.stringify({ version: 2, entries: [{ videoId: "qaVideo0001" }] });
    }
    if (command === "education_video_library_import") {
      return { library: { version: 2, entries: [{ videoId: "qaVideo0001" }, { videoId: "qaVideo0002" }] }, recovered: false };
    }
    if (command === "education_video_library_recover") {
      return { library: { version: 2, entries: [{ videoId: "qaVideo0001" }] }, recovered: true };
    }
    if (command === "education_video_qa_complete") {
      return "qa-report.json";
    }
    return null;
  });

  render(<EducationVideoQaApp />);

  await screen.findByText("7 PASS / 0 FAIL");
  expect(api.invoke).toHaveBeenNthCalledWith(1, "education_video_qa_info");
  expect(api.invoke.mock.calls.map(([command]) => command)).toContain("education_video_search");
  expect(api.invoke.mock.calls.map(([command]) => command)).toContain("education_video_library_recover");
});

it("fails closed before Finder IPC when native isolation is invalid", async () => {
  api.invoke.mockResolvedValue({
    identifier: "kr.sungandi.schoolhealthdesk",
    sourceSha: "a".repeat(40),
    localData: "production-data",
    integrationsDisabled: false,
  });

  render(<EducationVideoQaApp />);

  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(api.invoke).toHaveBeenCalledTimes(1);
});
