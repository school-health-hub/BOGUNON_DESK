import {build} from 'vite';
await build({configFile:false,build:{ssr:'school-workspace/hosted-h1/server/qa-provider.ts',outDir:'build/school-h1-qa',emptyOutDir:true,rollupOptions:{output:{entryFileNames:'provider.mjs'}}}});
