import { createSyntheticInventoryAdapter } from '../ui/syntheticAdapter';
import { InventoryError } from './contracts';
import type { InventoryLocalConnection } from './contracts';
import type { LocalQaConfig } from './localQa';
export * from './contracts';
export type { LocalQaConfig } from './localQa';
/** Default Preview constructs no client and cannot access Local QA data. */
export async function createInventoryConnection(mode: 'preview' | 'local-qa' | 'production' = 'preview', config?: LocalQaConfig): Promise<
  { mode:'preview'; persisted:false; adapter:ReturnType<typeof createSyntheticInventoryAdapter> } | InventoryLocalConnection
> {
  if(mode==='preview') return {mode:'preview',persisted:false,adapter:createSyntheticInventoryAdapter()};
  if(import.meta.env.DEV && !import.meta.env.PROD && mode==='local-qa' && config) {
    const {createLocalQaConnection}=await import('./localQa');
    return createLocalQaConnection(config);
  }
  throw new InventoryError('ENVIRONMENT_BLOCKED');
}
