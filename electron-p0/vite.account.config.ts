import {defineConfig} from 'vite';import {fileURLToPath} from 'node:url';
// Existing official SDK is bundled for Main only; never added to the closed renderer.
export default defineConfig({publicDir:false,envDir:false,build:{ssr:true,target:'node22',emptyOutDir:false,outDir:fileURLToPath(new URL('../build/electron-p0-app/main',import.meta.url)),lib:{entry:fileURLToPath(new URL('./main/account-sdk.ts',import.meta.url)),formats:['es'],fileName:()=> 'account-sdk.js'},rollupOptions:{external:[/^node:/],output:{codeSplitting:false}}},ssr:{noExternal:true}});
