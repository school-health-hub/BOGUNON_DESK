import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  BINARY_NAMES,
  QA_IDENTIFIER,
  createPortablePackage,
  verifyPortablePackage,
} from './package-surface-qa-portable.mjs';

const roots = [];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'surface-qa-package-'));
  roots.push(root);
  const input = path.join(root, 'input');
  const bundle = path.join(input, 'surface');
  const output = path.join(root, 'portable');
  await fs.mkdir(path.join(bundle, 'assets'), { recursive: true });
  await fs.writeFile(path.join(input, BINARY_NAMES.main), 'synthetic main executable');
  await fs.writeFile(path.join(input, BINARY_NAMES.host), 'synthetic host executable');
  await fs.writeFile(path.join(bundle, 'surface.html'), '<main>SYNTHETIC QA</main>');
  await fs.writeFile(path.join(bundle, 'assets', 'surface.js'), 'console.log("synthetic")');
  await fs.writeFile(path.join(bundle, 'assets', 'surface.css'), ':root { color: teal; }');
  return {
    root,
    output,
    options: {
      mainExecutable: path.join(input, BINARY_NAMES.main),
      hostExecutable: path.join(input, BINARY_NAMES.host),
      surfaceBundle: bundle,
      output,
      sourceSha: 'a'.repeat(40),
      checkoutHead: 'a'.repeat(40),
      runner: {
        os: 'Windows',
        image: 'windows-2025',
        runId: '12345',
        runAttempt: '1',
        node: '22.23.3',
        rust: '1.98.1',
      },
    },
  };
}

