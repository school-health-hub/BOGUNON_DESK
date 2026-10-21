// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReferencePackageStartup } from "./ReferencePackageStartup";
import { ReferencePackageRestoreError } from "./referencePackageService";

afterEach(cleanup);

describe("reference package startup", () => {
  it("starts saved-package revalidation without opening the document panel", async () => {
    const initialize = vi.fn(async () => undefined);

    const view = render(<ReferencePackageStartup initialize={initialize} />);

    await waitFor(() => expect(initialize).toHaveBeenCalledOnce());
    expect(view.container.textContent).toBe("");
  });

  it("leaves a rejected saved package unavailable without blocking the workspace", async () => {
    const initialize = vi.fn(async () => { throw new ReferencePackageRestoreError(); });

    const view = render(<ReferencePackageStartup initialize={initialize} />);

    await waitFor(() => expect(initialize).toHaveBeenCalledOnce());
    expect(view.container.textContent).toBe("");
  });
});
