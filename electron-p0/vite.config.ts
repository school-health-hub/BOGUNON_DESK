import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('./renderer',import.meta.url));
const fixture=(name:string)=>fileURLToPath(new URL(`./renderer/adapters/${name}.ts`,import.meta.url));
export default defineConfig({root,base:'./',envDir:root,envPrefix:'ELECTRON_P0_PUBLIC_',publicDir:false,plugins:[react(),{
  name:'p0-closed-renderer',enforce:'pre',
  resolveId(source,importer){if(source==='./NewsletterOutputControls'&&importer?.endsWith('/newsletter/rendering/NewsletterDesignEditor.tsx'))return fileURLToPath(new URL('./renderer/adapters/NewsletterOutputDisabled.tsx',import.meta.url));if(/(?:^|\/)MemoWidget(?:\.tsx)?$/.test(source))return fileURLToPath(new URL('./renderer/adapters/PersistentMemo.tsx',import.meta.url));if(source==='react-grid-layout'&&importer?.replaceAll('\\','/').endsWith('/src/components/dashboard/DesktopWidgetLayout.tsx'))return fileURLToPath(new URL('./renderer/adapters/GridLayout.tsx',import.meta.url));},
  generateBundle(){
    const modules=[...this.getModuleIds()].map(p=>p.replaceAll('\\','/'));
    const forbidden=modules.filter(p=>/@tauri-apps|@supabase|\/src\/(auth|ai|chatgpt|my-finance|purchase|official-document|record-helper)\//.test(p));
    if(forbidden.length)this.error(`Forbidden production dependency in PoC: ${forbidden.join(', ')}`);
    this.emitFile({type:'asset',fileName:'p0-renderer-boundary.json',source:JSON.stringify({closed:true,adapters:modules.filter(p=>p.includes('/electron-p0/renderer/adapters/')).map(p=>p.slice(p.lastIndexOf('/electron-p0/')+1)),reused:modules.filter(p=>p.includes('/src/')).map(p=>p.slice(p.lastIndexOf('/src/')+1))},null,2)});
  }
}],resolve:{alias:[
 {find:/^.*\/workspace-data\/WorkspaceDataContext$/,replacement:fixture('workspace')},
 {find:/^.*\/meal\/MealDataContext$/,replacement:fixture('meal')},
 {find:/^.*\/weather\/WeatherDataContext$/,replacement:fixture('weather')},
 {find:/^.*\/desktop\/actions$/,replacement:fixture('actions')},
]},server:{host:'127.0.0.1',port:5174,strictPort:true,fs:{allow:[fileURLToPath(new URL('..',import.meta.url))]}},build:{outDir:'../../build/electron-p0-app/renderer',emptyOutDir:true}});