describe('Surface QA portable package', () => {
  it('packages the exact binaries and recursive Surface bundle with hashes', async () => {
    const test = await fixture();

    const result = await createPortablePackage(test.options);

    expect(result.manifest.identifier).toBe(QA_IDENTIFIER);
    expect(result.manifest.productionDeployment).toBe(false);
    expect(result.manifest.syntheticDataOnly).toBe(true);
    expect(result.manifest.files.map(file => file.path)).toEqual([
      BINARY_NAMES.main,
      BINARY_NAMES.host,
      'surface/assets/surface.css',
      'surface/assets/surface.js',
      'surface/surface.html',
    ]);
    for (const file of result.manifest.files) {
      const bytes = await fs.readFile(path.join(test.output, ...file.path.split('/')));
      expect(file.sha256).toBe(sha256(bytes));
      expect(file.bytes).toBe(bytes.length);
    }
    await expect(verifyPortablePackage(test.output)).resolves.toEqual(result.manifest);
    const readme = await fs.readFile(path.join(test.output, 'README.txt'), 'utf8');
    expect(readme).toContain('%TEMP%\\bogunon-desktop-surface-qa-diagnostic.json');
    expect(readme).toContain('%TEMP%\\bogunon-desktop-surface-qa-main-diagnostic.json');
    expect(readme).toContain('Do not automatically retry');
  });

  it('records source and supplied runner provenance without environment dumps', async () => {
    const test = await fixture();

    const result = await createPortablePackage(test.options);

    expect(result.manifest.sourceSha).toBe('a'.repeat(40));
    expect(result.manifest.runner).toEqual(test.options.runner);
    expect(JSON.stringify(result.manifest)).not.toMatch(/runner_temp|userprofile|github_token|cookie/iu);
  });

  it('creates missing artifact parent directories but refuses a preexisting final output', async () => {
    const test = await fixture();
    const nestedOutput = path.join(test.root, 'artifacts', 'nested', 'portable');

    await expect(createPortablePackage({ ...test.options, output: nestedOutput })).resolves.toBeDefined();
    await expect(createPortablePackage({ ...test.options, output: nestedOutput })).rejects.toThrow();
  });

  it.each([
    ['private key', 'assets/leak.js', '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----'],
    ['GitHub token', 'assets/leak.js', 'const value = "ghp_abcdefghijklmnopqrstuvwxyz123456"'],
    ['credential assignment', 'assets/leak.js', 'const client_secret = "not-a-real-but-secret-value"'],
    ['Windows user path', 'assets/leak.js', 'const path = "C:\\\\Users\\\\school\\\\profile"'],
    ['Unix user path', 'assets/leak.js', 'const path = "/home/school/profile"'],
    ['external HTTPS endpoint', 'assets/leak.js', 'const endpoint = "https://api.example.com/private"'],
    ['external WebSocket endpoint', 'assets/leak.js', 'const endpoint = "wss://api.example.com/events"'],
    ['non-error React documentation URL', 'assets/leak.js', 'const endpoint = "https://react.dev/learn"'],
  ])('rejects %s content', async (_label, relativePath, content) => {
    const test = await fixture();
    await fs.writeFile(path.join(test.options.surfaceBundle, ...relativePath.split('/')), content);

    await expect(createPortablePackage(test.options)).rejects.toThrow(/sensitive|endpoint|path/iu);
    await expect(fs.stat(test.output)).rejects.toThrow();
  });

  it('allows fixed local origins and standard SVG namespace URIs', async () => {
    const test = await fixture();
    await fs.writeFile(path.join(test.options.surfaceBundle, 'assets', 'origins.js'), [
      'const origin = "https://surface.qa.local";',
      'const health = "http://127.0.0.1/status";',
      'const socket = "ws://localhost/events";',
      'const namespace = "http://www.w3.org/2000/svg";',
      'const reactErrorDocs = "https://react.dev/errors/418";',
    ].join('\n'));

    await expect(createPortablePackage(test.options)).resolves.toBeDefined();
  });

  it.each([
    'http://www.w3.org/1998/Math/MathML',
    'http://www.w3.org/XML/1998/namespace',
    'http://fb.me/use-check-prop-types',
    'https://github.com/react-grid-layout/react-draggable#noderef',
  ])('allows the exact static framework literal %s', async staticUrl => {
    const test = await fixture();
    await fs.writeFile(path.join(test.options.surfaceBundle, 'assets', 'framework.js'), `const documentation = "${staticUrl}";`);

    await expect(createPortablePackage(test.options)).resolves.toBeDefined();
  });

  it.each([
    'http://www.w3.org/1998/Math/MathML/extra',
    'http://www.w3.org/XML/1998/namespace/extra',
    'http://fb.me/use-check-prop-types/extra',
    'https://github.com/react-grid-layout/react-draggable#different',
  ])('rejects a nearby external framework URL %s', async staticUrl => {
    const test = await fixture();
    await fs.writeFile(path.join(test.options.surfaceBundle, 'assets', 'framework.js'), `const documentation = "${staticUrl}";`);

    await expect(createPortablePackage(test.options)).rejects.toThrow(/endpoint/iu);
  });

  it('requires the checked-out commit to equal the packaged source SHA', async () => {
    const test = await fixture();

    await expect(createPortablePackage({ ...test.options, checkoutHead: 'b'.repeat(40) })).rejects.toThrow(/checkout/iu);
    await expect(createPortablePackage({ ...test.options, checkoutHead: 'not-a-sha' })).rejects.toThrow(/checkout/iu);
  });

  it.each([
    ['os', 'Linux'],
    ['image', 'windows-2025/C:/Users/school'],
    ['runId', '123/path'],
    ['runAttempt', '1\\profile'],
    ['node', 'v22.23.3/C:/Users/school'],
    ['rust', '1.98.1\\profile'],
  ])('rejects unsafe runner provenance in %s', async (key, value) => {
    const test = await fixture();
    const runner = { ...test.options.runner, [key]: value };

    await expect(createPortablePackage({ ...test.options, runner })).rejects.toThrow(/runner|workflow/iu);
  });

  it.each([
    ['source map', 'assets/app.js.map'],
    ['environment file', '.env'],
    ['credentials', 'credentials.json'],
    ['cookie database', 'Cookies'],
    ['profile data', 'User Data/Default/Preferences'],
    ['target tree', 'target/release/extra.exe'],
    ['unexpected executable', 'assets/extra.exe'],
  ])('rejects a %s in the Surface bundle', async (_label, relativePath) => {
    const test = await fixture();
    const candidate = path.join(test.options.surfaceBundle, ...relativePath.split('/'));
    await fs.mkdir(path.dirname(candidate), { recursive: true });
    await fs.writeFile(candidate, 'forbidden');

    await expect(createPortablePackage(test.options)).rejects.toThrow(/forbidden|allowlist/iu);
    await expect(fs.stat(test.output)).rejects.toThrow();
  });

  it('rejects symbolic links in the bundle', async () => {
    const test = await fixture();
    const link = path.join(test.options.surfaceBundle, 'linked.js');
    try {
      await fs.symlink(path.join(test.options.surfaceBundle, 'assets', 'surface.js'), link);
    } catch (error) {
      if (process.platform === 'win32' && error?.code === 'EPERM') return;
      throw error;
    }

    await expect(createPortablePackage(test.options)).rejects.toThrow(/symbolic/iu);
  });

  it('rejects unexpected executable names and invalid source identity', async () => {
    const test = await fixture();
    await expect(createPortablePackage({ ...test.options, mainExecutable: test.options.hostExecutable })).rejects.toThrow(/name/iu);
    await expect(createPortablePackage({ ...test.options, sourceSha: 'not-a-sha' })).rejects.toThrow(/source/iu);
  });

  it('detects changed and extra package bytes during verification', async () => {
    const test = await fixture();
    await createPortablePackage(test.options);
    await fs.writeFile(path.join(test.output, 'surface', 'surface.html'), 'altered');
    await expect(verifyPortablePackage(test.output)).rejects.toThrow(/digest|size/iu);

    const other = await fixture();
    await createPortablePackage(other.options);
    await fs.writeFile(path.join(other.output, 'unexpected.txt'), 'extra');
    await expect(verifyPortablePackage(other.output)).rejects.toThrow(/inventory/iu);
  });
});
