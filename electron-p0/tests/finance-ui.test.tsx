// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {FinanceHost} from '../renderer/finance/FinanceHost';
import type {FinanceSnapshot,IncomeRecord} from '../finance-protocol';
import * as repository from '../renderer/finance/repository';
vi.mock('../../src/my-finance/repository',async()=>import('../renderer/finance/repository'));
const id='00000000-0000-4000-8000-000000000001';
const snapshot:FinanceSnapshot={identity:{schemaVersion:2,datasetId:id,revision:1,history:[id]},income:[]};
const ok=<T,>(data:T)=>({ok:true as const,data});
function setup(available=true){
 let current=snapshot;
 const finance={status:vi.fn(async()=>ok({available,reason:'Windows SQLCipher·DPAPI 필요'})),load:vi.fn(async()=>ok(current)),createIncome:vi.fn(async(input:{entry:IncomeRecord})=>{current={...snapshot,identity:{...snapshot.identity,revision:2,history:[id,crypto.randomUUID()]},income:[input.entry]};return ok(current);}),updateIncome:vi.fn(async()=>ok(current)),deleteIncome:vi.fn(async()=>ok(current)),replacePhase2:vi.fn(async()=>ok(current)),exportBackup:vi.fn(async()=>ok(false)),selectBackup:vi.fn(async()=>ok(null)),inspectBackup:vi.fn(async()=>ok(null)),restoreBackup:vi.fn(async()=>ok(current)),cancelBackup:vi.fn(async()=>ok(null)),close:vi.fn(async()=>ok(null))};const forbidden=vi.fn(()=>{throw Error('Not a finance endpoint');});vi.stubGlobal('electronWork',{finance,ai:{generate:forbidden},inventory:{save:forbidden}});return {finance,forbidden};
}
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('shows an explicit unavailable boundary and never opens a fake/plaintext store',async()=>{
 const {finance}=setup(false);render(<FinanceHost onClose={()=>{}}/>);await screen.findByRole('alert');expect(finance.load).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'수입 등록'})).toBeNull();
});
it('reuses income form/confirmation with the Electron adapter, preserving state across view reopen',async()=>{
 const {finance,forbidden}=setup(),storage=vi.spyOn(Storage.prototype,'setItem');const view=render(<FinanceHost onClose={()=>{}}/>);await screen.findByText('아직 등록된 수입이 없습니다');fireEvent.click(screen.getByRole('button',{name:'수입 등록'}));fireEvent.change(screen.getByLabelText('지급처'),{target:{value:'합성 Electron 지급처'}});fireEvent.change(screen.getByLabelText(/^총수입 \(원\)/),{target:{value:'200000'}});fireEvent.click(screen.getByRole('button',{name:'등록 내용 확인'}));expect(finance.createIncome).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'로컬 저장'}));await screen.findByText('수입을 등록했습니다.');expect(finance.createIncome.mock.calls[0][0]).toMatchObject({expected:snapshot.identity,entry:{sourceName:'합성 Electron 지급처',grossKrw:200000,netKrw:200000}});
 view.unmount();await waitFor(()=>expect(finance.close).toHaveBeenCalledTimes(1));render(<FinanceHost onClose={()=>{}}/>);await screen.findByRole('heading',{name:'합성 Electron 지급처'});expect(finance.load).toHaveBeenCalledTimes(2);expect(forbidden).not.toHaveBeenCalled();expect(storage).not.toHaveBeenCalled();
});
it('keeps the existing editor input and blocks further writes after adapter save failure',async()=>{
 const {finance}=setup();finance.createIncome.mockRejectedValueOnce(Error('synthetic storage failure'));render(<FinanceHost onClose={()=>{}}/>);await screen.findByText('아직 등록된 수입이 없습니다');fireEvent.click(screen.getByRole('button',{name:'수입 등록'}));fireEvent.change(screen.getByLabelText('지급처'),{target:{value:'합성 미저장'}});fireEvent.change(screen.getByLabelText(/^총수입 \(원\)/),{target:{value:'100'}});fireEvent.click(screen.getByRole('button',{name:'등록 내용 확인'}));fireEvent.click(screen.getByRole('button',{name:'로컬 저장'}));await screen.findByRole('alert');expect((screen.getByLabelText('지급처') as HTMLInputElement).value).toBe('합성 미저장');expect((screen.getByRole('button',{name:'등록 내용 확인'}) as HTMLButtonElement).disabled).toBe(true);
});
it('preserves backup password/token/identity interfaces without browser persistence or fallback',async()=>{
 const {finance}=setup(),password='synthetic-password-123';await repository.exportFinanceBackup(snapshot.identity,password);expect(finance.exportBackup).toHaveBeenCalledWith({expected:snapshot.identity,password});expect(await repository.selectFinanceBackup()).toBeNull();await repository.cancelFinanceBackup(id);expect(finance.cancelBackup).toHaveBeenCalledWith({token:id});
 vi.stubGlobal('electronWork',{});expect(()=>repository.listFinanceIncome()).toThrow('연결');
});
