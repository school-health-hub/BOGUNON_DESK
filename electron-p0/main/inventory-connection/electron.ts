/** Main-only entry: no Preview/UI import. Compiles to native ESM with .js specifiers. */
export { createElectronLocalQaConnection as createElectronInventoryConnection } from './localQa.js';
export type { InventoryLocalConnection } from './contracts.js';
export type { ElectronLocalQaOptions, InventoryElectronHostCapability, InventoryElectronTransport, InventoryTransportRequest, InventoryTransportResponse } from './transport.js';
