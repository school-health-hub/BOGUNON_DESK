// QA-only module replacement. Never presents an IPC mock as native verification.
const denied = async (): Promise<never> => { throw new Error('Native file/IPC operation excluded from browser QA'); };
export const purchaseRepository = {
  pickAndAnalyze: denied, analyzePaths: denied, applyMapping: denied,
  export: denied, exportEdufine: denied, exportSettlement: denied,
};
export const purchasePreviewRepository = { general: denied, settlement: denied };
