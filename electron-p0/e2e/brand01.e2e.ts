import { expect, test, _electron as electron } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const evidenceDir = join(process.cwd(), "docs", "evidence", "brand01");

test("BRAND-01 official logo is consistent in the Windows Electron product", async () => {
  await mkdir(evidenceDir, { recursive: true });
  const app = await electron.launch({
    chromiumSandbox: true,
    args: [join(process.cwd(), "build", "electron-p0-app")],
    env: { ...process.env, ELECTRON_P0_TEST_RUN: randomUUID(), ELECTRON_P0_DEV_URL: "" },
  });

  try {
    const page = await app.firstWindow();
    const setup = page.getByRole("dialog", { name: "학교 초기 설정" });
    await expect(setup).toBeVisible();
    await setup.getByRole("button", { name: "나중에 설정" }).click();
    await expect(page.getByRole("navigation", { name: "주요 기능" })).toBeVisible();

    const iconStatus = await app.evaluate(({ BrowserWindow, nativeImage, app: electronApp }) => {
      const icon = nativeImage.createFromPath(`${electronApp.getAppPath()}\\app-icon.png`);
      return { empty: icon.isEmpty(), size: icon.getSize(), title: BrowserWindow.getAllWindows()[0].getTitle() };
    });
    expect(iconStatus).toEqual({ empty: false, size: { width: 256, height: 256 }, title: "BOGUNON DESK" });

    const headerLogo = page.locator(".rose-surface-header .brand-logo");
    await expect(headerLogo).toHaveAttribute("aria-label", "BOGUNON DESK");
    await expect(headerLogo.locator(".brand-logo__wordmark")).toBeVisible();
    await expect(page.locator('[data-dock-item="home"] .brand-symbol-icon')).toBeVisible();

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900));
    await page.screenshot({ path: join(evidenceDir, "workspace-1440x900.png") });

    await page.getByRole("button", { name: "설정", exact: true }).click();
    await page.getByRole("dialog", { name: "설정", exact: true }).getByRole("button", { name: "앱 정보", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "설정", exact: true }).getByRole("img", { name: "BOGUNON DESK" })).toBeVisible();
    await expect(page.getByText("BOGUNON DESK 2.0", { exact: true })).toBeVisible();
    await expect(page.getByText("내부 베타 · 버전 2.0.0-beta.2", { exact: true })).toBeVisible();
    await expect(page.getByText("고급 진단 정보", { exact: true })).toBeVisible();
    await page.screenshot({ path: join(evidenceDir, "settings-about-1440x900.png") });
    await page.keyboard.press("Escape");

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(980, 700));
    await expect(page.locator(".rose-surface-header .brand-logo__symbol")).toBeVisible();
    await expect(page.locator(".rose-surface-header .brand-logo__wordmark")).toBeHidden();
    await page.screenshot({ path: join(evidenceDir, "workspace-980x700.png") });
    await page.getByRole("button", { name: "업무 도구", exact: true }).last().click();
    await page.getByRole("button", { name: "공문작업실 · 로컬 초안", exact: true }).click();
    await expect(page.getByRole("main").getByRole("img", { name: "BOGUNON DESK" })).toBeVisible();
    await page.screenshot({ path: join(evidenceDir, "official-document-980x700.png") });

  } finally {
    await app.close();
  }
});
