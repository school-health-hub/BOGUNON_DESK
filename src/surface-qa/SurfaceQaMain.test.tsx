import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SurfaceQaMain } from "./SurfaceQaMain";

describe("SurfaceQaMain", () => {
  it("labels the shell as synthetic-only and exposes source provenance", () => {
    render(<SurfaceQaMain sourceSha="9941e91076e1d6ef352c001cca233de0b60b9b21" />);

    expect(screen.getByText("SYNTHETIC ONLY")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Desktop Surface QA" })).toBeTruthy();
    expect(screen.getByText("9941e91076e1")).toBeTruthy();
  });

  it("presents only the three isolated QA readiness statements", () => {
    render(<SurfaceQaMain sourceSha="NOT_BUILT" />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("합성 projection")).toBeTruthy();
    expect(screen.getByText("운영 저장소 분리")).toBeTruthy();
    expect(screen.getByText("Surface 연결 대기")).toBeTruthy();
  });
});
