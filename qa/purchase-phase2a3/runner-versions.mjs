import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const browser = await chromium.launch({ headless: false });
try {
  await writeFile(join(process.env.EVIDENCE_DIR, 'browser-versions.json'), JSON.stringify({
    node: process.version,
    headless: false,
    chromium: browser.version(),
    executable: chromium.executablePath(),
    productSHA: process.env.PRODUCT_SHA,
    controllerSHA: process.env.CONTROLLER_SHA,
  }, null, 2));
} finally {
  await browser.close();
}
