export const FINDER_QA_IDENTIFIER = 'kr.sungandi.schoolhealthdesk.finderhomeqa';
export type FinderQaMetadata = {
  readonly identifier: string; readonly sourceSha: string; readonly localData: string; readonly webviewData: string;
  readonly networkEnabled: false; readonly authEnabled: false; readonly externalConnections: false; readonly syntheticOnly: true;
};
export function parseFinderQaMetadata(value: unknown, sourceSha: string): FinderQaMetadata | null {
  if (typeof value !== 'object' || value === null || !('identifier' in value) || value.identifier !== FINDER_QA_IDENTIFIER
    || !('sourceSha' in value) || value.sourceSha !== sourceSha || !/^[a-f0-9]{40}$/.test(sourceSha)
    || !('localData' in value) || typeof value.localData !== 'string'
    || !('webviewData' in value) || typeof value.webviewData !== 'string'
    || !('networkEnabled' in value) || value.networkEnabled !== false
    || !('authEnabled' in value) || value.authEnabled !== false
    || !('externalConnections' in value) || value.externalConnections !== false
    || !('syntheticOnly' in value) || value.syntheticOnly !== true) return null;
  const local = value.localData.replace(/\\/g, '/');
  const webview = value.webviewData.replace(/\\/g, '/');
  const suffix = `/data/${FINDER_QA_IDENTIFIER}/education-video`;
  const root = local.slice(0, -suffix.length);
  if (!/^[DE]:\/BOGUNON_DEV\/qa-output\/finder-home-qa-[a-z0-9][a-z0-9-]{0,79}$/i.test(root)
    || !local.endsWith(suffix) || webview !== `${root}/webview`) return null;
  return { identifier: value.identifier, sourceSha: value.sourceSha, localData: value.localData, webviewData: value.webviewData,
    networkEnabled: false, authEnabled: false, externalConnections: false, syntheticOnly: true };
}
