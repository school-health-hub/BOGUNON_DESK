import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root));

function pngSize(bytes: Buffer) {
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("BRAND-01 official product assets", () => {
  it("preserves the approved source bytes and opaque raster contract", async () => {
    const manifest = JSON.parse((await read("src/branding/assets/brand01-manifest.json")).toString("utf8"));
    const source = await read("src/branding/assets/bogunon-desk-logo-original.png");
    expect(createHash("sha256").update(source).digest("hex")).toBe(manifest.source.sha256);
    expect(manifest.source).toMatchObject({
      sha256: "73f26c85b6a5b463828a28afe668c7e5e4ecf493a2da8b6cd2912edc70720537",
      dimensions: [2172, 724],
      mode: "RGB",
      transparent: false,
    });
  });

  it.each([16, 24, 32, 48, 64, 128, 256])("includes a valid %ipx product symbol", async (size) => {
    expect(pngSize(await read(`src/branding/assets/icons/bogunon-desk-symbol-${size}.png`))).toEqual({ width: size, height: size });
  });

  it("embeds all required Windows ICO sizes", async () => {
    const ico = await read("src-tauri/icons/icon.ico");
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(7);
    const sizes = Array.from({ length: 7 }, (_, index) => {
      const width = ico[6 + index * 16];
      return width === 0 ? 256 : width;
    });
    expect(sizes).toEqual([16, 24, 32, 48, 64, 128, 256]);
  });

  it("connects BrowserWindow, tray and package resources to the official symbol", async () => {
    const main = (await read("electron-p0/main/main.mts")).toString("utf8");
    const build = (await read("scripts/electron-p0/build.mjs")).toString("utf8");
    const builder = JSON.parse((await read("electron-p0/builder.json")).toString("utf8"));
    expect(main).toContain("icon:join(app.getAppPath(),'app-icon.png')");
    expect(main).toContain("join(app.getAppPath(),'tray.png')");
    expect(build).toContain("src-tauri/icons/128x128@2x.png','build/electron-p0-app/app-icon.png'");
    expect(builder.files).toContain("app-icon.png");
    expect(builder.win.icon).toBe("src-tauri/icons/icon.ico");
  });
});
