import {build} from 'vite';import {resolve} from 'node:path';import {readFile} from 'node:fs/promises';
if(process.platform!=='win32'&&!process.argv.includes('--verify-bundle-only'))throw Error('Windows native provider build only');
await build({configFile:false,plugins:[{name:'isolated-windows-pg-port',enforce:'pre',resolveId(source,importer){if(importer?.replaceAll('\\','/').endsWith('/school05/server/provider.ts')&&source==='./local-db.js')return resolve('scripts/qa/school05-native-pg.ts');}}],build:{ssr:'school-workspace/school05/server/provider.ts',outDir:'build/school05-qa',emptyOutDir:true,rollupOptions:{output:{entryFileNames:'provider.mjs'}}}});

const bundled=await readFile('build/school05-qa/provider.mjs','utf8');if(!bundled.includes('SCHOOL05_PG_PORT')||bundled.includes('bogunon-school05-pg'))throw Error('Native QA backend bundling mismatch');
