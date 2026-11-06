import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Windows checkout EOL/cache policy must not change frozen SQL, ZIP or evidence blobs.
const entries=execFileSync('git',['ls-tree','-r','-z','HEAD','--','school-workspace']).toString('utf8').split('\0').filter(Boolean);
for(const entry of entries){
 const [meta,path]=entry.split('\t'),[mode,kind,expected]=meta.split(' ');
 if(kind!=='blob'||!['100644','100755'].includes(mode)||!path.startsWith('school-workspace/'))throw Error('Unexpected frozen source entry');
 const bytes=execFileSync('git',['show','HEAD:'+path],{maxBuffer:16777216});writeFileSync(path,bytes);
 const actual=readFileSync(path),hash=createHash('sha1').update(Buffer.from('blob '+actual.length+'\0')).update(actual).digest('hex');
 if(hash!==expected)throw Error('Frozen source blob mismatch: '+path);
}
// Refresh the index's checkout conversion state, then prove the committed tree is unchanged.
execFileSync('git',['add','--renormalize','--','school-workspace']);
execFileSync('git',['diff','--cached','--exit-code','HEAD'],{stdio:'inherit'});
console.log('PASS canonical frozen Git blobs; index tree unchanged:',entries.length);
