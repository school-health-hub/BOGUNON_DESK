import { defineConfig, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const local=(path:string)=>normalizePath(fileURLToPath(new URL(path,import.meta.url)));
const root=local('./renderer');
const fixture=(name:string)=>local(`./renderer/adapters/${name}.ts`);
export default defineConfig({root,base:'./',envDir:root,envPrefix:'ELECTRON_P0_PUBLIC_',publicDir:false,plugins:[react(),{
  name:'p0-closed-renderer',enforce:'pre',
  resolveId(source,importer){if(source==='./repository'&&importer?.replaceAll('\\','/').includes('/src/my-finance/'))return local('./renderer/finance/repository.ts');if(/(?:^|\/)WorkspaceDataNotice$/.test(source))return local('./renderer/local-tasks/LocalNotices.tsx');if(source==='./NewsletterOutputControls'&&importer?.endsWith('/newsletter/rendering/NewsletterDesignEditor.tsx'))return local('./renderer/adapters/NewsletterOutputControls.tsx');if(/(?:^|\/)MemoWidget(?:\.tsx)?$/.test(source))return local('./renderer/adapters/PersistentMemo.tsx');if(source==='react-grid-layout'&&importer?.replaceAll('\\','/').endsWith('/src/components/dashboard/DesktopWidgetLayout.tsx'))return local('./renderer/adapters/GridLayout.tsx');},
  generateBundle(){
    const modules=[...this.getModuleIds()].map(p=>p.replaceAll('\\','/'));
    // Context providers must retain one module identity on Windows as well as POSIX.
    if(modules.filter(p=>p.endsWith('/electron-p0/renderer/adapters/PersistentMemo.tsx')).length!==1)this.error('PersistentMemo must have exactly one canonical module identity');
    if(modules.filter(p=>p.endsWith('/electron-p0/renderer/local-tasks/LocalWorkspaceProvider.tsx')).length!==1)this.error('LocalWorkspaceProvider must retain one canonical module identity');
    const forbidden=modules.filter(p=>/tesseract\.js|@tesseract\.js-data|@tauri-apps|@supabase|\/src\/inventory-management\/connection\/|\/src\/(auth|ai|chatgpt|purchase|record-helper)\//.test(p));
    const financeAllowed=new Set(['FinanceScreen.tsx','FinanceConfirmation.tsx','FinanceTransfer.tsx','Phase2Workspace.tsx','IncomeForm.tsx','domain.ts','presentation.ts','finance.css']);
    forbidden.push(...modules.filter(p=>p.includes('/src/my-finance/')&&!financeAllowed.has(p.slice(p.lastIndexOf('/')+1))));
    if(forbidden.length)this.error(`Forbidden production dependency in PoC: ${forbidden.join(', ')}`);
    this.emitFile({type:'asset',fileName:'p0-renderer-boundary.json',source:JSON.stringify({closed:true,adapters:modules.filter(p=>p.includes('/electron-p0/renderer/adapters/')).map(p=>p.slice(p.lastIndexOf('/electron-p0/')+1)),reused:modules.filter(p=>p.includes('/src/')).map(p=>p.slice(p.lastIndexOf('/src/')+1))},null,2)});
  }
}],resolve:{alias:[
 {find:/^.*\/workspace-data\/WorkspaceDataContext$/,replacement:fixture('workspace')},
 {find:/^.*\/meal\/MealDataContext$/,replacement:fixture('meal')},
 {find:/^.*\/weather\/WeatherDataContext$/,replacement:fixture('weather')},
 {find:/^.*\/desktop\/actions$/,replacement:fixture('actions')},
]},server:{host:'127.0.0.1',port:5174,strictPort:true,fs:{allow:[fileURLToPath(new URL('..',import.meta.url))]}},build:{rollupOptions:{input:{app:fileURLToPath(new URL('./renderer/index.html',import.meta.url)),exportWorker:fileURLToPath(new URL('./renderer/export-worker.html',import.meta.url))}},outDir:'../../build/electron-p0-app/renderer',emptyOutDir:true}});
