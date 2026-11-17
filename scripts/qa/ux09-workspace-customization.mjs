import { _electron as electron } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const outputRoot = resolve(process.env.UX09_EVIDENCE_ROOT ?? "artifacts/ux09-workspace-customization");
const runnerTemp = resolve(process.env.UX09_RUNNER_TEMP ?? join(outputRoot, "runner-temp"));
const qaRoot = join(runnerTemp, "qa-profile");
const runId = randomUUID();
const sizes = [[1440, 900], [1366, 768], [1280, 720], [980, 700]];
const report = { runId, source: "working tree", profile: "", captures: [], checks: {}, errors: [] };
await mkdir(join(outputRoot, "screenshots"), { recursive: true });
await mkdir(qaRoot, { recursive: true });

const application = await electron.launch({
  executablePath: process.env.ELECTRON_P0_EXECUTABLE ?? resolve("node_modules/electron/dist/electron.exe"),
  args: [resolve("build/electron-p0-app")],
  chromiumSandbox: true,
  env: {
    ...process.env,
    ELECTRON_P0_DEV_URL: "",
    ELECTRON_P0_QA_PROFILE: "1",
    ELECTRON_P0_QA_ROOT: qaRoot,
    ELECTRON_P0_TEST_RUN: runId,
    RUNNER_TEMP: runnerTemp,
    NODE_ENV: "production",
  },
});

try {
  const page = await application.firstWindow();
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.getByRole("navigation", { name: "주요 기능" }).waitFor();
  const later = page.getByRole("button", { name: "나중에 설정", exact: true });
  if (await later.count()) await later.click();
  const info = await page.evaluate(() => window.electronP0.info());
  if (!info.userData.includes(runId)) throw new Error("UX-09 QA profile isolation failed");
  report.profile = info.userData;

  await page.getByRole("navigation", { name: "주요 기능" }).locator('button[data-dock-item="toolbox"]').click();
  await page.getByRole("dialog", { name: "업무 도구" }).waitFor();

  for (const [width, height] of sizes) {
    await application.evaluate(({ BrowserWindow }, requested) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.unmaximize();
      window.webContents.setZoomFactor(1);
      window.setContentSize(requested.width, requested.height);
    }, { width, height });
    await page.waitForTimeout(200);
    const metrics = await page.evaluate(() => {
      const dialog = document.querySelector(".rose-dialog-content");
      const cards = [...document.querySelectorAll(".ux09-tool-group .p0-tool-card")];
      return {
        content: { width: innerWidth, height: innerHeight },
        horizontalOverflow: dialog === null ? null : dialog.scrollWidth - dialog.clientWidth,
        verticalScrollAvailable: dialog === null ? false : dialog.scrollHeight > dialog.clientHeight,
        cardCount: cards.length,
        clippedCards: cards.filter((card) => {
          const box = card.getBoundingClientRect();
          return box.width <= 0 || box.height <= 0;
        }).length,
      };
    });
    const file = `toolbox-${width}x${height}.png`;
    const path = join(outputRoot, "screenshots", file);
    await page.screenshot({ path });
    const sha256 = createHash("sha256").update(await readFile(path)).digest("hex");
    report.captures.push({ file: `screenshots/${file}`, sha256, ...metrics });
  }

  const search = page.getByRole("searchbox", { name: "업무 도구 검색" });
  await search.fill("공문");
  report.checks.search = {
    officialDocumentVisible: await page.getByRole("button", { name: "공문작업실" }).isVisible(),
    calculatorHidden: await page.getByRole("button", { name: "업무 계산기" }).count() === 0,
  };
  await search.fill("");
  report.checks.newsletterFirstScreen = await page.getByRole("button", { name: "보건소식지 제작소" }).isVisible();

  await page.getByRole("button", { name: "위젯 표시 설정" }).click();
  await page.getByRole("complementary", { name: "위젯 편집" }).waitFor();
  const before = await page.getByRole("complementary", { name: "위젯 편집" }).locator("article").count();
  const hide = page.getByRole("button", { name: "숨기기" }).first();
  await hide.click();
  const restore = page.getByRole("button", { name: "표시" }).first();
  await restore.click();
  const after = await page.getByRole("complementary", { name: "위젯 편집" }).locator("article").count();
  report.checks.widgetVisibility = { before, after, preserved: before === 13 && after === 13 };
  const drawerPath = join(outputRoot, "screenshots", "widget-library-980x700.png");
  await page.screenshot({ path: drawerPath });
  report.captures.push({
    file: "screenshots/widget-library-980x700.png",
    sha256: createHash("sha256").update(await readFile(drawerPath)).digest("hex"),
    content: { width: 980, height: 700 },
  });
} finally {
  await application.close();
}

report.checks.processClosed = true;
await writeFile(join(outputRoot, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
