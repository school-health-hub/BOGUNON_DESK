import { expect, test, _electron as electron } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const evidenceRoot = join(process.cwd(), "docs", "evidence", "ux08-1-workspace-navigation");
const screenshotsDir = join(evidenceRoot, "screenshots");
const sizes = [[1440, 900], [980, 700], [900, 680]] as const;

test("UX-08-1 workspace chrome remains usable at the approved Windows sizes", async () => {
  await mkdir(screenshotsDir, { recursive: true });
  const runId = randomUUID();
  const app = await electron.launch({
    chromiumSandbox: true,
    args: [join(process.cwd(), "build", "electron-p0-app")],
    env: { ...process.env, ELECTRON_P0_TEST_RUN: runId, ELECTRON_P0_DEV_URL: "" },
  });
  const captures: Array<Record<string, unknown>> = [];
  const rendererErrors: string[] = [];

  try {
    const page = await app.firstWindow();
    page.on("pageerror", error => rendererErrors.push(`pageerror:${error.message}`));
    page.on("console", message => {
      if (message.type() === "error") rendererErrors.push(`console:${message.text()}`);
    });
    const setup = page.getByRole("dialog", { name: "학교 초기 설정" });
    await expect(setup).toBeVisible();
    await setup.getByRole("button", { name: "나중에 설정" }).click();
    const dock = page.getByRole("navigation", { name: "주요 기능" });
    await expect(dock).toBeVisible();

    const capture = async (name: string, width: number, height: number) => {
      await app.evaluate(({ BrowserWindow }, value) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.unmaximize();
        window.webContents.setZoomFactor(1);
        window.setContentSize(value.width, value.height);
      }, { width, height });
      await page.waitForTimeout(150);
      const geometry = await page.evaluate(() => ({
        innerWidth,
        innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth);
      const windowBounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
      const file = `${name}-${width}x${height}.png`;
      const path = join(screenshotsDir, file);
      await page.screenshot({ path });
      const sha256 = createHash("sha256").update(await readFile(path)).digest("hex");
      captures.push({ name, requestedContent: { width, height }, geometry, windowBounds, file: `screenshots/${file}`, sha256 });
    };

    for (const [width, height] of sizes) {
      await expect(page.locator(".rose-surface-header .brand-logo")).toHaveAttribute("aria-label", "BOGUNON DESK");
      await expect(page.locator('[data-dock-item="home"] .brand-symbol-icon')).toBeVisible();
      await capture("dashboard-dock", width, height);

      await dock.getByRole("button", { name: "업무 도구", exact: true }).click();
      const toolbox = page.getByRole("dialog", { name: "업무 도구", exact: true });
      await expect(toolbox).toBeVisible();
      await expect(toolbox.getByRole("button", { name: /공문작업실 · 로컬 초안/ })).toBeVisible();
      await capture("toolbox", width, height);
      await page.keyboard.press("Escape");
      await expect(toolbox).toBeHidden();

      await dock.getByRole("button", { name: "설정", exact: true }).click();
      const settings = page.getByRole("dialog", { name: "설정", exact: true });
      await expect(settings).toBeVisible();
      await expect(settings.getByRole("navigation", { name: "설정 카테고리" })).toBeVisible();
      await capture("settings", width, height);
      await page.keyboard.press("Escape");
      await expect(settings).toBeHidden();

      await dock.getByRole("button", { name: "업무 도구", exact: true }).click();
      await page.getByRole("dialog", { name: "업무 도구", exact: true }).getByRole("button", { name: /공문작업실 · 로컬 초안/ }).click();
      const official = page.locator("main.od-workspace");
      await expect(official.getByRole("heading", { name: "공문작업실", exact: true })).toBeVisible();
      await expect(official.getByRole("img", { name: "BOGUNON DESK" })).toBeVisible();
      const back = official.getByRole("button", { name: "보건 업무로", exact: true });
      await expect(back).toBeVisible();
      await expect(official.getByText("로컬 편집 · AI 전송은 별도 확인", { exact: true })).toBeVisible();
      await capture("official-document", width, height);

      const firstTextInput = official.locator("input").first();
      await firstTextInput.fill("합성 검증 입력");
      page.once("dialog", dialog => dialog.dismiss());
      await back.click();
      await expect(official).toBeVisible();
      await expect(firstTextInput).toHaveValue("합성 검증 입력");
      page.once("dialog", dialog => dialog.accept());
      await back.click();
      await expect(official).toBeHidden();
      await expect(dock).toBeVisible();
    }

    expect(rendererErrors).toEqual([]);
    const iconStatus = await app.evaluate(({ BrowserWindow, nativeImage, app: electronApp }) => {
      const icon = nativeImage.createFromPath(`${electronApp.getAppPath()}\\app-icon.png`);
      return { empty: icon.isEmpty(), size: icon.getSize(), title: BrowserWindow.getAllWindows()[0].getTitle() };
    });
    expect(iconStatus.empty).toBe(false);
    await writeFile(join(evidenceRoot, "manifest.json"), JSON.stringify({
      schemaVersion: 1,
      sourceHead: process.env.UX08_SOURCE_HEAD ?? "recorded-by-runner",
      runId,
      surfaces: ["dashboard-dock", "toolbox", "settings", "official-document"],
      sizes: sizes.map(([width, height]) => ({ width, height })),
      captures,
      rendererErrors,
      iconStatus,
      privacy: "Synthetic isolated Electron profile; no school, user, or operating profile data.",
    }, null, 2));
  } finally {
    await app.close();
  }
});
