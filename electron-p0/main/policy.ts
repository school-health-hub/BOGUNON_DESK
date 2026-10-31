import { fileURLToPath } from 'node:url';
import { isAbsolute, relative, sep } from 'node:path';
export const CHANNELS = ['p0:info','p0:read-settings','p0:write-settings'] as const;
export function resourceAllowed(url: string, root: string, devOrigin?: string): boolean {
  try {
    const parsed = new URL(url);
    if (devOrigin && ['http:','ws:'].includes(parsed.protocol)) return parsed.origin.replace(/^ws:/,'http:') === devOrigin;
    if (parsed.protocol !== 'file:' || parsed.host) return false;
    const path = relative(root,fileURLToPath(parsed));
    return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
  } catch { return false; }
}
export function assertSender(event: { sender: unknown; senderFrame: unknown }, contents: { mainFrame: unknown; getURL(): string }, url: string): void {
  if (event.sender !== contents || event.senderFrame !== contents.mainFrame || contents.getURL() !== url) throw new Error('PoC IPC caller denied');
}
