import type { PurchaseAnalysisResult, PurchaseColumnMapping, PurchaseMappingCandidate } from '../../src/purchase/types';

export type MappingFixture = { readonly candidate: PurchaseMappingCandidate; readonly mapping: PurchaseColumnMapping; readonly result: PurchaseAnalysisResult };
export type MappingFixtures = Readonly<Record<'review' | 'manual' | 'automatic', MappingFixture>>;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const strings = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every(entry => typeof entry === 'string');
const mapping = (value: unknown): value is PurchaseColumnMapping => record(value) && Object.values(value).every(entry => Number.isInteger(entry) && Number(entry) >= 0);
function candidate(value: unknown): value is PurchaseMappingCandidate {
  return record(value) && typeof value['id'] === 'string' && typeof value['sourceName'] === 'string' && typeof value['sheetName'] === 'string'
    && Array.isArray(value['rows']) && value['rows'].every(strings)
    && Array.isArray(value['headerOptions']) && value['headerOptions'].length > 0 && value['headerOptions'].every(option => {
      if (!record(option) || !Number.isInteger(option['rowIndex']) || !strings(option['headers']) || !strings(option['signature']) || typeof option['recommended'] !== 'boolean') return false;
      const recommendation = option['recommendation'];
      return recommendation === undefined || (record(recommendation) && mapping(recommendation['mapping']) && ['automatic', 'review', 'manual'].includes(String(recommendation['confidence'])) && Array.isArray(recommendation['fields']) && strings(recommendation['warnings']));
    });
}
function analysis(value: unknown): value is PurchaseAnalysisResult {
  return record(value) && Array.isArray(value['items']) && value['items'].every(item => record(item) && typeof item['id'] === 'string' && typeof item['name'] === 'string' && typeof item['selected'] === 'boolean')
    && Array.isArray(value['sources']) && value['sources'].every(source => record(source) && typeof source['sourceName'] === 'string' && typeof source['status'] === 'string')
    && Array.isArray(value['candidates']) && value['candidates'].every(candidate);
}
function fixture(value: unknown): value is MappingFixture { return record(value) && candidate(value['candidate']) && mapping(value['mapping']) && analysis(value['result']); }
export async function loadMappingFixtures(): Promise<MappingFixtures> {
  const response = await fetch('/mapping-fixtures.json');
  if (!response.ok) throw new Error('Actual Rust fixture response missing');
  const value: unknown = await response.json();
  if (!record(value) || !fixture(value['review']) || !fixture(value['manual']) || !fixture(value['automatic'])) throw new Error('Actual Rust mapping fixture shape mismatch');
  return { review: value['review'], manual: value['manual'], automatic: value['automatic'] };
}
