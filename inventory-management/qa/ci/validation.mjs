import assert from 'node:assert/strict';
/** Historical manifest expectations; these do not declare the current run PASS. */
export function validateManifest(manifest) {
  const implemented=['INV-D01','INV-D02','INV-D03','INV-D04','INV-D05','INV-D06','INV-D07','INV-D08','INV-D09','INV-C01','INV-C02','INV-C03','INV-C04','INV-C05','INV-C06','INV-S01','INV-S02','INV-S03','INV-S04','INV-S05','INV-S06','INV-S07','INV-S08','INV-P01','INV-P02','INV-P03','INV-P04'];
  assert.equal(manifest.contracts.length,34);assert.equal(new Set(manifest.contracts.map(c=>c.id)).size,34);
  for(const c of manifest.contracts)assert.equal(c.status,implemented.includes(c.id)?'PASS':'PENDING_IMPLEMENTATION');
}
export function minimumResources(disk,memory) {
  assert(Number.isFinite(disk) && disk>=14*2**30,'Runner needs 14 GiB disk available');
  assert(Number.isFinite(memory) && memory>=3*2**30,'Runner needs 3 GiB RAM available');
}
export function parseSummaries(output,counts) {
  const summaries=output.split(/\r?\n/).filter(l=>l.startsWith('SUMMARY|'));
  assert.equal(summaries.length,counts.length);
  counts.forEach((n,i)=>assert.equal(summaries[i],`SUMMARY|${n}|${n}|0`));
}
