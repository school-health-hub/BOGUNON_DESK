import {RecordHelperProcess} from './record-helper-process.js';
import {createRecordHelperHandlers} from './record-helper-ipc.js';
import {createFinderCompatHandlers} from './finder-compat-ipc.js';
import {PurchaseSettingsStore,createPurchaseSettingsHandlers} from './purchase-settings.js';
import {realpathSync} from 'node:fs';
import {qaProfilePaths} from './qa-profile.js';
import {tmpdir} from 'node:os';
import {FinderSearchService,createFinderSearchHandlers} from './finder-search.js';
import {EncryptedYoutubeVault} from './finder-vault.js';
import {allowedYoutubeUrl} from './finder-youtube.js';
import {allowedAdminProbeUrl,inspectAdminConnection,createAdminProbeClient} from './admin-connection.js';
import {redactBitmap} from './purchase-ai-images.js';
import {PurchaseAiService,createPurchaseAiHandlers} from './purchase-ai-service.js';
import {ChatGptProcess} from './chatgpt-process.js';
import {ChatGptService,createChatGptHandlers} from './chatgpt-service.js';
import {perceptualHash} from './purchase-image-preview.js';
import {createImageImportHandlers} from './purchase-image-ipc.js';
import {recognizeImage,verifyOcrRuntime} from './purchase-image-ocr.js';
import {SchoolProfileStore,createSchoolHandlers} from './school-profile.js';
import {allowedSchoolUrl} from './school-network.js';
import {AdminStore} from './admin-store.js';
import {createAdminHandlers} from './admin-ipc.js';
import {FinanceProcess} from './finance-process.js';
import {FinanceService,createFinanceHandlers} from './finance-ipc.js';
import {AiService,createAiHandlers} from './ai-service.js';
import {EncryptedAiVault} from './ai-vault.js';
import {allowedAiUrl} from './ai-network.js';
import {LocalTaskStore,createLocalTaskHandlers} from './local-tasks.js';
import {createEducationVideoExport} from './education-video-export.js';
import {InventoryQaService,inventoryQaHandler} from './inventory-qa-service.js';
import {INVENTORY_QA_ACTIONS} from '../inventory-qa-protocol.js';
import {createInventoryQaStatusHandler} from './inventory-local-qa.js';
import {OfficialDocumentService,createOfficialDocumentHandlers} from './official-document-files.js';
import {createSpecialPreview} from './purchase-specialized.js';
import {validateSpecialOutput,specialSummary,specialFileName,type SpecialOutput} from './purchase-specialized-validation.js';
import { purchaseExportFileName } from './purchase-export-validation.js';
import { createPurchaseExportHandler } from './purchase-export.js';
import { ExcelService } from './purchase-excel.js';
import { createExcelHandlers } from './purchase-excel-ipc.js';
import { createPurchaseImportHandlers } from './purchase-import.js';
import { createPurchaseClipboardHandler } from './purchase-clipboard.js';
import { app, BrowserWindow, ipcMain, session, Menu, Tray, nativeImage, screen, dialog, clipboard, ClipboardItem, safeStorage, shell } from 'electron';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { APP_ID, PRODUCT_NAME, PROFILE_NAME } from '../protocol.js';
import { desktopDefaults, validateDesktop, fitBounds, type DesktopState } from './desktop.js';
import { SettingsStore } from './settings.js';
import { createNewsletterExportHandler, generateInOwnedWindow, callOwnedNewsletter } from './newsletter-export.js';
import {NewsletterProjects} from './newsletter-projects.js';
import {createProjectHandler,PROJECT_ACTIONS} from './newsletter-project-ipc.js';
import { createNewsletterSaveHandler } from './newsletter-json.js';
import { MemoStore, createMemoHandlers } from './memo-ipc.js';
import {EducationVideoLibraryStore,createEducationVideoHandlers} from './education-video-library.js';
import {InventoryStore,InventoryConflict} from './inventory-store.js';
import { createSampleHandler, SAMPLE_SUMMARY_CHANNEL } from './sample-ipc.js';
import { assertSender, resourceAllowed } from './policy.js';
if (app.commandLine.hasSwitch('no-sandbox') || app.commandLine.hasSwitch('disable-web-security')) throw new Error('Unsafe Electron launch flags denied');
app.setName(PRODUCT_NAME);
const testRun = process.env.ELECTRON_P0_TEST_RUN;
if (testRun && !/^[a-f0-9-]{36}$/.test(testRun)) throw new Error('Invalid PoC test run');
const qaPaths=qaProfilePaths({enabled:process.env.ELECTRON_P0_QA_PROFILE,root:process.env.ELECTRON_P0_QA_ROOT,runId:testRun,tempRoot:process.env.RUNNER_TEMP??tmpdir(),defaultAppData:app.getPath('appData'),profileName:PROFILE_NAME});
if(qaPaths.qa){if(realpathSync(qaPaths.root!).toLowerCase()!==qaPaths.root!.toLowerCase())throw Error('QA root must not use a redirected filesystem path');app.setPath('appData',qaPaths.appData);}
const userData=qaPaths.userData;
app.setPath('userData',userData);
app.setPath('sessionData',qaPaths.sessionData);
app.setAppUserModelId(APP_ID);
const store = new SettingsStore(join(userData,'poc-settings'));
const purchaseSettingsStore=new PurchaseSettingsStore(join(userData,'work-data','purchase-settings'));
const taskStore=new LocalTaskStore(join(userData,'work-data','local-tasks'));
const memoStore=new MemoStore(join(userData,'work-data','quick-memo'));
const educationVideoStore=new EducationVideoLibraryStore(join(userData,'work-data','education-video'));
const schoolStore=new SchoolProfileStore(join(userData,'work-data','school-profile'));
const adminStore=new AdminStore(join(userData,'work-data','school-admin'));
const inventoryStore=new InventoryStore(join(userData,'work-data','inventory'));
let quitting = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  void app.whenReady().then(async()=>{
  const desktopStore=new SettingsStore<DesktopState>(join(userData,'poc-settings'),'desktop.json',validateDesktop);
  let desktop=await desktopStore.read().catch(()=>null)??desktopDefaults();
  let tray:Tray|null=null;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const renderer = join(app.getAppPath(),'renderer');
  const dev = process.env.ELECTRON_P0_DEV_URL || undefined;
  if (dev && (app.isPackaged || dev !== 'http://127.0.0.1:5174/')) throw new Error('Invalid PoC dev URL');
  const url = dev ?? pathToFileURL(join(renderer,'index.html')).href;
  const isolated = session.fromPartition('persist:electron-p0');
  isolated.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  isolated.setPermissionCheckHandler(()=>false);
  isolated.on('will-download',event=>event.preventDefault());
  isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!resourceAllowed(details.url,renderer,dev ? new URL(dev).origin : undefined)}));
  const window = new BrowserWindow({ title:PRODUCT_NAME,...fitBounds(desktop.bounds,screen.getAllDisplays().map(d=>d.workArea)),show:false,
    webPreferences:{ preload:join(app.getAppPath(),'preload','preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webviewTag:false,session:isolated,webSecurity:true } });
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.on('will-redirect',event=>event.preventDefault());
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  // API-only ephemeral network session, separate from the closed renderer session.
  // Public NEIS school metadata only. No BOGUNON auth or renderer network access.
  const schoolSession=session.fromPartition('neis-school-egress');
  schoolSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  schoolSession.setPermissionCheckHandler(()=>false);
  schoolSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!allowedSchoolUrl(details.url)}));
  const schoolHandlers=createSchoolHandlers(window.webContents,url,{store:schoolStore,fetch:(target,init)=>schoolSession.fetch(target,init)});
  for(const [action,handler] of Object.entries(schoolHandlers))if(action!=='dispose'&&action!=='flush')ipcMain.handle(`p2:school:${action}`,handler);
  window.on('close',schoolHandlers.dispose);window.webContents.on('will-navigate',schoolHandlers.dispose);window.webContents.on('render-process-gone',schoolHandlers.dispose);app.on('before-quit',schoolHandlers.dispose);
  const aiSession=session.fromPartition('ai-api-egress');
  aiSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  aiSession.setPermissionCheckHandler(()=>false);
  aiSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!allowedAiUrl(details.url)}));
  const aiService=new AiService({chatGptSupported:process.platform==='win32',vault:new EncryptedAiVault(join(userData,'work-data','ai'),{
   available:process.platform==='win32'&&safeStorage.isEncryptionAvailable(),encrypt:text=>safeStorage.encryptString(text),decrypt:bytes=>safeStorage.decryptString(bytes)}),
   fetch:(target,init)=>aiSession.fetch(target,init),readClipboard:()=>clipboard.readText(),clearClipboard:async expected=>{if(await clipboard.readText()===expected)await clipboard.clear();},
   reviewKey:async input=>(await dialog.showMessageBox(window,{type:'question',message:`클립보드의 ${input.provider==='openai'?'OpenAI':'Gemini'} API Key로 연결할까요?`,detail:`명시적으로 복사한 API Key만 사용해 주세요. 모델 목록 조회를 위해 해당 제공자에게 Key를 전송합니다. 연결 성공 후 클립보드에서 이 값을 지웁니다. ${input.remember?'Windows 암호화로 이 Electron 프로필에 저장하며 이전 저장 연결을 대체합니다.':'앱 메모리에서만 사용하며 이전 Electron 저장 연결은 제거합니다.'} Tauri 인증정보는 읽거나 변경하지 않습니다.`,buttons:['취소','API 연결'],defaultId:0,cancelId:0})).response===1,
   reviewSend:async(request,connection)=>(await dialog.showMessageBox(window,{type:'warning',message:`${connection.provider} · ${connection.model}에 이 내용을 전송할까요?`,detail:`${request.tool} · API 사용 요금이 발생할 수 있습니다. 개인정보가 없는지 확인하세요.\n\n${request.prompt}`,buttons:['취소','확인 후 외부 전송'],defaultId:0,cancelId:0})).response===1});
  const chatgptProcess=new ChatGptProcess(app.isPackaged?join(process.resourcesPath,'chatgpt-auth-cli','chatgpt-auth-cli.exe'):join(app.getAppPath(),'../../tools/chatgpt-auth-cli/target/debug/chatgpt-auth-cli.exe'),join(userData,'work-data','chatgpt'),target=>shell.openExternal(target));
  const chatgptService=new ChatGptService(chatgptProcess,async(request,model)=>(await dialog.showMessageBox(window,{type:'warning',message:`ChatGPT 요금제 · ${model}에 이 내용을 전송할까요?`,detail:`${request.tool} · ChatGPT plan/credits 한도가 적용됩니다. API Key로 자동 전환하지 않습니다. 개인정보를 넣지 마세요.\n\n${request.prompt}`,buttons:['취소','확인 후 외부 전송'],defaultId:0,cancelId:0})).response===1);
  for(const [action,handler] of Object.entries(createChatGptHandlers(window.webContents,url,chatgptService)))ipcMain.handle(`p2:chatgpt:${action}`,handler);
  const recordProcess=new RecordHelperProcess(app.isPackaged?join(process.resourcesPath,'record-helper-cli',process.platform==='win32'?'record-helper-cli.exe':'record-helper-cli'):join(app.getAppPath(),'../../build/record-helper-cli',process.platform==='win32'?'record-helper-cli.exe':'record-helper-cli'));
  const recordHandlers=createRecordHelperHandlers(window.webContents,url,{extractor:recordProcess,chatgpt:chatgptService,pick:async()=>{const r=await dialog.showOpenDialog(window,{title:'활동보고서 선택 · 세션 메모리 전용',properties:['openFile','multiSelections','dontAddToRecent'],filters:[{name:'활동보고서 PDF/HWP/HWPX/DOCX',extensions:['pdf','hwp','hwpx','docx']}]});return r.canceled?undefined:r.filePaths;}});
  for(const [action,handler] of Object.entries(recordHandlers))if(action!=='dispose'&&action!=='flush')ipcMain.handle(`p2:record:${action}`,handler);
  window.on('closed',()=>recordHandlers.dispose());window.webContents.on('will-navigate',()=>recordHandlers.dispose());window.webContents.on('render-process-gone',()=>recordHandlers.dispose());

  window.on('close',()=>chatgptService.dispose());window.webContents.on('will-navigate',()=>chatgptService.dispose());window.webContents.on('render-process-gone',()=>chatgptService.dispose());app.on('before-quit',()=>chatgptService.dispose());
  const aiHandlers=createAiHandlers(window.webContents,url,aiService);
  for(const [action,handler] of Object.entries(aiHandlers))ipcMain.handle(`p2:ai:${action}`,handler);
  window.on('close',()=>aiService.dispose());window.webContents.on('will-navigate',()=>aiService.dispose());window.webContents.on('render-process-gone',()=>aiService.dispose());app.on('before-quit',()=>aiService.dispose());
  const financeWorker=new FinanceProcess(app.isPackaged?join(process.resourcesPath,'my-finance-cli','my-finance-cli.exe'):join(app.getAppPath(),'../../tools/my-finance-cli/target/debug/my-finance-cli.exe'),join(userData,'work-data','my-finance'));
  const financeService=new FinanceService({worker:financeWorker,protectedRoot:userData,
   pickBackup:async()=>{const r=await dialog.showOpenDialog(window,{title:'MY FINANCE 암호화 백업 선택',properties:['openFile','dontAddToRecent'],filters:[{name:'암호화 백업',extensions:['bgfnbk']}]});return r.canceled?undefined:r.filePaths[0];},
   saveBackup:async()=>{const r=await dialog.showSaveDialog(window,{title:'MY FINANCE 암호화 백업 새 파일 저장',defaultPath:'my-finance.bgfnbk',properties:['dontAddToRecent'],filters:[{name:'암호화 백업',extensions:['bgfnbk']}]});return r.canceled?undefined:r.filePath;},
   reviewRestore:async()=>(await dialog.showMessageBox(window,{type:'warning',message:'검사한 암호화 백업을 Electron 금융 저장소에 복원할까요?',detail:'기존 Tauri 저장소는 변경하지 않습니다. 현재 상태와 이력이 다시 검사되며 복구 실패 시 원본을 보존합니다.',buttons:['취소','확인 후 복원'],defaultId:0,cancelId:0})).response===1});
  const financeHandlers=createFinanceHandlers(window.webContents,url,financeService);
  for(const [action,handler] of Object.entries(financeHandlers))ipcMain.handle(`p2:finance:${action}`,handler);
  window.on('close',()=>{void financeService.close();});window.webContents.on('will-navigate',()=>{void financeService.close();});window.webContents.on('render-process-gone',()=>{void financeService.close();});
  const meta = JSON.parse(await readFile(join(app.getAppPath(),'build-meta.json'),'utf8')) as {sourceSha:string};
  for (const channel of ['p0:info','p0:read-settings','p0:write-settings']) ipcMain.handle(channel,async(event,...args: unknown[])=>{
    assertSender(event,window.webContents,url);
    if (args.length !== (channel === 'p0:write-settings' ? 1 : 0)) throw new Error('Invalid PoC IPC arguments');
    if (channel === 'p0:info') return {appId:APP_ID,productName:PRODUCT_NAME,userData,sourceSha:meta.sourceSha,electron:process.versions.electron,...(qaPaths.qa?{qaProfile:{root:qaPaths.root,appData:app.getPath('appData'),sessionData:app.getPath('sessionData'),stores:['poc-settings','work-data/local-tasks','work-data/purchase-settings','work-data/quick-memo','work-data/education-video','work-data/school-profile','work-data/school-admin','work-data/inventory','work-data/ai','work-data/chatgpt','work-data/my-finance','work-data/youtube-search','work-data/newsletter-projects','work-data/official-import-tmp','work-data/purchase-import-tmp'].map(p=>join(userData,p))}}:{})};
    if (channel === 'p0:read-settings') return store.read();
    return store.write(args[0]);
  });
  for(const [action,handler] of Object.entries(createPurchaseSettingsHandlers(window.webContents,url,purchaseSettingsStore)))ipcMain.handle(`p2:purchase:settings:${action}`,handler);
  const officialService=new OfficialDocumentService(app.isPackaged?join(process.resourcesPath,'official-document-cli',process.platform==='win32'?'official-document-cli.exe':'official-document-cli'):join(app.getAppPath(),'../../tools/official-document-cli/target/debug',process.platform==='win32'?'official-document-cli.exe':'official-document-cli'),join(userData,'work-data','official-import-tmp'));
  const officialFiles=createOfficialDocumentHandlers(window.webContents,url,{service:officialService,
   pick:async()=>{const r=await dialog.showOpenDialog(window,{title:'합성 공문 가져오기',properties:['openFile'],filters:[{name:'공문 PDF/HWPX/ODT',extensions:['pdf','hwpx','odt']}]});return r.canceled?undefined:r.filePaths[0];},
   save:async()=>{const r=await dialog.showSaveDialog(window,{title:'검토한 공문을 새 ODT로 저장',defaultPath:'공문_초안.odt',filters:[{name:'OpenDocument Text',extensions:['odt']}],properties:['dontAddToRecent']});return r.canceled?undefined:r.filePath;},
   review:async()=>(await dialog.showMessageBox(window,{type:'question',message:'미리보기와 개인정보 경고를 확인하고 승인 템플릿으로 저장할까요?',detail:'새 파일만 저장합니다. 기존 파일을 선택하면 덮어쓰지 않고 거절합니다. 원본 서식과 표 구조 보존은 지원하지 않습니다.',buttons:['취소','검토 후 저장'],defaultId:0,cancelId:0})).response===1});
  ipcMain.handle('p2:official-document:pick',officialFiles.pick);ipcMain.handle('p2:official-document:save',officialFiles.save);ipcMain.handle('p2:official-document:cancel',officialFiles.cancel);
  window.on('close',officialFiles.dispose);app.on('before-quit',officialFiles.dispose);
  const excelService=new ExcelService(app.isPackaged?join(process.resourcesPath,'purchase-excel-cli','purchase-excel-cli.exe'):join(app.getAppPath(),'../../tools/purchase-excel-cli/target/debug',process.platform==='win32'?'purchase-excel-cli.exe':'purchase-excel-cli'),join(userData,'work-data','purchase-import-tmp'));
  const adminProbeSession=session.fromPartition('admin-launcher-check');
  adminProbeSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));adminProbeSession.setPermissionCheckHandler(()=>false);
  adminProbeSession.on('will-download',event=>event.preventDefault());
  adminProbeSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:details.method!=='HEAD'||!allowedAdminProbeUrl(details.url)}));
  adminProbeSession.allowNTLMCredentialsForDomains('');
  const adminProbe=createAdminProbeClient((target,init)=>adminProbeSession.fetch(target,init));
  app.on('select-client-certificate',adminProbe.denyCertificate);
  const releaseAdminProbe=()=>app.removeListener('select-client-certificate',adminProbe.denyCertificate);
  window.on('closed',releaseAdminProbe);app.on('will-quit',releaseAdminProbe);
  const adminHandlers=createAdminHandlers(window.webContents,url,{store:adminStore,excel:excelService,protectedRoot:userData,
   school:async()=>(await schoolStore.load()).document.school,
   inspect:(target,signal)=>inspectAdminConnection(adminProbe.fetch,target,signal),
   pick:async()=>{const r=await dialog.showOpenDialog(window,{title:'학교 행정 검토용 CSV/XLSX 선택',properties:['openFile','dontAddToRecent'],filters:[{name:'검토용 표',extensions:['csv','xlsx']}]});return r.canceled?undefined:r.filePaths[0];},
   save:async()=>{const r=await dialog.showSaveDialog(window,{title:'학교 행정 검토용 CSV 저장',defaultPath:'학교행정_검토용.csv',properties:['dontAddToRecent'],filters:[{name:'검토용 CSV',extensions:['csv']}]});return r.canceled?undefined:r.filePath;},
   openExternal:target=>shell.openExternal(target,{activate:true}),copy:text=>clipboard.writeText(text),
   review:async(message,text)=>(await dialog.showMessageBox(window,{type:'question',message,detail:'인증정보와 개인정보가 없는지 검토하세요. 로그인 자동화·실제 신청·상신은 하지 않습니다.\n\n'+text,buttons:['취소','확인 후 진행'],defaultId:0,cancelId:0})).response===1});
  for(const [action,handler] of Object.entries(adminHandlers))if(action!=='dispose'&&action!=='flush')ipcMain.handle(`p2:admin:${action}`,handler);
  window.on('close',adminHandlers.dispose);window.webContents.on('will-navigate',adminHandlers.dispose);window.webContents.on('render-process-gone',adminHandlers.dispose);
  const ocrRuntime=app.isPackaged?join(process.resourcesPath,'purchase-ocr'):join(app.getAppPath(),'../purchase-ocr');
  let purchaseAi:PurchaseAiService|undefined;
  const imageImport=createImageImportHandlers(window.webContents,url,{
   tempRoot:app.getPath('temp'),onInvalidate:()=>purchaseAi?.cancel(),ready:()=>verifyOcrRuntime(ocrRuntime),
   select:async()=>{const r=await dialog.showOpenDialog(window,{title:'장바구니 이미지 선택 — 합성 자료만 사용',properties:['openFile','multiSelections','dontAddToRecent'],filters:[{name:'JPG/JPEG/PNG',extensions:['jpg','jpeg','png']}]});return r.canceled?undefined:r.filePaths;},
   decode:bytes=>{const image=nativeImage.createFromBuffer(bytes);if(image.isEmpty())throw Error('이미지를 해독하지 못했습니다.');const size=image.getSize(),scale=Math.min(240/size.width,160/size.height,1);return {...size,png:image.toPNG(),perceptualHash:perceptualHash(image.resize({width:9,height:8}).toBitmap()),thumbnail:image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'good'}).toDataURL()};},
   recognize:(path,signal,options)=>recognizeImage(ocrRuntime,path,signal,undefined,undefined,options),
   preview:(bytes,region)=>{const image=nativeImage.createFromBuffer(bytes).crop({x:region[0],y:region[1],width:region[2]-region[0],height:region[3]-region[1]});if(image.isEmpty())throw Error('Invalid image crop');const size=image.getSize();let scale=Math.min(1,1600/Math.max(size.width,size.height));for(let i=0;i<4;i++){const url=image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'best'}).toDataURL();if(url.length<=4*1024*1024)return url;scale*=.65;}throw Error('Preview limit');},
  });
  purchaseAi=new PurchaseAiService({images:imageImport,backends:{
   openai:{context:()=>{const c=aiService.imageContext();return c?.provider==='openai'?c:null;},generate:(...args)=>aiService.generateImages(...args)},
   gemini:{context:()=>{const c=aiService.imageContext();return c?.provider==='gemini'?c:null;},generate:(...args)=>aiService.generateImages(...args)},
   chatgpt:{context:()=>chatgptService.imageContext(),generate:(...args)=>chatgptService.generateImages(...args)}},
   redact:(bytes,boxes)=>{const image=nativeImage.createFromBuffer(bytes);if(image.isEmpty())throw Error('Invalid image');const {width,height}=image.getSize();const copy=redactBitmap(image.toBitmap(),width,height,boxes);return {png:nativeImage.createFromBitmap(copy,{width,height,scaleFactor:1}).toPNG(),width,height};},
   review:async prepared=>(await dialog.showMessageBox(window,{type:'warning',message:`${prepared.provider} · ${prepared.model}에 이미지 ${prepared.images.length}장을 전송할까요?`,detail:'실제 학생·교직원·학교 개인정보나 배송지·연락처가 없는지 전송본을 확인하세요. API 이용료 또는 ChatGPT plan/credits 사용이 발생할 수 있습니다. 이미 전송된 이미지는 취소해도 회수되지 않습니다. 자동 재시도·다른 제공자 전환은 하지 않습니다.\n\n'+prepared.images.map((image,i)=>`${i+1}. ${image.name} · 가림 ${image.redactions}곳 · SHA-256 ${image.sha256}`).join('\n'),buttons:['취소','확인 후 이미지 전송'],defaultId:0,cancelId:0})).response===1});
  for(const [action,handler] of Object.entries(createPurchaseAiHandlers(window.webContents,url,purchaseAi)))ipcMain.handle(`p2:purchase:images:ai:${action}`,handler);
  window.on('close',()=>purchaseAi?.dispose());window.webContents.on('will-navigate',()=>purchaseAi?.dispose());window.webContents.on('render-process-gone',()=>purchaseAi?.dispose());app.on('before-quit',()=>purchaseAi?.dispose());
  ipcMain.handle('p2:purchase:images:preview',imageImport.preview);
  ipcMain.handle('p2:purchase:images:pick',imageImport.pick);ipcMain.handle('p2:purchase:images:analyze',imageImport.analyze);ipcMain.handle('p2:purchase:images:cancel',imageImport.cancel);
  window.on('close',imageImport.dispose);window.webContents.on('will-navigate',imageImport.dispose);window.webContents.on('render-process-gone',imageImport.dispose);app.on('before-quit',imageImport.dispose);
  const purchaseExport=createPurchaseExportHandler(window.webContents,url,{review:async summary=>(await dialog.showMessageBox(window,{type:'question',message:'선택 품목·수량·단가·합계를 확인하고 출력할까요?',detail:summary,buttons:['취소','확인 후 저장 위치 선택'],defaultId:0,cancelId:0})).response===1,generate:(request,signal)=>excelService.generateExport(request,signal),pick:async format=>{const r=await dialog.showSaveDialog(window,{title:'구매 품목 출력 저장',defaultPath:purchaseExportFileName(format),filters:[{name:format==='csv'?'CSV':'Excel',extensions:[format]}],properties:['dontAddToRecent']});return r.canceled?undefined:r.filePath;},confirm:async()=>(await dialog.showMessageBox(window,{type:'warning',message:'선택한 기존 파일을 덮어쓸까요?',detail:'저장 직전에 변경 여부를 다시 확인합니다. 다른 프로그램에서 편집 중이면 취소하고 새 파일로 저장해 주세요.',buttons:['취소','덮어쓰기'],defaultId:0,cancelId:0})).response===1});
  ipcMain.handle('p2:purchase:export',purchaseExport.handle);
  window.on('close',purchaseExport.dispose);app.on('before-quit',purchaseExport.dispose);
  const specialOutputs=(['settlement','edufine'] as const).map(kind=>{
   const preview=createSpecialPreview(window.webContents,url,kind,excelService);
   const output=createPurchaseExportHandler<SpecialOutput>(window.webContents,url,{
    review:async summary=>(await dialog.showMessageBox(window,{type:'question',message:'출력 품목·수량·금액·고정 열을 확인할까요?',detail:summary,buttons:['취소','확인 후 저장 위치 선택'],defaultId:0,cancelId:0})).response===1,
    generate:(request,signal)=>excelService.generateSpecial(request,signal),
    pick:async()=>{const r=await dialog.showSaveDialog(window,{title:kind==='edufine'?'에듀파인 XLSX 저장':'구매결과 XLSX 저장',defaultPath:specialFileName(kind),filters:[{name:'Excel',extensions:['xlsx']}],properties:['dontAddToRecent']});return r.canceled?undefined:r.filePath;},
    confirm:async()=>(await dialog.showMessageBox(window,{type:'warning',message:'선택한 기존 XLSX를 덮어쓸까요?',detail:'저장 직전에 변경을 다시 검사합니다. 외부 편집 중이면 새 파일을 선택해 주세요.',buttons:['취소','덮어쓰기'],defaultId:0,cancelId:0})).response===1,
   },{validate:value=>validateSpecialOutput(value,kind),summary:specialSummary});
   ipcMain.handle(`p2:purchase:${kind}:preview`,preview.handle);ipcMain.handle(`p2:purchase:${kind}:export`,output.handle);
   const dispose=()=>{preview.dispose();output.dispose();};window.on('close',dispose);app.on('before-quit',dispose);
   return {dispose,flush:()=>output.flush()};
  });
  const excelHandlers=createExcelHandlers(window.webContents,url,async()=>{const r=await dialog.showOpenDialog(window,{title:'Purchase Helper Excel 가져오기',properties:['openFile'],filters:[{name:'Excel',extensions:['xlsx','xls']}]});return r.canceled?undefined:r.filePaths[0];},excelService);
  const pdfHandlers=createExcelHandlers(window.webContents,url,async()=>{const r=await dialog.showOpenDialog(window,{title:'Purchase Helper PDF 가져오기',properties:['openFile'],filters:[{name:'텍스트 PDF',extensions:['pdf']}]});return r.canceled?undefined:r.filePaths[0];},{analyze:(path,signal)=>excelService.analyzePdf(path,signal),map:(...args)=>excelService.map(...args)},'PDF');
  ipcMain.handle('p2:purchase:pdf:pick',pdfHandlers.pick);
  ipcMain.handle('p2:purchase:pdf:cancel',pdfHandlers.cancel);
  ipcMain.handle('p2:purchase:pdf:map',pdfHandlers.map);
  window.on('close',pdfHandlers.dispose);app.on('before-quit',pdfHandlers.dispose);
  ipcMain.handle('p2:purchase:excel:pick',excelHandlers.pick);
  ipcMain.handle('p2:purchase:excel:cancel',excelHandlers.cancel);
  ipcMain.handle('p2:purchase:excel:map',excelHandlers.map);
  window.on('close',excelHandlers.dispose);
  app.on('before-quit',excelHandlers.dispose);
  const purchaseImport=createPurchaseImportHandlers(window.webContents,url,async()=>{const result=await dialog.showOpenDialog(window,{title:'Purchase Helper CSV 가져오기',properties:['openFile'],filters:[{name:'CSV',extensions:['csv']}]});return result.canceled?undefined:result.filePaths[0];});
  ipcMain.handle('p2:purchase:csv:pick',purchaseImport.pick);
  ipcMain.handle('p2:purchase:csv:cancel',purchaseImport.cancel);
  ipcMain.handle('p2:purchase:csv:map',purchaseImport.map);
  ipcMain.handle('p2:purchase:copy',createPurchaseClipboardHandler(window.webContents,url,content=>clipboard.write([new ClipboardItem({'text/plain':content.text,...(content.html?{'text/html':content.html}:{})})])));
  const taskHandlers=createLocalTaskHandlers(window.webContents,url,taskStore);
  ipcMain.handle('p2:tasks:load',taskHandlers.load);ipcMain.handle('p2:tasks:save',taskHandlers.save);
  ipcMain.handle(SAMPLE_SUMMARY_CHANNEL,createSampleHandler(window.webContents,url));
  const memoHandlers=createMemoHandlers(window.webContents,url,memoStore);
  ipcMain.handle('p2:memo:read',memoHandlers.read);
  ipcMain.handle('p2:memo:write',memoHandlers.write);
  const finderSession=session.fromPartition('youtube-search-egress');
  finderSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));finderSession.setPermissionCheckHandler(()=>false);finderSession.on('will-download',event=>event.preventDefault());
  finderSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:details.method!=='GET'||!allowedYoutubeUrl(details.url)}));
  const finderSearch=new FinderSearchService({vault:new EncryptedYoutubeVault(join(userData,'work-data','youtube-search'),{
   available:process.platform==='win32'&&safeStorage.isEncryptionAvailable(),encrypt:text=>safeStorage.encryptString(text),decrypt:bytes=>safeStorage.decryptString(bytes)}),
   fetch:(target,init)=>finderSession.fetch(target,init),readClipboard:()=>clipboard.readText(),clearClipboard:async expected=>{if((await clipboard.readText()).trim()===expected)await clipboard.clear();},
   reviewKey:async remember=>(await dialog.showMessageBox(window,{type:'question',message:'클립보드의 Key를 YouTube Data API v3 전용으로 등록할까요?',detail:`Google Cloud에서 YouTube Data API v3를 활성화하고 키 제한을 확인하세요. Gemini API 연결과 별도입니다. 지금은 Key만 등록하며 실제 검색·이용 권한 확인은 하지 않습니다. ${remember?'Windows 보안 저장에 암호화합니다.':'이 실행 동안 메모리에서만 사용하며 이전 YouTube 저장 Key는 제거합니다.'} 기존 AI Key는 변경하지 않습니다.`,buttons:['취소','Key 등록'],defaultId:0,cancelId:0})).response===1,
   reviewSearch:async(query,page)=>(await dialog.showMessageBox(window,{type:'warning',message:`YouTube 공식 API로 교육영상을 검색할까요? (${page}/3페이지)`,detail:`전송할 검색어: ${query}\n\n검색어에 학생·교직원 개인정보가 없는지 확인하세요. 보관함·메모·원고는 전송하지 않습니다. YouTube Data API 할당량이 사용됩니다. 자동 추가 검색·다른 제공자 전환은 없습니다.`,buttons:['취소','검색어 외부 전송'],defaultId:0,cancelId:0})).response===1,
   openExternal:target=>shell.openExternal(target,{activate:true}),library:async()=>(await educationVideoStore.load()).library});
  for(const [action,handler] of Object.entries(createFinderSearchHandlers(window.webContents,url,finderSearch)))ipcMain.handle(`p2:education-video:search:${action}`,handler);
  window.on('close',()=>finderSearch.dispose());window.webContents.on('will-navigate',()=>finderSearch.dispose());window.webContents.on('render-process-gone',()=>finderSearch.dispose());app.on('before-quit',()=>finderSearch.dispose());
  const educationVideoHandlers=createEducationVideoHandlers(window.webContents,url,educationVideoStore);
  ipcMain.handle('p2:education-video:load',educationVideoHandlers.load);
  ipcMain.handle('p2:education-video:save',educationVideoHandlers.save);
  ipcMain.handle('p2:education-video:import',educationVideoHandlers.import);
  ipcMain.handle('p2:education-video:export',educationVideoHandlers.export);
  const educationVideoExport=createEducationVideoExport(window.webContents,url,educationVideoStore,{protectedRoot:userData,pick:async()=>{const r=await dialog.showSaveDialog(window,{title:'교육영상 라이브러리 JSON 저장',defaultPath:'education-video-library-v1.json',filters:[{name:'JSON',extensions:['json']}],properties:['dontAddToRecent']});return r.canceled?undefined:r.filePath;},confirm:async()=>(await dialog.showMessageBox(window,{type:'warning',message:'선택한 기존 JSON 파일을 덮어쓸까요?',detail:'저장 직전에 파일 변경 여부를 확인합니다. 기존 라이브러리와 백업은 변경하지 않습니다.',buttons:['취소','덮어쓰기'],defaultId:0,cancelId:0})).response===1});
  ipcMain.handle('p2:education-video:export-file',educationVideoExport.handle);
  window.webContents.on('will-navigate',()=>educationVideoExport.dispose());window.webContents.on('render-process-gone',()=>educationVideoExport.dispose());
  ipcMain.handle('p2:education-video:recover',educationVideoHandlers.recover);
  const finderCompat=createFinderCompatHandlers(window.webContents,url,educationVideoStore,{pick:async()=>{const r=await dialog.showOpenDialog(window,{title:'Finder V1/V2 JSON 선택 · 검토 후 적용',filters:[{name:'Finder JSON',extensions:['json']}],properties:['openFile','dontAddToRecent']});return r.canceled?undefined:r.filePaths[0];}});
  for(const [action,handler] of Object.entries(finderCompat))if(action!=='dispose'&&action!=='flush')ipcMain.handle(`p2:education-video:compat:${action}`,handler);
  const finderV2Export=createEducationVideoExport(window.webContents,url,educationVideoStore,{version:2,protectedRoot:userData,pick:async()=>{const r=await dialog.showSaveDialog(window,{title:'Finder V2 원본·교사·AI 기록 JSON 저장',defaultPath:'education-video-library-v2.json',filters:[{name:'JSON',extensions:['json']}],properties:['dontAddToRecent']});return r.canceled?undefined:r.filePath;},confirm:async()=>(await dialog.showMessageBox(window,{type:'warning',message:'선택한 기존 V2 JSON 파일을 덮어쓸까요?',buttons:['취소','덮어쓰기'],defaultId:0,cancelId:0})).response===1});
  ipcMain.handle('p2:education-video:compat:exportV2File',finderV2Export.handle);
  window.on('closed',()=>{finderCompat.dispose();finderV2Export.dispose();});window.webContents.on('will-navigate',()=>{finderCompat.dispose();finderV2Export.dispose();});window.webContents.on('render-process-gone',()=>{finderCompat.dispose();finderV2Export.dispose();});

  const inventoryQa=new InventoryQaService({readExecutionState:()=>({packaged:app.isPackaged,devUrl:dev,optIn:process.env.INVENTORY_LOCAL_QA})},()=>process.env.INVENTORY_LOCAL_QA_PUBLIC_KEY??'');
  for(const action of INVENTORY_QA_ACTIONS)ipcMain.handle(`p2:inventory-local-qa:${action}`,inventoryQaHandler(inventoryQa,action,window.webContents,url));
  window.on('close',()=>inventoryQa.close());window.webContents.on('will-navigate',()=>inventoryQa.close());window.webContents.on('render-process-gone',()=>inventoryQa.close());
  ipcMain.handle('p2:inventory-local-qa:status',createInventoryQaStatusHandler(window.webContents,url,{packaged:app.isPackaged,devUrl:dev,optIn:process.env.INVENTORY_LOCAL_QA}));
  ipcMain.handle('p2:inventory:load',async(event,...args:unknown[])=>{try{assertSender(event,window.webContents,url);if(args.length)throw Error('Invalid input');return {ok:true,data:await inventoryStore.load()};}catch{return {ok:false,error:{code:'STORAGE_ERROR',message:'격리된 재고를 불러오지 못했습니다. 기존 파일은 유지됩니다.',retryable:true}};}});
  ipcMain.handle('p2:inventory:save',async(event,document:unknown,...args:unknown[])=>{try{assertSender(event,window.webContents,url);if(args.length>1||(args.length===1&&args[0]!==null&&typeof args[0]!=='string'))throw Error('Invalid input');return {ok:true,data:await inventoryStore.save(document,args[0] as string|null|undefined)};}catch(error){return {ok:false,error:{code:error instanceof InventoryConflict?'CONFLICT':'STORAGE_ERROR',message:error instanceof InventoryConflict?'재고가 변경됐습니다. 다시 불러온 뒤 확인해 주세요.':'재고 기록을 저장하지 못했습니다. 기존 파일은 유지됩니다.',retryable:true}};}});
  ipcMain.handle('p2:newsletter:save-json',createNewsletterSaveHandler(window.webContents,url,{
   validate:async json=>{await callOwnedNewsletter('validateStoredNewsletter',{json,barrier:{ids:[],hashes:[]}},renderer,dev);},
   pick:async()=>{const r=await dialog.showSaveDialog(window,{title:'원고·디자인 JSON 저장',defaultPath:'newsletter.json',filters:[{name:'Newsletter JSON',extensions:['json']}]});return r.canceled?undefined:r.filePath;},
   confirm:async()=>(await dialog.showMessageBox(window,{type:'warning',message:'선택한 JSON 파일을 덮어쓸까요?',buttons:['취소','덮어쓰기'],defaultId:0,cancelId:0})).response===1,
  }));
  ipcMain.handle('p2:newsletter:export',createNewsletterExportHandler(window.webContents,url,{
   generate:r=>generateInOwnedWindow(r,renderer,dev),
   approve:async summary=>(await dialog.showMessageBox(window,{type:'question',message:'검증된 문서로 이번 출력을 저장할까요?',detail:summary+'\n이 확인은 자산 승인 상태를 변경하지 않습니다.',buttons:['취소','이번 출력 저장'],defaultId:0,cancelId:0})).response===1,
   pick:async selection=>{if(selection==='card-pngs'){const r=await dialog.showOpenDialog(window,{title:'카드 PNG 새 묶음 폴더를 만들 위치',properties:['openDirectory']});return r.canceled?undefined:r.filePaths[0];}const png=selection==='a4-png';const r=await dialog.showSaveDialog(window,{title:'소식지 출력 저장',defaultPath:selection==='cards-pdf'?'newsletter-cards.pdf':png?'newsletter-a4.png':'newsletter-a4.pdf',filters:[{name:png?'PNG':'PDF',extensions:[png?'png':'pdf']}]});return r.canceled?undefined:r.filePath;},
   confirm:async()=>(await dialog.showMessageBox(window,{type:'warning',message:'선택한 출력 파일을 덮어쓸까요?',buttons:['취소','덮어쓰기'],defaultId:0,cancelId:0})).response===1,
  }));
  const projects=new NewsletterProjects(join(userData,'work-data','newsletter-projects'),async(json,barrier)=>{const normalized=await callOwnedNewsletter('validateStoredNewsletter',{json,barrier},renderer,dev);if(typeof normalized!=='string')throw Error('Invalid validated document');return normalized;});
  for(const action of PROJECT_ACTIONS)ipcMain.handle(`p2:newsletter:projects:${action}`,createProjectHandler(action,window.webContents,url,projects,async info=>(await dialog.showMessageBox(window,{type:'warning',message:'미리 본 revision으로 원고를 복구할까요?',detail:`프로젝트 ${info.projectId} · 현재 revision ${info.currentRevision}\nrevision ${info.sourceRevision} 내용을 새 revision ${info.currentRevision+1}로 복구합니다.\n현재 편집 내용은 선택한 revision으로 대체됩니다. 기존 저장 이력은 보존하며 출력 승인 권한은 부여하지 않습니다.`,buttons:['취소','확인 후 복구'],defaultId:0,cancelId:0})).response===1));
  const show=()=>{if(window.isMinimized())window.restore();window.show();window.focus();};
  const persist=async()=>{
    try{await desktopStore.write(desktop);return true;}
    catch{desktop.closeBehavior='quit';refreshMenu();return false;}
  };
  const capture=()=>{if(!window.isDestroyed()&&!window.isMinimized()){desktop.bounds=fitBounds(window.getNormalBounds(),screen.getAllDisplays().map(d=>d.workArea));desktop.maximized=window.isMaximized();}};
  const quit=()=>{if(quitting)return;quitting=true;recordHandlers.dispose();finderCompat.dispose();finderV2Export.dispose();finderSearch.dispose();purchaseAi?.dispose();chatgptService.dispose();imageImport.dispose();schoolHandlers.dispose();adminHandlers.dispose();officialFiles.dispose();educationVideoExport.dispose();specialOutputs.forEach(o=>o.dispose());purchaseExport.dispose();excelHandlers.dispose();pdfHandlers.dispose();clearTimeout(timer);capture();void persist().then(()=>Promise.all([recordHandlers.flush(),finderSearch.flush(),finderV2Export.flush(),chatgptService.flush(),imageImport.flush(),adminStore.flush(),schoolStore.flush(),financeService.close(),store.flush(),purchaseSettingsStore.flush(),desktopStore.flush(),memoStore.flush(),taskStore.flush(),educationVideoStore.flush(),educationVideoExport.flush(),inventoryStore.flush(),projects.flush(),excelService.flush(),officialService.flush(),purchaseExport.flush(),...specialOutputs.map(o=>o.flush())])).finally(()=>{tray?.destroy();app.quit();});};
  const refreshMenu=()=>{
    const items:Electron.MenuItemConstructorOptions[]=[
      {label:'창 열기',click:show},{label:'최소화',click:()=>window.minimize()},
      {label:'닫을 때 트레이로 숨기기',type:'checkbox',checked:desktop.closeBehavior==='tray',enabled:tray!==null,click:async item=>{desktop.closeBehavior=item.checked?'tray':'quit';await persist();refreshMenu();}},
      {type:'separator'},{label:'완전 종료',click:quit}
    ];
    tray?.setContextMenu(Menu.buildFromTemplate(items));
    Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'창',submenu:items}]));
  };
  try{const icon=nativeImage.createFromPath(join(app.getAppPath(),'tray.png'));if(icon.isEmpty())throw Error('No tray icon');tray=new Tray(icon);tray.setToolTip(PRODUCT_NAME);tray.on('double-click',show);}catch{desktop.closeBehavior='quit';}
  refreshMenu();
  const changed=()=>{clearTimeout(timer);timer=setTimeout(()=>{capture();void persist();},250);};
  window.on('move',changed);window.on('resize',changed);window.on('maximize',changed);window.on('unmaximize',changed);
  const adjust=()=>{const bounds=fitBounds(window.getNormalBounds(),screen.getAllDisplays().map(d=>d.workArea));window.setBounds(bounds);changed();};
  screen.on('display-added',adjust);screen.on('display-removed',adjust);screen.on('display-metrics-changed',adjust);
  app.on('second-instance',show);
  window.once('ready-to-show',()=>{if(desktop.maximized)window.maximize();window.show();});
  window.on('close',event=>{if(quitting)return;event.preventDefault();if(desktop.closeBehavior==='tray'&&tray){capture();window.hide();void persist().then(ok=>{if(!ok)show();});}else quit();});
  app.on('before-quit',event=>{if(!quitting){event.preventDefault();quit();}});
  app.on('window-all-closed',quit);
  await window.loadURL(url);
  }).catch((error: unknown)=>{ console.error('Electron P0 startup failed:', error instanceof Error ? error.message : 'unknown'); app.exit(1); });
}
