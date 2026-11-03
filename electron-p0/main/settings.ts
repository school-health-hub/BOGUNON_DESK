import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { P0Settings } from '../protocol.js';
const widgets = ['clock','today-summary','priority-task','monthly-calendar','today-tasks','quick-memo','quick-launcher','upcoming-schedule','dday','weekly-schedule','notifications','meal','weather'];
const dockIds = ['home','online-health-room','bogunon','toolbox','official-document','aed-check','record-helper','checkup-tools','work-folder','quick-memo','settings'];
function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function keys(v: Record<string, unknown>, allowed: string[]) { return Object.keys(v).every(k => allowed.includes(k)); }
function choice(v: unknown, options: string[]) { return typeof v === 'string' && options.includes(v); }
function integer(v: unknown, min: number, max: number): v is number { return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max; }
export function validateSettings(value: unknown): P0Settings {
  const bad = () => { throw new Error('Invalid PoC layout settings'); };
  if (!record(value) || !keys(value,['version','dashboard','dock']) || value.version !== 1) return bad();
  const d = value.dashboard, dock = value.dock;
  if (!record(d) || !keys(d,['version','widgets','appearance','presetId','gridProfile']) || d.version !== 1 || !Array.isArray(d.widgets) || d.widgets.length > 13) return bad();
  if (d.presetId !== undefined && !choice(d.presetId,['default','schedule','work','minimal','desk'])) return bad();
  if (d.gridProfile !== undefined && d.gridProfile !== 'dense-desk-v2') return bad();
  const a = d.appearance;
  if (!record(a) || !keys(a,['background','cardStyle','cornerStyle']) || !choice(a.background,['mint','white','warm-gray','blue-gray','lavender']) || !choice(a.cardStyle,['default','soft','flat']) || !choice(a.cornerStyle,['compact','soft'])) return bad();
  const ids = new Set(), types = new Set();
  for (const w of d.widgets) {
    if (!record(w) || !keys(w,['id','type','x','y','w','h','visible','settings']) || typeof w.id !== 'string' || !/^widget-[a-z0-9-]{1,80}$/.test(w.id) || !choice(w.type,widgets) || typeof w.visible !== 'boolean') return bad();
    if (!integer(w.x,0,11) || !integer(w.y,0,39) || !integer(w.w,1,12) || !integer(w.h,1,40) || w.x+w.w>12 || w.y+w.h>40) return bad();
    if (w.settings !== undefined && (!record(w.settings) || Object.keys(w.settings).length)) return bad();
    if (ids.has(w.id) || types.has(w.type)) return bad(); ids.add(w.id); types.add(w.type);
  }
  if (!record(dock) || !keys(dock,['version','items']) || dock.version !== 2 || !Array.isArray(dock.items) || dock.items.length > 11) return bad();
  const seen = new Set();
  for (const item of dock.items) {
    if (!record(item) || !keys(item,['id','visible']) || !choice(item.id,dockIds) || typeof item.visible !== 'boolean' || seen.has(item.id)) return bad();
    seen.add(item.id);
  }
  if (Buffer.byteLength(JSON.stringify(value)) > 65536) return bad();
  return JSON.parse(JSON.stringify(value)) as P0Settings;
}
// Windows may temporarily deny replacement (observed EPERM in isolated GUI QA).
// Retry the same already-synced temp file only; never delete the valid target.
export async function replaceSettingsFile(temp:string,target:string,platform=process.platform):Promise<void>{
  for(let attempt=0;;attempt++){
    try{await rename(temp,target);return;}
    catch(error){
      const code=(error as NodeJS.ErrnoException).code;
      if(platform!=='win32'||code!=='EPERM'||attempt>=3)throw error;
      await new Promise(resolve=>setTimeout(resolve,20*2**attempt));
    }
  }
}
export class SettingsStore<T = P0Settings> {
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly root: string, private readonly filename = 'layout.json', private readonly validate: (value: unknown) => T = validateSettings as (value: unknown) => T, private readonly maxBytes = 65536) {}
  async read(): Promise<T | null> {
    try {
      const data = await readFile(join(this.root,this.filename));
      if (data.length > this.maxBytes) throw new Error('Oversized settings');
      return this.validate(JSON.parse(data.toString('utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new Error('PoC settings could not be read; original file preserved');
    }
  }
  write(value: unknown): Promise<void> {
    const safe = this.validate(value);
    const operation = this.queue.then(async () => {
      await mkdir(this.root,{recursive:true,mode:0o700});
      const temp = join(this.root,`layout-${randomUUID()}.tmp`);
      try {
        const file = await open(temp,'wx',0o600);
        try { await file.writeFile(JSON.stringify(safe)); await file.sync(); } finally { await file.close(); }
        await replaceSettingsFile(temp,join(this.root,this.filename));
      } catch { await unlink(temp).catch(()=>{}); throw new Error('PoC settings were not saved'); }
    });
    this.queue = operation.catch(()=>{});
    return operation;
  }
  flush(): Promise<void> { return this.queue; }
}
