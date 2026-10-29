import { describe, expect, it } from "vitest";
import { classifyEditFailure } from "./editFailure";

describe("QA edit failure classification", () => {
  it.each(["caller_denied", "runtime_inactive", "frame_write_failed"] as const)("preserves only fixed backend code %s", code => {
    expect(classifyEditFailure(code)).toBe(code);
  });
  it("distinguishes pre-handler ACL rejection from handler failures", () => {
    expect(classifyEditFailure("Command begin_desktop_surface_edit not allowed by ACL")).toBe("acl_denied");
  });
  it.each([new Error("private-path"), { capability: "private" }, "private-path", null, "Command other not allowed by ACL"])("never exposes unrecognized errors", error => {
    expect(classifyEditFailure(error)).toBe("unknown");
  });
});
