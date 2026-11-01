import { purchaseImportFieldIds, type PurchaseAnalysisResult, type PurchaseColumnMapping, type PurchaseMappingCandidate } from '../../src/purchase/types';
import type { MappingFixtures } from './mapping-fixtures';
type Pending = { readonly id: number; readonly candidateId: string; readonly headerRow: number; readonly mapping: PurchaseColumnMapping; readonly result: PurchaseAnalysisResult; readonly resolve: (result: PurchaseAnalysisResult) => void; readonly reject: (error: Error) => void };
let fixtures: MappingFixtures | null = null;
let sequence = 0;
const pending = new Map<number, Pending>();
export const configureMappingTransport = (value: MappingFixtures): void => { fixtures = value; };
export const mappingTransportState = () => Array.from(pending.values(), request => ({ id: request.id, candidateId: request.candidateId, headerRow: request.headerRow, mapping: request.mapping }));
export function settleMappingTransport(id: number, failure = false): void {
  const request = pending.get(id);
  if (request === undefined) throw new Error('Missing deferred mapping request');
  pending.delete(id);
  if (failure) request.reject(new Error('Synthetic deferred mapping transport error'));
  else request.resolve(request.result);
}
const denied = async (): Promise<never> => { throw new Error('Native operation excluded from browser mapping QA'); };
export const purchaseRepository = {
  pickAndAnalyze: denied, analyzePaths: denied, export: denied, exportEdufine: denied, exportSettlement: denied,
  applyMapping: (candidate: PurchaseMappingCandidate, headerRow: number, mapping: PurchaseColumnMapping): Promise<PurchaseAnalysisResult> => {
    const fixture = fixtures === null ? undefined : Object.values(fixtures).find(entry => entry.candidate.id === candidate.id);
    if (fixture === undefined) throw new Error('No actual Rust mapping result for candidate');
    const option = fixture.candidate.headerOptions[0];
    if (option === undefined || headerRow !== option.rowIndex || purchaseImportFieldIds.some(field => mapping[field] !== fixture.mapping[field]) || Object.keys(mapping).length !== Object.keys(fixture.mapping).length) throw new Error('Transport may return only the exact actual Rust mapping contract');
    return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { id, candidateId: candidate.id, headerRow, mapping, result: fixture.result, resolve, reject }); });
  },
};
