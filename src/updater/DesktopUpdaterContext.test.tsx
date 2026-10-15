// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopUpdaterProvider, useDesktopUpdater } from "./DesktopUpdaterContext";

const UpdaterProbe = () => {
  const updater = useDesktopUpdater();
  return (
    <div>
      <span>{updater.enabled ? "enabled" : "disabled"}</span>
      <button type="button" onClick={() => void updater.startupCheck()}>startup</button>
      <button type="button" onClick={() => void updater.manualCheck()}>manual</button>
      <button type="button" onClick={() => void updater.confirmInstall()}>install</button>
    </div>
  );
};

afterEach(cleanup);

describe("DesktopUpdaterProvider", () => {
  it("stays disabled when a production frontend runs under a non-production identity", async () => {
    const resolveCapability = vi.fn().mockResolvedValue(false);
    render(
      <DesktopUpdaterProvider mode="production" resolveCapability={resolveCapability}>
        <UpdaterProbe />
      </DesktopUpdaterProvider>,
    );

    await waitFor(() => expect(resolveCapability).toHaveBeenCalledOnce());
    expect(screen.getByText("disabled")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "startup" }));
    fireEvent.click(screen.getByRole("button", { name: "manual" }));
    fireEvent.click(screen.getByRole("button", { name: "install" }));

    expect(screen.getByText("disabled")).toBeTruthy();
  });

  it("does not query native capability in development mode", async () => {
    const resolveCapability = vi.fn().mockResolvedValue(true);
    render(
      <DesktopUpdaterProvider mode="desktop-dev" resolveCapability={resolveCapability}>
        <UpdaterProbe />
      </DesktopUpdaterProvider>,
    );

    await Promise.resolve();
    expect(screen.getByText("disabled")).toBeTruthy();
    expect(resolveCapability).not.toHaveBeenCalled();
  });
});
