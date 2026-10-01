import { describe, expect, it, vi } from "vitest";
import type { AccountLauncherLinks } from "../settings/types";
import { runExternalDesktopAction, type ExternalDesktopActionDependencies } from "./runExternalDesktopAction";

const configuredLinks = {
  onlineHealthRoomUrl: "https://health.example.com/",
  bogunonUrl: "https://bogunon.example.com/",
  checkupToolUrl: "https://checkup.example.com/",
} as const;

const createDependencies = (
  launcherLinks: AccountLauncherLinks,
) => {
  const execute = vi.fn(async () => ({ status: "completed" as const, message: null }));
  const onPrepareLaunch = vi.fn();
  const onUnavailable = vi.fn();
  return {
    dependencies: {
      execute,
      loadLauncherLinks: async () => launcherLinks,
      onPrepareLaunch,
      onUnavailable,
    } satisfies ExternalDesktopActionDependencies,
    execute,
    onPrepareLaunch,
    onUnavailable,
  };
};

describe("external desktop action runner", () => {
  it("opens the targeted connection setting without invoking a missing launcher", async () => {
    const fixture = createDependencies({ ...configuredLinks, bogunonUrl: null });

    await expect(runExternalDesktopAction("bogunon", fixture.dependencies)).resolves.toBeNull();
    expect(fixture.onUnavailable).toHaveBeenCalledWith(
      "BOGUNON이 아직 연결되지 않았습니다.",
      "bogunon",
    );
    expect(fixture.onPrepareLaunch).not.toHaveBeenCalled();
    expect(fixture.execute).not.toHaveBeenCalled();
  });

  it("closes transient navigation before delegating a configured action", async () => {
    const fixture = createDependencies(configuredLinks);

    await runExternalDesktopAction("online-health-room", fixture.dependencies);

    expect(fixture.onUnavailable).not.toHaveBeenCalled();
    expect(fixture.onPrepareLaunch).toHaveBeenCalledOnce();
    expect(fixture.execute).toHaveBeenCalledWith("online-health-room");
    expect(fixture.onPrepareLaunch.mock.invocationCallOrder[0]).toBeLessThan(
      fixture.execute.mock.invocationCallOrder[0],
    );
  });
});
