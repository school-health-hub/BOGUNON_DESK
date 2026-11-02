import { createSyntheticInventoryAdapter } from '../ui/syntheticAdapter';
import { InventoryError } from './contracts';
import type { InventoryLocalConnection } from './contracts';
import type { LocalQaConfig } from './localQa';
export * from './contracts';
export type { InventoryElectronHostCapability, InventoryElectronTransport, InventoryTransportRequest, InventoryTransportResponse, ElectronLocalQaOptions } from './transport';
export type { LocalQaConfig } from './localQa';
/** Default Preview constructs no client and cannot access Local QA data. */
export async function createInventoryConnection(mode: 'preview' | 'local-qa' | 'production' = 'preview', config?: LocalQaConfig): Promise<
  { mode:'preview'; persisted:false; adapter:ReturnType<typeof createSyntheticInventoryAdapter> } | InventoryLocalConnection
> {
  if(config && 'transport' in config)throw new InventoryError('ENVIRONMENT_BLOCKED');
  if(mode==='preview') return {mode:'preview',persisted:false,adapter:createSyntheticInventoryAdapter()};
  if(import.meta.env.DEV && !import.meta.env.PROD && mode==='local-qa' && config) {
    const {createLocalQaConnection}=await import('./localQa');
    return createLocalQaConnection(config);
  }
  throw new InventoryError('ENVIRONMENT_BLOCKED');
}

/** Explicit capability opt-in. Production never imports the Electron Local QA implementation. */
export async function createElectronInventoryConnection(options:import('./transport').ElectronLocalQaOptions):Promise<InventoryLocalConnection> {
  if(!import.meta.env?.PROD && !('window' in globalThis) && !('document' in globalThis) && !('location' in globalThis)) {
    const {createElectronLocalQaConnection}=await import('./localQa');
    return createElectronLocalQaConnection(options);
  }
  throw new InventoryError('ENVIRONMENT_BLOCKED');
}
