// Same public functions as src/my-finance/repository.ts. No browser cache or Tauri invocation.
import type {IncomeRecord,Phase2Data} from '../../../src/my-finance/domain';
import type {FinanceSnapshot,FinanceIdentity,RestorePreview} from '../../../src/my-finance/repository';
import type {IpcResult} from '../../protocol';
export type {FinanceSnapshot,FinanceIdentity,RestorePreview};
function bridge(){const api=window.electronWork?.finance;if(!api)throw Error('Electron 암호화 금융 연결이 없습니다.');return api;}
async function read<T>(call:Promise<IpcResult<T>>):Promise<T>{const result=await call;if(!result.ok)throw Error(result.error.message);return result.data;}
export const loadFinanceSnapshot=():Promise<FinanceSnapshot>=>read(bridge().load());
export const listFinanceIncome=loadFinanceSnapshot;
export const createFinanceIncome=(expected:FinanceIdentity,entry:IncomeRecord):Promise<FinanceSnapshot>=>read(bridge().createIncome({expected,entry}));
export const updateFinanceIncome=(expected:FinanceIdentity,entry:IncomeRecord):Promise<FinanceSnapshot>=>read(bridge().updateIncome({expected,entry}));
export const deleteFinanceIncome=(expected:FinanceIdentity,id:string):Promise<FinanceSnapshot>=>read(bridge().deleteIncome({expected,id}));
export const replaceFinancePhase2=(expected:FinanceIdentity,phase2:Phase2Data):Promise<FinanceSnapshot>=>read(bridge().replacePhase2({expected,phase2}));
export const exportFinanceBackup=(expected:FinanceIdentity,password:string):Promise<boolean>=>read(bridge().exportBackup({expected,password}));
export const selectFinanceBackup=():Promise<string|null>=>read(bridge().selectBackup());
export const inspectFinanceBackup=(token:string,password:string):Promise<RestorePreview>=>read(bridge().inspectBackup({token,password}));
export const restoreFinanceBackup=(token:string,confirmDatasetChange=false):Promise<FinanceSnapshot>=>read(bridge().restoreBackup({token,confirmDatasetChange}));
export async function cancelFinanceBackup(token:string):Promise<void>{await read(bridge().cancelBackup({token}));}
