import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CompactWorkspaceNotices, WorkspaceDataNotice } from "./WorkspaceDataNotice";

describe("desktop connection notice scope", () => {
  it("keeps the standalone connection guidance outside the desktop", () => {
    expect(renderToStaticMarkup(<WorkspaceDataNotice state={{ status: "signedOut" }} />)).toContain("Google 계정을 연결하면");
  });
  it("uses a short placeholder without duplicating the desktop instruction", () => {
    const html = renderToStaticMarkup(<CompactWorkspaceNotices><WorkspaceDataNotice state={{ status: "signedOut" }} /></CompactWorkspaceNotices>);
    expect(html).toContain('<span class="sr-only">계정 연결 대기</span>');
    expect(html).toContain('<span aria-hidden="true">—</span>');
    expect(html).not.toContain("연결 후 표시됩니다.");
    expect(html).not.toContain("Google");
  });
  it("retains loading feedback inside the desktop", () => {
    expect(renderToStaticMarkup(<CompactWorkspaceNotices><WorkspaceDataNotice state={{ status: "loading" }} /></CompactWorkspaceNotices>)).toContain("불러오는 중");
  });
});
