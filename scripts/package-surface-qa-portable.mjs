import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const QA_IDENTIFIER = 'kr.sungandi.schoolhealthdesk.surfaceqa';
export const BINARY_NAMES = Object.freeze({
  main: 'bogunon-desk-surface-qa.exe',
  host: 'bogunon-desktop-surface-host.exe',
});

const METADATA_FILES = Object.freeze(['ARTIFACT-MANIFEST.json', 'README.txt', 'SHA256SUMS.txt']);
const BUNDLE_EXTENSIONS = new Set(['.css', '.gif', '.html', '.ico', '.jpeg', '.jpg', '.js', '.json', '.png', '.svg', '.webp', '.woff', '.woff2']);
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.svg']);
const FORBIDDEN_SEGMENTS = new Set(['appdata', 'cache', 'cookies', 'credentials', 'profile', 'target', 'udf', 'user data']);
const RUNNER_KEYS = Object.freeze(['os', 'image', 'runId', 'runAttempt', 'node', 'rust']);
const MAX_BUNDLE_FILE_BYTES = 16 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 128 * 1024 * 1024;
const MAX_EXECUTABLE_BYTES = 512 * 1024 * 1024;
const STANDARD_NAMESPACE_URLS = new Set([
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/XML/1998/namespace',
  'http://fb.me/use-check-prop-types',
  'https://github.com/react-grid-layout/react-draggable#noderef',
]);

const requireValue = (condition, message) => {
  if (!condition) throw new Error(message);
};

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function portablePath(value) {
  return value.split(path.sep).join('/');
}

function validateBundlePath(relativePath) {
  const portable = portablePath(relativePath);
  const segments = portable.split('/');
  requireValue(segments.every(segment => segment && segment !== '.' && segment !== '..'), `Forbidden bundle path: ${portable}`);
  requireValue(segments.every(segment => !FORBIDDEN_SEGMENTS.has(segment.toLowerCase())), `Forbidden bundle path: ${portable}`);
  const name = segments.at(-1).toLowerCase();
  requireValue(!name.startsWith('.env') && !name.endsWith('.map'), `Forbidden bundle file: ${portable}`);
  requireValue(!/(?:secret|token|credential|cookie)/iu.test(name), `Forbidden bundle file: ${portable}`);
  requireValue(BUNDLE_EXTENSIONS.has(path.extname(name)), `Bundle file is outside the allowlist: ${portable}`);
  return portable;
}

async function readRegularFile(file, maximumBytes) {
  const stat = await fs.lstat(file);
  requireValue(stat.isFile() && !stat.isSymbolicLink(), `Expected regular file: ${file}`);
  requireValue(stat.size > 0 && stat.size <= maximumBytes, `Invalid file size: ${file}`);
  return fs.readFile(file);
}

