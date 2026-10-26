// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EducationVideoQaApp } from "./EducationVideoQaApp";

const api = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: api.invoke, isTauri: () => true }));

const emptyLibrary = { library: { version: 2, entries: [] }, recovered: false };
const savedLibrary = {
  library: {
    version: 2,
    entries: [{
      videoId: "qaVideo0001",
      teacher: {
        educationTitle: "손씻기 교육",
        target: "초등학생",
        schedule: "10월 23일 1교시",
        instructions: "각 교실에서 시청해 주세요.",
        message: "수정한 안내문",
        notes: "QA 메모",
      },
      provider: {
        title: "손씻기 합성 교육영상",
        channelId: "qa-synthetic-channel",
        channelTitle: "합성 보건교육 채널",
        durationSeconds: 600,
        url: "https://www.youtube.com/watch?v=qaVideo0001",
        source: "synthetic-mock",
        official: false,
        officialEvidence: null,
        synthetic: true,
        fetchedAt: "2026-10-22T00:00:00.000Z",
        expiresAt: "2026-11-20T00:00:00.000Z",
      },
    }],
  },
  recovered: false,
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

it("drives the real Finder UI through QA search, message, copy and native save", async () => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  api.invoke.mockImplementation(async (command: string) => {
    if (command === "education_video_qa_info") return {
      identifier: "kr.sungandi.schoolhealthdesk.educationvideoqa",
      sourceSha: "a".repeat(40),
      localData: "synthetic-qa-local",
      integrationsDisabled: true,
    };
    if (command === "education_video_library_load") return emptyLibrary;
    if (command === "education_video_qa_search") return {
      source: "synthetic-mock",
      notice: "합성 QA 검색 결과입니다.",
      results: [{
        videoId: "qaVideo0001",
        title: "손씻기 합성 교육영상",
        channelId: "qa-synthetic-channel",
        channelTitle: "합성 보건교육 채널",
        durationSeconds: 600,
        url: "https://www.youtube.com/watch?v=qaVideo0001",
        official: false,
        officialEvidence: null,
        synthetic: true,
        fetchedAt: "2026-10-22T00:00:00.000Z",
      }],
    };
    if (command === "education_video_library_save") return savedLibrary;
    return null;
  });

  render(<EducationVideoQaApp />);

  await screen.findByRole("heading", { name: /AI 교육영상 Finder/ });
  fireEvent.change(screen.getByLabelText("교육 주제"), { target: { value: "손씻기" } });
  fireEvent.change(screen.getByLabelText("검색 대상"), { target: { value: "초등학생" } });
  fireEvent.click(screen.getByRole("button", { name: "QA 합성 영상 검색" }));
  await screen.findByText("손씻기 합성 교육영상");
  fireEvent.click(screen.getByRole("button", { name: /선택$/ }));
  fireEvent.change(screen.getByLabelText("교육 일시 또는 시청 기간"), { target: { value: "10월 23일 1교시" } });
  fireEvent.change(screen.getByLabelText("안내사항"), { target: { value: "각 교실에서 시청해 주세요." } });
  fireEvent.click(screen.getByRole("button", { name: "안내문 생성" }));
  fireEvent.change(screen.getByLabelText("안내문 직접 수정"), { target: { value: "수정한 안내문" } });
  fireEvent.change(screen.getByLabelText("사용자 메모"), { target: { value: "QA 메모" } });
  fireEvent.click(screen.getByLabelText(/합성 링크와 안내문 내용을 확인했습니다/));
  fireEvent.click(screen.getByRole("button", { name: "안내문 복사" }));
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("수정한 안내문"));
  fireEvent.click(screen.getByRole("button", { name: "라이브러리 저장" }));
  await waitFor(() => expect(api.invoke).toHaveBeenCalledWith("education_video_library_save", expect.objectContaining({ entry: expect.objectContaining({ videoId: "qaVideo0001" }) })));
});

it("fails closed before rendering Finder when native isolation is invalid", async () => {
  api.invoke.mockResolvedValue({
    identifier: "kr.sungandi.schoolhealthdesk",
    sourceSha: "a".repeat(40),
    localData: "production-data",
    integrationsDisabled: false,
  });

  render(<EducationVideoQaApp />);

  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.queryByLabelText("교육 주제")).toBeNull();
  expect(api.invoke).toHaveBeenCalledTimes(1);
});
