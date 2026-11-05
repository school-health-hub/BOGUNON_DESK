import {build} from 'vite';import {resolve} from 'node:path';
if(process.platform!=='win32')throw Error('Windows native provider build only');
await build({configFile:false,plugins:[{name:'isolated-windows-pg-port',resolveId(source,importer){if(importer?.replaceAll('\\','/').endsWith('/school05/server/provider.ts')&&source==='./local-db.js')return resolve('scripts/qa/school05-native-pg.ts');}}],build:{ssr:'school-workspace/school05/server/provider.ts',outDir:'build/school05-qa',emptyOutDir:true,rollupOptions:{output:{entryFileNames:'provider.mjs'}}}});