function inspectTextContent(bytes, relativePath) {
  if (!TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) return;
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`Sensitive content scan cannot decode: ${relativePath}`);
  }
  const sensitivePatterns = [
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/u,
    /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}\b/u,
    /\bAKIA[0-9A-Z]{16}\b/u,
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u,
    /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|cookie)\s*[:=]\s*["'][^"'\s]{8,}["']/iu,
  ];
  requireValue(!sensitivePatterns.some(pattern => pattern.test(text)), `Sensitive credential content rejected: ${relativePath}`);
  requireValue(!/[A-Za-z]:[\\/]+Users[\\/]+[^\\/"'\s]+/iu.test(text), `User absolute path rejected: ${relativePath}`);
  requireValue(!/(?:^|["'\s])\/(?:home|Users)\/[^/"'\s]+/mu.test(text), `User absolute path rejected: ${relativePath}`);
  for (const match of text.matchAll(/\b(?:https?|wss?):\/\/[^\s"'`<>\\)]+/giu)) {
    const endpoint = match[0].replace(/[;,]+$/u, '');
    if (STANDARD_NAMESPACE_URLS.has(endpoint)) continue;
    const url = new URL(endpoint);
    const localHost = url.hostname === 'surface.qa.local' || url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    const reactErrorDocs = url.protocol === 'https:' && url.hostname === 'react.dev' && url.pathname.startsWith('/errors/');
    requireValue(localHost || reactErrorDocs, `External endpoint rejected: ${relativePath}`);
  }
}

async function listBundleFiles(root, current = root) {
  const stat = await fs.lstat(current);
  requireValue(stat.isDirectory() && !stat.isSymbolicLink(), `Expected bundle directory: ${current}`);
  const files = [];
  for (const entry of await fs.readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    requireValue(!entry.isSymbolicLink(), `Symbolic links are forbidden in the bundle: ${entry.name}`);
    if (entry.isDirectory()) files.push(...await listBundleFiles(root, absolute));
    else {
      requireValue(entry.isFile(), `Unsupported bundle entry: ${entry.name}`);
      files.push({ absolute, relative: validateBundlePath(path.relative(root, absolute)) });
    }
  }
  return files.sort((left, right) => left.relative.localeCompare(right.relative, 'en'));
}

function parseRunner(value) {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'Runner provenance is required');
  requireValue(Object.keys(value).sort().join('|') === [...RUNNER_KEYS].sort().join('|'), 'Unexpected runner provenance fields');
  const runner = {};
  for (const key of RUNNER_KEYS) {
    const item = value[key];
    requireValue(typeof item === 'string' && item.length > 0 && item.length <= 128 && /^[\x20-\x7e]+$/u.test(item), `Invalid runner provenance: ${key}`);
    runner[key] = item;
  }
  requireValue(runner.os === 'Windows', 'Invalid runner OS');
  requireValue(/^windows-(?:2022|2025)$/u.test(runner.image), 'Invalid runner image');
  requireValue(/^[1-9][0-9]*$/u.test(runner.runId) && /^[1-9][0-9]*$/u.test(runner.runAttempt), 'Invalid workflow run identity');
  requireValue(/^v?[0-9]+\.[0-9]+\.[0-9]+$/u.test(runner.node), 'Invalid runner Node version');
  requireValue(/^(?:rustc )?[0-9]+\.[0-9]+\.[0-9]+(?: \([A-Za-z0-9 ._-]+\))?$/u.test(runner.rust), 'Invalid runner Rust version');
  return runner;
}

async function payload(options) {
  requireValue(/^[a-f0-9]{40}$/u.test(options.sourceSha), 'Invalid source SHA');
  requireValue(/^[a-f0-9]{40}$/u.test(options.checkoutHead) && options.checkoutHead === options.sourceSha, 'Checkout HEAD does not match source SHA');
  requireValue(path.basename(options.mainExecutable) === BINARY_NAMES.main, 'Unexpected QA Main executable name');
  requireValue(path.basename(options.hostExecutable) === BINARY_NAMES.host, 'Unexpected Surface Host executable name');
  const main = await readRegularFile(options.mainExecutable, MAX_EXECUTABLE_BYTES);
  const host = await readRegularFile(options.hostExecutable, MAX_EXECUTABLE_BYTES);
  const bundleFiles = await listBundleFiles(options.surfaceBundle);
  requireValue(bundleFiles.some(file => file.relative === 'surface.html'), 'Surface bundle surface.html is required');
  const files = [
    { path: BINARY_NAMES.main, bytes: main },
    { path: BINARY_NAMES.host, bytes: host },
  ];
  let bundleBytes = 0;
  for (const file of bundleFiles) {
    const bytes = await readRegularFile(file.absolute, MAX_BUNDLE_FILE_BYTES);
    inspectTextContent(bytes, file.relative);
    bundleBytes += bytes.length;
    requireValue(bundleBytes <= MAX_BUNDLE_BYTES, 'Surface bundle exceeds the package limit');
    files.push({ path: `surface/${file.relative}`, bytes });
  }
  return { files, runner: parseRunner(options.runner) };
}

export async function createPortablePackage(options) {
  const output = path.resolve(options.output);
  const bundle = path.resolve(options.surfaceBundle);
  requireValue(output !== bundle && !output.startsWith(`${bundle}${path.sep}`), 'Output must be outside the Surface bundle');
  const prepared = await payload(options);
  const manifest = {
    schemaVersion: 1,
    artifactType: 'bogunon-desktop-surface-portable-qa',
    sourceSha: options.sourceSha,
    checkoutHead: options.checkoutHead,
    identifier: QA_IDENTIFIER,
    binaryNames: BINARY_NAMES,
    productionDeployment: false,
    syntheticDataOnly: true,
    operatingDataAccess: false,
    externalNetworkAllowed: false,
    runner: prepared.runner,
    files: prepared.files.map(file => ({ path: file.path, bytes: file.bytes.length, sha256: digest(file.bytes) })),
  };
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(output);
  for (const file of prepared.files) {
    const destination = path.join(output, ...file.path.split('/'));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, file.bytes, { flag: 'wx' });
  }
  await fs.writeFile(path.join(output, 'ARTIFACT-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  await fs.writeFile(path.join(output, 'SHA256SUMS.txt'), `${manifest.files.map(file => `${file.sha256}  ${file.path}`).join('\n')}\n`, { flag: 'wx' });
  await fs.writeFile(path.join(output, 'README.txt'), [
    'BOGUNON DESK Desktop Surface synthetic QA only.',
    'This unsigned portable package is not an operating release.',
    'Verify SHA256SUMS.txt before use and run only after the isolation gate passes.',
    'Do not copy an operating profile, AppData, UDF, credentials, cookies, or school data into this folder.',
    '',
  ].join('\n'), { flag: 'wx' });
  await verifyPortablePackage(output);
  return { manifest };
}

export async function verifyPortablePackage(directory) {
  const manifestBytes = await readRegularFile(path.join(directory, 'ARTIFACT-MANIFEST.json'), 1024 * 1024);
  const manifest = JSON.parse(manifestBytes.toString('utf8').replace(/^\uFEFF/u, ''));
  requireValue(manifest.identifier === QA_IDENTIFIER && manifest.productionDeployment === false && manifest.syntheticDataOnly === true, 'QA manifest identity rejected');
  requireValue(manifest.operatingDataAccess === false && manifest.externalNetworkAllowed === false, 'QA isolation manifest rejected');
  requireValue(/^[a-f0-9]{40}$/u.test(manifest.sourceSha) && manifest.checkoutHead === manifest.sourceSha && Array.isArray(manifest.files), 'QA manifest provenance rejected');
  parseRunner(manifest.runner);
  const expectedPayload = manifest.files.map(file => file.path);
  requireValue(new Set(expectedPayload).size === expectedPayload.length, 'Duplicate manifest path');
  const actualBundle = await listBundleFiles(path.join(directory, 'surface'));
  const actualPayload = [BINARY_NAMES.main, BINARY_NAMES.host, ...actualBundle.map(file => `surface/${file.relative}`)].sort();
  requireValue(JSON.stringify(actualPayload) === JSON.stringify([...expectedPayload].sort()), 'Unexpected package inventory');
  for (const file of manifest.files) {
    const bytes = await readRegularFile(path.join(directory, ...file.path.split('/')), file.path.endsWith('.exe') ? MAX_EXECUTABLE_BYTES : MAX_BUNDLE_FILE_BYTES);
    requireValue(bytes.length === file.bytes && digest(bytes) === file.sha256, `Package digest or size mismatch: ${file.path}`);
  }
  const rootEntries = (await fs.readdir(directory)).sort();
  const expectedRoot = [...METADATA_FILES, BINARY_NAMES.main, BINARY_NAMES.host, 'surface'].sort();
  requireValue(JSON.stringify(rootEntries) === JSON.stringify(expectedRoot), 'Unexpected package root inventory');
  const sums = await readRegularFile(path.join(directory, 'SHA256SUMS.txt'), 1024 * 1024);
  requireValue(sums.toString('utf8') === `${manifest.files.map(file => `${file.sha256}  ${file.path}`).join('\n')}\n`, 'Checksum inventory mismatch');
  return manifest;
}

function cliOptions(argumentsList, environment) {
  const values = Object.fromEntries(argumentsList.reduce((pairs, value, index) => index % 2 === 0 ? [...pairs, [value, argumentsList[index + 1]]] : pairs, []));
  return {
    mainExecutable: values['--main'],
    hostExecutable: values['--host'],
    surfaceBundle: values['--bundle'],
    output: values['--output'],
    sourceSha: values['--source-sha'],
    checkoutHead: values['--checkout-head'],
    runner: {
      os: environment.RUNNER_OS ?? 'local',
      image: environment.ImageOS ?? 'local',
      runId: environment.GITHUB_RUN_ID ?? '1',
      runAttempt: environment.GITHUB_RUN_ATTEMPT ?? '1',
      node: process.version,
      rust: environment.SURFACE_QA_RUST_VERSION ?? 'unknown',
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await createPortablePackage(cliOptions(process.argv.slice(2), process.env));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Surface QA packaging failed');
    process.exitCode = 1;
  }
}
