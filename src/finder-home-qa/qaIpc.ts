import { invoke as nativeInvoke, isTauri } from '../../node_modules/@tauri-apps/api/core.js';
import type { InvokeArgs, InvokeOptions } from '../../node_modules/@tauri-apps/api/core.js';
import { FinderQaBlockedError } from './inertConnections';

export { isTauri };
export const finderQaCommands = [
  'finder_home_qa_metadata', 'education_video_library_load', 'education_video_library_save',
  'education_video_library_import', 'education_video_library_export', 'education_video_library_recover',
  'education_video_library_metadata_delete', 'education_video_library_metadata_refresh',
] as const;
export function allowsFinderQaCommand(command: string): boolean {
  return finderQaCommands.some(allowed => allowed === command);
}
export async function invoke<T>(command: string, args?: InvokeArgs, options?: InvokeOptions): Promise<T> {
  if (!allowsFinderQaCommand(command)) throw new FinderQaBlockedError();
  return nativeInvoke<T>(command, args, options);
}
