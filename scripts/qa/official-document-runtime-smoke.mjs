import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { assessNativeScreen } from './official-document-screen-assessment.mjs';
import { discoverPage } from './my-finance-cdp-discovery.mjs';

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted' || process.platform !== 'win32') {
  throw new Error('Runtime smoke is restricted to disposable Windows Actions runners');
}
const evidence = resolve(process.env.QA_ROOT, 'evidence');
const executable = join(evidence, 'bogunon-desk-official-document-qa.exe');
const identifier = 'kr.sungandi.schoolhealthdesk.officialdocumentqa';
const localData = join(process.env.LOCALAPPDATA, identifier);
const webviewData = join(localData, 'EBWebView');
const expectedSource = process.env.QA_EXPECTED_SOURCE_SHA ?? process.env.GITHUB_SHA;
const report = { status: 'FAIL', scriptSha: process.env.GITHUB_SHA, sourceSha: expectedSource, identifier, localData, webviewData, uiQa: 'NOT RUN', cdpHandshake: 'NOT RUN', frontendScreen: 'NOT RUN' };
const hash = createHash('sha256').update(readFileSync(executable)).digest('hex');
if ((process.env.QA_EXPECTED_EXE_SHA256 && hash !== process.env.QA_EXPECTED_EXE_SHA256) || !readFileSync(join(evidence, 'SHA256SUMS.txt'), 'utf8').includes(hash)) throw new Error('EXE hash mismatch');
if (existsSync(localData)) throw new Error('Runner QA profile already exists; refusing reuse');
const nativeOnly = process.env.QA_NATIVE_UI_ONLY === 'true';
const port = 9225;
if (!nativeOnly) {
const preflight = createServer();
await new Promise((ok, fail) => { preflight.once('error', fail); preflight.listen(port, '127.0.0.1', ok); });
await new Promise(ok => preflight.close(ok));
report.portFreeBeforeLaunch = true;
report.requestedBrowserArguments = '--remote-debugging-port=9225 --remote-debugging-address=127.0.0.1 --disable-background-networking --force-renderer-accessibility';
}
const child = spawn(executable, [], {
  cwd: evidence,
  env: nativeOnly ? { ...process.env } : { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1 --disable-background-networking --force-renderer-accessibility` },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let processError;
let stdout = '', stderr = '';
child.on('error', error => { processError = error; });
child.stdout.on('data', data => { stdout += data; });
child.stderr.on('data', data => { stderr += data; });
let socket;
try {
  await new Promise(ok => setTimeout(ok, 3000));
  const probe = (interact = false) => spawnSync('powershell.exe', ['-NoProfile', '-File', resolve('scripts/qa/official-document-window-probe.ps1'), '-ProcessId', String(child.pid), '-OutputDirectory', evidence, ...(interact ? ['-Interact'] : [])], { encoding: 'utf8', timeout: 180_000 });
  report.qaProcessId = child.pid;
  const before = probe();
  writeFileSync(join(evidence, 'window-probe.log'), before.stdout + before.stderr);
  const discovery = nativeOnly ? { page: null, evidence: { status: 'NOT RUN', reason: 'Native UI only; CDP investigation explicitly excluded' } } : await discoverPage(port, { timeoutMs: 60_000 });
  report.discovery = discovery.evidence;
  const assessScreen = () => {
    const controlsPath = join(evidence, 'native-window-controls-before.json');
    const capturePath = join(evidence, 'native-window-before-capture.json');
    if (!existsSync(controlsPath)) return;
    const json = path => JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));
    const captureKind = existsSync(capturePath) && existsSync(join(evidence, 'native-window-before.png')) ? json(capturePath).kind : null;
    Object.assign(report, assessNativeScreen(json(controlsPath), captureKind));
    if (report.frontendScreen === 'FAIL') process.exitCode = 1;
  };
  assessScreen();
  if (processError) throw processError;
  if (child.exitCode !== null || child.signalCode !== null) throw new Error(`QA app exited during startup: ${child.exitCode}`);
  report.webviewDirectoryCreated = existsSync(webviewData);
  if (!discovery.page) {
    report.status = 'PARTIAL';
    report.reason = nativeOnly ? 'Native UI Automation only; CDP handshake intentionally NOT RUN' : 'App alive but CDP unavailable; frontend handshake NOT RUN';
    const gui = probe(true);
    writeFileSync(join(evidence, 'window-interaction.log'), gui.stdout + gui.stderr);
    const guiReport = join(evidence, 'native-window-results.json');
    if (existsSync(guiReport)) {
      report.nativeGui = JSON.parse(readFileSync(guiReport, 'utf8').replace(/^﻿/, ''));
      report.uiProbeFailures = report.nativeGui.filter(item => item.status === 'FAIL');
      if (report.uiProbeFailures.length || gui.status !== 0) {
        report.uiQa = 'FAIL - native GUI probe reported a failure';
        process.exitCode = 1;
      }
    } else { report.uiQa = 'NOT RUN - native GUI report unavailable'; }
    assessScreen();
    if (report.frontendInitializedViaUia && gui.status === 0 && existsSync(guiReport) && !report.uiProbeFailures?.length) report.uiQa = 'PARTIAL - actual native UI Automation evidence';

  } else {
    report.cdpHandshake = 'FAIL';
    const endpoint = new URL(discovery.page.webSocketDebuggerUrl);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) || endpoint.port !== String(port)) throw new Error('CDP endpoint must be local');
    socket = new WebSocket(endpoint);
    await new Promise((ok, fail) => {
      const timer = setTimeout(() => fail(new Error('CDP connect timeout')), 10_000);
      socket.addEventListener('open', () => { clearTimeout(timer); ok(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); fail(new Error('CDP connection failed')); }, { once: true });
    });
    let sequence = 0;
    const evaluate = expression => new Promise((ok, fail) => {
      const id = ++sequence;
      const timer = setTimeout(() => { socket.removeEventListener('message', listener); fail(new Error('CDP evaluation timeout')); }, 10_000);
      const listener = event => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        clearTimeout(timer); socket.removeEventListener('message', listener);
        if (message.error || message.result?.exceptionDetails) fail(new Error('QA handshake evaluation failed'));
        else ok(message.result.result.value);
      };
      socket.addEventListener('message', listener);
      socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    });
    let state;
    for (let attempt = 0; attempt < 30; attempt++) {
      state = await evaluate(`(async () => ({ info: window.__TAURI_INTERNALS__ ? await window.__TAURI_INTERNALS__.invoke('official_document_qa_info') : null, ready: !!document.querySelector('.official-document-qa-shell'), blocked: !!document.querySelector('.official-document-qa-state[role="alert"]') }))()`);
      if (state.ready || state.blocked) break;
      await new Promise(ok => setTimeout(ok, 500));
    }
    const info = state.info;
    if (info.identifier !== identifier || info.sourceSha !== expectedSource || !state.ready || state.blocked) throw new Error('Frontend QA isolation handshake failed');
    if (resolve(info.localData) !== resolve(localData) || resolve(info.webviewData) !== resolve(webviewData)) throw new Error('Actual QA data path mismatch');
    const flags = ['networkEnabled','loginEnabled','chatGptEnabled','aiEnabled','accountSyncEnabled','updaterEnabled','deepLinkEnabled','autostartEnabled','trayEnabled','externalUrlEnabled'];
    if (!flags.every(key => info[key] === false) || !existsSync(webviewData)) throw new Error('Isolation boundary failed');
    report.status = 'PASS';
    report.cdpHandshake = 'PASS';
    report.nativeInfo = info;
    report.frontendInitialized = true;
  }
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  socket?.close();
  const termination = child.pid ? spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', timeout: 10_000 }) : null;
  report.cleanupConfirmed = termination?.status === 0;
  if (!report.cleanupConfirmed) {
    report.status = 'FAIL';
    report.cleanupError = 'Owned process tree termination not confirmed; retain firewall rules until runner disposal';
    process.exitCode = 1;
  }
  if (report.frontendScreen === 'FAIL' || report.uiProbeFailures?.length || report.error) report.status = 'FAIL';
  writeFileSync(join(evidence, 'runtime-smoke.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(evidence, 'runtime-stdout.log'), stdout);
  writeFileSync(join(evidence, 'runtime-stderr.log'), stderr);
  console.log(JSON.stringify(report, null, 2));
}
