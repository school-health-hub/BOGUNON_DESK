import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { discoverPage } from "./my-finance-cdp-discovery.mjs";

if (process.env.GITHUB_ACTIONS !== "true" || process.env.RUNNER_ENVIRONMENT !== "github-hosted" || process.platform !== "win32") throw new Error("F-10 runtime QA is restricted to disposable GitHub Windows runners");
const evidence = resolve(process.env.QA_ROOT, "evidence");
const executable = join(evidence, "bogunon-desk-finder-integration-qa.exe");
const identifier = "kr.sungandi.schoolhealthdesk.finderintegrationqa";
const expectedSource = process.env.GITHUB_SHA;
const localData = join(process.env.LOCALAPPDATA, identifier);
const report = { status: "FAIL", sourceSha: expectedSource, identifier, localData, checks: [], externalRequests: 0 };
const hash = createHash("sha256").update(readFileSync(executable)).digest("hex");
if (!readFileSync(join(evidence, "SHA256SUMS.txt"), "utf8").includes(hash)) throw new Error("F-10 executable hash mismatch");
if (existsSync(localData)) throw new Error("F-10 profile already exists; refusing profile reuse");
const port = 9231;
const child = spawn(executable, [], { cwd: evidence, env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1 --disable-background-networking` }, stdio: ["ignore", "pipe", "pipe"] });
let stdout = "", stderr = "", socket;
child.stdout.on("data", data => { stdout += data; }); child.stderr.on("data", data => { stderr += data; });
try {
  const discovery = await discoverPage(port, { timeoutMs: 60_000 });
  if (!discovery.page) throw new Error("WebView2 CDP endpoint unavailable");
  const endpoint = new URL(discovery.page.webSocketDebuggerUrl);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname) || endpoint.port !== String(port)) throw new Error("CDP endpoint is not loopback-only");
  socket = new WebSocket(endpoint);
  await new Promise((ok, fail) => { const timer = setTimeout(() => fail(new Error("CDP connection timeout")), 10_000); socket.addEventListener("open", () => { clearTimeout(timer); ok(); }, { once: true }); socket.addEventListener("error", fail, { once: true }); });
  let sequence = 0;
  const command = (method, params = {}) => new Promise((ok, fail) => { const id = ++sequence; const listener = event => { const message = JSON.parse(event.data); if (message.id !== id) return; socket.removeEventListener("message", listener); if (message.error || message.result?.exceptionDetails) { const detail = message.error?.message ?? message.result?.exceptionDetails?.exception?.description ?? message.result?.exceptionDetails?.text ?? "unknown"; fail(new Error(`${method} failed: ${detail}`)); } else ok(message.result); }; socket.addEventListener("message", listener); socket.send(JSON.stringify({ id, method, params })); setTimeout(() => { socket.removeEventListener("message", listener); fail(new Error(`${method} timeout`)); }, 15_000); });
  const evaluate = async expression => (await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
  const evaluateAfterNavigation = async expression => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try { return await evaluate(expression); }
      catch (error) {
        if (!error.message.includes("Execution context was destroyed") || attempt === 19) throw error;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  };
  await command("Runtime.enable"); await command("Page.enable");
  const state = await evaluateAfterNavigation(`(async()=>{for(let i=0;i<80&&!document.querySelector('[data-education-video-launcher]');i++)await new Promise(r=>setTimeout(r,250));return {info:await window.__FINDER_INTEGRATION_QA__.info(),ready:!!document.querySelector('[data-education-video-launcher]')}})()`);
  if (!state.ready || state.info.identifier !== identifier || state.info.sourceSha !== expectedSource || !state.info.integrationsDisabled || resolve(state.info.localData) !== resolve(localData)) throw new Error("F-10 isolation handshake failed");
  report.checks.push("isolated identity and AppData");
  const flow = await evaluate(`(async()=>{
    const wait=async(test,label)=>{for(let i=0;i<80;i++){const value=test();if(value)return value;await new Promise(r=>setTimeout(r,100));}throw new Error('timeout:'+label)};
    const click=text=>{const node=[...document.querySelectorAll('button,summary')].find(el=>el.textContent.trim().includes(text));if(!node)throw new Error('missing:'+text);node.click();};
    const set=(labelText,value)=>{const label=[...document.querySelectorAll('label')].find(el=>el.textContent.includes(labelText));const node=label?.querySelector('input,textarea,select');if(!node)throw new Error('missing field:'+labelText);const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node),'value').set;setter.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));};
    click('교육영상 Finder'); await wait(()=>document.querySelector('.aiv-finder'),'Finder');
    set('교육 주제','합성 감염병 예방교육'); set('교육 대상','중학생'); set('희망 영상 길이','20');
    click('찾은 영상 링크 붙여넣기'); set('YouTube 영상 URL 여러 개','https://youtu.be/abcdefghijk\\n잘못된 주소\\nhttps://www.youtube.com/watch?v=abcdefghijk'); click('유효한 영상 추가');
    await wait(()=>document.querySelector('.aiv-cards article'),'candidate');
    if(!document.body.textContent.includes('2번 줄')||!document.body.textContent.includes('1개'))throw new Error('partial URL validation missing');
    click('사실정보 확인·수정'); set('확인한 영상 제목','합성 손씻기 교육영상'); set('확인한 제작기관','합성 교육기관'); set('재생시간 분','18'); set('재생시간 초','30'); click('확인한 정보 적용');
    const select=document.querySelector('input[aria-label="후보 1 선택"]');select.click(); click('라이브러리 저장');
    await wait(()=>document.body.textContent.includes('저장된 AI 후보 1개'),'saved'); click('저장된 AI 후보'); click('합성 손씻기 교육영상');
    await wait(()=>document.body.textContent.includes('저장된 교육 주제·대상을 불러왔습니다.'),'saved candidate reload');
    await wait(()=>[...document.querySelectorAll('button')].some(node=>node.textContent.trim()==='기안 초안으로 연결'&&!node.disabled),'enabled draft handoff');
    [...document.querySelectorAll('button')].find(node=>node.textContent.trim()==='기안 초안으로 연결'&&!node.disabled).click();
    await wait(()=>document.body.textContent.includes('영상 Finder로 돌아가기')||document.body.textContent.includes('기존 기안 초안을 바꿀까요?'),'handoff transition');
    if(document.body.textContent.includes('기존 기안 초안을 바꿀까요?'))click('영상으로 새 초안 작성');
    await wait(()=>document.body.textContent.includes('영상 Finder로 돌아가기'),'handoff');
    const rendered=[document.body.textContent,...[...document.querySelectorAll('input,textarea')].map(node=>node.value)].join(' '); if(!rendered.includes('합성 손씻기 교육영상')||!rendered.includes('https://www.youtube.com/watch?v=abcdefghijk'))throw new Error('verified handoff missing');
    click('영상 Finder로 돌아가기'); click('보건 업무로'); await wait(()=>document.querySelector('[data-education-video-launcher]'),'toolbox return');
    const other=[...document.querySelectorAll('.toolbox-panel__launch')].find(el=>!el.hasAttribute('data-education-video-launcher'));other.click(); await wait(()=>document.body.textContent.includes('다른 도구 이동 상태'),'other tool'); click('업무 도구로 돌아가기'); click('교육영상 Finder'); await wait(()=>document.querySelector('.aiv-finder'),'Finder reentry');
    const exported=JSON.parse(await window.__FINDER_INTEGRATION_QA__.exportLibrary());
    const entry=exported.entries.find(row=>row.videoId==='abcdefghijk');
    if(exported.version!==2||!entry||entry.candidateRecord.provenance!=='teacher-confirmed')throw new Error('library v2/provenance mismatch');
    return {candidateCount:document.querySelectorAll('.aiv-cards article').length,libraryVersion:exported.version,videoId:entry.videoId,provenance:entry.candidateRecord.provenance};
  })()`);
  report.flow = flow; report.checks.push("Finder direct URL, metadata, save/reload, official document handoff, navigation/reentry");
  const screenshot = await command("Page.captureScreenshot", { format: "png" }); writeFileSync(join(evidence, "finder-integration-f10-desktop.png"), Buffer.from(screenshot.data, "base64"));
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const mobile = await evaluate(`({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, finderVisible: !!document.querySelector('.aiv-finder'), buttons: [...document.querySelectorAll('button')].filter(button => { const box=button.getBoundingClientRect(); return box.width>0&&box.height>0; }).length })`);
  if (mobile.overflow || !mobile.finderVisible || mobile.buttons < 3) throw new Error("Mobile viewport accessibility failed");
  report.mobile = mobile; report.checks.push("390x844 responsive viewport without horizontal overflow");
  const mobileShot = await command("Page.captureScreenshot", { format: "png" }); writeFileSync(join(evidence, "finder-integration-f10-mobile.png"), Buffer.from(mobileShot.data, "base64"));
  report.status = "PASS";
} catch (error) { report.error = error.message; process.exitCode = 1; }
finally { socket?.close(); const killed = child.pid ? spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { timeout: 10_000 }) : null; report.cleanupConfirmed = killed?.status === 0; if (!report.cleanupConfirmed) { report.status = "FAIL"; process.exitCode = 1; } writeFileSync(join(evidence, "runtime-report.json"), JSON.stringify(report, null, 2)); writeFileSync(join(evidence, "runtime-stdout.log"), stdout); writeFileSync(join(evidence, "runtime-stderr.log"), stderr); console.log(JSON.stringify(report, null, 2)); }
