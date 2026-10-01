import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OnboardingDialog } from "./OnboardingDialog";

const renderDialog = (step: 1 | 2 | 3, authStatus: "signedOut" | "signedIn" = "signedOut") => renderToStaticMarkup(
  <OnboardingDialog
    authStatus={authStatus}
    error={null}
    step={step}
    onBack={vi.fn()}
    onComplete={vi.fn()}
    onConnectGoogle={vi.fn()}
    onNext={vi.fn()}
  />,
);

describe("first-run onboarding", () => {
  it("introduces the implemented desktop workspace in step one", () => {
    const markup = renderDialog(1);
    expect(markup).toContain("BOGUNON DESK에 오신 것을 환영합니다");
    expect(markup).toContain("보건교사를 위한 데스크톱 워크스페이스");
    expect(markup).toContain("공문 작업실");
    expect(markup).toContain("품의 도우미");
    expect(markup).toContain("화면 꾸미기");
  });

  it("keeps account connection optional in step two", () => {
    const markup = renderDialog(2);
    expect(markup).toContain("Google 계정 연결");
    expect(markup).toContain("나중에 연결");
    expect(markup).toContain("업무·일정과 화면 설정");
  });

  it("shows the local-processing and privacy boundaries before starting", () => {
    const markup = renderDialog(3);
    expect(markup).toContain("학생 건강기록 시스템이 아닙니다");
    expect(markup).toContain("공문/품의 원본 파일은 자동 업로드하지 않습니다");
    expect(markup).toContain("AI API Key는 앱 종료 시 삭제됩니다");
    expect(markup).toContain("시작하기");
  });
});
