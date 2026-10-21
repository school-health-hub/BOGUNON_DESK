import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CompactWorkspaceNotices, WorkspaceConnectionNotice, WorkspaceDataNotice } from "./WorkspaceDataNotice";

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


describe("connection-required presentation", () => {
  it("keeps standalone settings actions but consolidates desktop guidance", () => {
    const content = <WorkspaceConnectionNotice><button>설정 열기</button></WorkspaceConnectionNotice>;
    expect(renderToStaticMarkup(content)).toContain("설정 열기");
    const desktop = renderToStaticMarkup(<CompactWorkspaceNotices>{content}</CompactWorkspaceNotices>);
    expect(desktop).not.toContain("설정 열기");
    expect(desktop).toContain("연결 설정 대기");
  });
});
