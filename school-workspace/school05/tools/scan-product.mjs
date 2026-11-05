import{readdir,readFile,writeFile}from'node:fs/promises';import{join}from'node:path';
const all=async root=>(await Promise.all((await readdir(root,{withFileTypes:true})).map(async e=>e.isDirectory()?all(join(root,e.name)):[join(root,e.name)]))).flat();
const paths=(await all('build/electron-p0-app')).filter(p=>/\.(js|cjs|mjs)$/.test(p));const forbidden=/SCHOOL01C_MOCK|MOCK_ACCESS_PRIVATE|SyntheticIdentityProvider|M-SYNTH-|bogunon-school05-pg/;
for(const p of paths)if(forbidden.test(await readFile(p,'utf8')))throw Error('Synthetic secret/provider fixture in product: '+p);
const builder=JSON.parse(await readFile('electron-p0/builder.json','utf8'));if(!builder.files.includes('workspace-protocol.js'))throw Error('Missing protocol in package manifest');
if(builder.files.some(p=>p.includes('school05-qa')))throw Error('QA provider included in product manifest');
await writeFile('school-workspace/school05/evidence/product-boundary.json',JSON.stringify({result:'PASS',scanned_product_js:paths.length,synthetic_markers:0,qa_provider_outside_app:true,protocol_packaged:true,windowsReal:'NOT RUN'},null,2));console.log('Production product boundary PASS');
