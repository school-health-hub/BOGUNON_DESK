import { expect, _electron as electron, test, type ElectronApplication, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const appRoot = join(process.cwd(), "build/electron-p0-app");

async function palettePages(app: ElectronApplication): Promise<readonly Page[]> {
  await expect.poll(() => app.windows().filter((page) => page.url().includes("/renderer/palette/")).length).toBeGreaterThanOrEqual(2);
  const pages = app.windows().filter((page) => page.url().includes("/renderer/palette/"));
  await Promise.all(pages.map((page) => page.getByRole("main", { name: "BOGUNON DESK 바탕화면 위젯" }).waitFor()));
  return pages;
}

async function ownerPage(pages: readonly Page[], widgetId: string): Promise<Page> {
  for (const page of pages) {
    const surface = await page.evaluate(() => window.electronPalette.readSurface());
    if (surface.ownedWidgetIds.includes(widgetId)) return page;
  }
  throw new Error(`${widgetId} owner Palette was not found`);
}

test("UX-07E widget settings: card panel stages monitor changes and restores focus", async () => {
  const runId = randomUUID();
  const app = await electron.launch({
    chromiumSandbox: true,
    args: [appRoot],
    env: { ...process.env, ELECTRON_P0_TEST_RUN: runId, ELECTRON_P0_DEV_URL: "" },
  });
  try {
    const pages = await palettePages(app);
    const widgetId = "widget-quick-memo";
    let source = await ownerPage(pages, widgetId);
    const originalSurface = await source.evaluate(() => window.electronPalette.readSurface());

    await source.getByRole("button", { name: "위젯 편집" }).click();
    const trigger = source.getByRole("button", { name: "빠른 메모 설정 보기" });
    await trigger.click();
    const dialog = source.getByRole("dialog", { name: "빠른 메모 위젯 설정" });
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-controls", "widget-settings-panel");
    await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "위젯 설정 닫기" })).toBeFocused();
    await source.screenshot({ path: "artifacts/ux-07e-widget-settings/quick-memo-panel.png" });

    const monitor = dialog.getByLabel("표시 모니터");
    const values = await monitor.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    const current = await monitor.inputValue();
    const target = values.find((value) => value !== current);
    expect(target).toBeTruthy();
    await monitor.selectOption(target!);
    await expect(dialog.getByText("저장하지 않은 변경사항이 있습니다.")).toBeVisible();
    expect(await source.evaluate(() => window.electronPalette.readSurface())).toEqual(originalSurface);

    await source.keyboard.press("Escape");
    const confirmation = source.getByRole("alert").filter({ hasText: "닫으면 이번 변경은 적용되지 않습니다." });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "계속 편집" }).click();
    await expect(dialog).toBeVisible();
    await source.keyboard.press("Escape");
    await confirmation.getByRole("button", { name: "변경 취소하고 닫기" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await source.evaluate(() => window.electronPalette.readSurface())).toEqual(originalSurface);

    await trigger.click();
    const saveDialog = source.getByRole("dialog", { name: "빠른 메모 위젯 설정" });
    await saveDialog.getByLabel("표시 모니터").selectOption(target!);
    await saveDialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(saveDialog).toHaveCount(0);
    await expect.poll(async () => (await source.evaluate(() => window.electronPalette.readSurface())).ownedWidgetIds.includes(widgetId)).toBe(false);

    let destination = await ownerPage(pages, widgetId);
    await destination.getByRole("button", { name: "위젯 편집" }).click();
    const destinationTrigger = destination.getByRole("button", { name: "빠른 메모 설정 보기" });
    await destinationTrigger.click();
    const returnDialog = destination.getByRole("dialog", { name: "빠른 메모 위젯 설정" });
    await returnDialog.getByLabel("표시 모니터").selectOption(current);
    await returnDialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect.poll(async () => (await source.evaluate(() => window.electronPalette.readSurface())).ownedWidgetIds.includes(widgetId)).toBe(true);

    source = await ownerPage(pages, widgetId);
    if (await source.getByRole("button", { name: "위젯 편집" }).count()) await source.getByRole("button", { name: "위젯 편집" }).click();
    await source.getByRole("button", { name: "빠른 메모 설정 보기" }).click();
    const compactDialog = source.getByRole("dialog", { name: "빠른 메모 위젯 설정" });
    const originalBounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
      .filter((window) => window.webContents.getTitle().includes("Desktop Palette"))
      .map((window) => ({ id: window.id, bounds: window.getBounds() })));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
      .filter((window) => window.webContents.getTitle().includes("Desktop Palette"))
      .forEach((window) => window.setContentSize(980, 700)));
    await expect.poll(() => compactDialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
    })).toBe(true);
    expect(await compactDialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await expect(compactDialog.getByRole("button", { name: "저장", exact: true })).toBeInViewport();
    await source.screenshot({ path: "artifacts/ux-07e-widget-settings/quick-memo-panel-980x700.png" });
    await app.evaluate(({ BrowserWindow }, saved) => saved.forEach(({ id, bounds }) => BrowserWindow.fromId(id)?.setBounds(bounds)), originalBounds);
  } finally {
    await app.close();
  }
});
