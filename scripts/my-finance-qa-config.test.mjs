import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
it("keeps the operating identity unchanged and isolates QA storage and integrations", async () => {
  const prod=JSON.parse(await read("src-tauri/tauri.conf.json"));
  const qa=JSON.parse(await read("src-tauri/tauri.my-finance-qa.conf.json"));
  expect(prod.identifier).toBe("kr.sungandi.schoolhealthdesk"); expect(prod.productName).toBe("BOGUNON DESK");
  expect(qa.identifier).not.toBe(prod.identifier); expect(qa.productName).not.toBe(prod.productName);
  expect(qa.mainBinaryName).toBe("bogunon-desk-my-finance-qa");
  expect(qa.plugins).toEqual({ updater: null, "deep-link": null });
  expect(qa.app.security.capabilities.flatMap(c=>c.permissions).some(p=>/updater|deep-link|autostart/.test(p))).toBe(false);
  expect(JSON.stringify(qa.app.security.csp)).not.toMatch(/https:|supabase|bogunon\.vercel/);
  const native=await read("src-tauri/src/my_finance_qa.rs");
  expect(native).not.toMatch(/\.plugin\(tauri_plugin_(updater|autostart|deep_link|notification|store)/);
  expect(native).not.toContain("create_tray");
});
