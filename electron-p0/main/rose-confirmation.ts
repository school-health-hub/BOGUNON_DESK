import {BrowserWindow,session} from 'electron';
import {randomUUID} from 'node:crypto';

type ConfirmationCopy={title:string;message:string;action:string};
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]??char));
const activeParents=new WeakSet<BrowserWindow>();

// Main owns the one-shot decision. No preload, IPC channel or output summary is exposed.
export async function showRoseConfirmation(parent:BrowserWindow,copy:ConfirmationCopy):Promise<boolean>{
 if(parent.isDestroyed()||activeParents.has(parent))return false;
 const previous=BrowserWindow.getFocusedWindow();
 const isolated=session.fromPartition(`rose-confirmation-${randomUUID()}`);
 isolated.setPermissionCheckHandler(()=>false);
 isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 isolated.on('will-download',event=>event.preventDefault());
 const confirmation=new BrowserWindow({
  parent,modal:true,show:false,frame:false,skipTaskbar:true,width:460,height:230,
  minWidth:380,minHeight:220,resizable:false,backgroundColor:'#fffdfd',
  webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,webviewTag:false,session:isolated},
 });
 activeParents.add(parent);
 const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(copy.title)}</title><style>
 *{box-sizing:border-box}body{margin:0;background:#fffdfd;color:#243246;font:15px/1.55 'Pretendard','Malgun Gothic',sans-serif}main{height:100vh;display:flex;flex-direction:column;border:1px solid #e9dde2;border-radius:18px;overflow:hidden}header{padding:14px 22px;border-bottom:1px solid #e9dde2;display:flex;justify-content:space-between;align-items:center}h1{font-size:20px;margin:0;color:#713149}p{margin:0;padding:19px 22px;flex:1;overflow:auto;overflow-wrap:anywhere}footer{display:flex;justify-content:flex-end;gap:10px;padding:12px 22px 16px}button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:7px 16px;border:1px solid #8a7680;border-radius:10px;color:#243246;background:#fffdfd;font:inherit;font-weight:600;cursor:pointer}button.primary{background:#8a3f5b;color:white;border-color:#8a3f5b}button:hover{background:#fff0f5}button.primary:hover{background:#713149}button:focus-visible{outline:3px solid #8a3f5b;outline-offset:2px}.close{width:40px;height:40px;padding:0;font-size:22px;font-weight:400}
 </style></head><body><main role="dialog" aria-modal="true" aria-labelledby="title" aria-describedby="description"><header><h1 id="title">${escapeHtml(copy.title)}</h1><button class="close" type="button" id="close" aria-label="닫기">×</button></header><p id="description">${escapeHtml(copy.message)}</p><footer><button id="cancel" type="button">취소</button><button id="approve" type="button" class="primary">${escapeHtml(copy.action)}</button></footer></main></body></html>`;
 confirmation.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 let settle:(approved:boolean)=>void=()=>{};
 const decision=new Promise<boolean>(resolve=>{settle=resolve;});
 let finished=false;
 const finish=(approved:boolean)=>{if(finished)return;finished=true;settle(approved);if(!confirmation.isDestroyed())confirmation.close();};
 confirmation.webContents.on('will-navigate',(event,target)=>{event.preventDefault();finish(target==='bogunon-dialog://approve');});
 confirmation.webContents.on('will-redirect',event=>event.preventDefault());
 confirmation.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='Escape'){event.preventDefault();finish(false);}});
 const parentClosed=()=>finish(false);
 confirmation.on('closed',()=>{activeParents.delete(parent);parent.off('closed',parentClosed);if(!finished){finished=true;settle(false);}void isolated.clearStorageData();if(previous&&!previous.isDestroyed())previous.focus();else if(!parent.isDestroyed())parent.focus();});
 parent.once('closed',parentClosed);
 try{await confirmation.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);if(!finished){confirmation.show();await confirmation.webContents.executeJavaScript(`
  (()=>{const controls=[...document.querySelectorAll('button')];document.getElementById('cancel')?.focus();for(const control of controls)control.addEventListener('click',()=>{location.href=control.id==='approve'?'bogunon-dialog://approve':'bogunon-dialog://cancel';});document.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();location.href='bogunon-dialog://cancel';}
   if(event.key==='Tab'){const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  });})()
 `);}return await decision;}
 catch{finish(false);return false;}
}
