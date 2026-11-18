import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_ID, PRODUCT_NAME, PROFILE_NAME } from '../protocol';

const electronPackage = JSON.parse(readFileSync('electron-p0/package.json', 'utf8')) as Record<string, unknown>;
const builder = JSON.parse(readFileSync('electron-p0/builder.json', 'utf8')) as Record<string, unknown>;

describe('INT-05B product identity', () => {
  it('uses the release product name and beta version in packaged metadata', () => {
    expect(electronPackage).toMatchObject({
      version: '2.0.0-beta.1',
      description: 'BOGUNON DESK 2.0 school health workspace',
    });
    expect(builder).toMatchObject({
      productName: 'BOGUNON DESK',
      artifactName: 'BOGUNON-DESK-${version}-${os}-${arch}.${ext}',
      nsis: {
        shortcutName: 'BOGUNON DESK',
        uninstallDisplayName: 'BOGUNON DESK',
        artifactName: 'BOGUNON-DESK-Setup-${version}-${arch}.${ext}',
      },
    });
  });

  it('keeps the existing Windows identity and profile while changing only the display name', () => {
    expect(PRODUCT_NAME).toBe('BOGUNON DESK');
    expect(APP_ID).toBe('kr.sungandi.schoolhealthdesk.electronp0');
    expect(PROFILE_NAME).toBe('BOGUNON-DESK-ELECTRON-P0');
  });
});
