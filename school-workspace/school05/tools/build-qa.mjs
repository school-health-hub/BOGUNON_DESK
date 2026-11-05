import{build}from'vite';
await build({configFile:false,build:{ssr:'school-workspace/school05/server/provider.ts',outDir:'build/school05-qa',emptyOutDir:true,rollupOptions:{output:{entryFileNames:'provider.mjs'}}}});
