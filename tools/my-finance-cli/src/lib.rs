#![allow(dead_code)]
mod my_finance_snapshot;
mod my_finance_backup;
mod my_finance_codec;
mod my_finance_store;
mod my_finance_transfer;
mod platform;
use my_finance_snapshot::{IncomeEntry,Phase2Data,SnapshotIdentity};
use my_finance_store::IncomeMutation;
use serde::Deserialize;
use serde_json::{json,Value};
use std::path::Path;
use uuid::Uuid;
use zeroize::Zeroizing;
#[derive(Deserialize)]
#[serde(tag="operation",rename_all="camelCase",rename_all_fields="camelCase",deny_unknown_fields)]
pub(crate) enum Request{
 Load{},
 CreateIncome{expected:SnapshotIdentity,entry:IncomeEntry},
 UpdateIncome{expected:SnapshotIdentity,entry:IncomeEntry},
 DeleteIncome{expected:SnapshotIdentity,id:Uuid},
 ReplacePhase2{expected:SnapshotIdentity,phase2:Phase2Data},
 ExportBackup{expected:SnapshotIdentity,password:String,path:String},
 SelectBackup{path:String},
 InspectBackup{token:Uuid,password:String},
 RestoreBackup{token:Uuid,confirm_dataset_change:bool},
 CancelBackup{token:Uuid},
}
#[derive(Default)]
pub struct Worker{transfer:my_finance_transfer::TransferSession}
impl Worker{
 pub fn execute_json(&mut self,root:&Path,request:Value)->Result<Value,&'static str>{let request=serde_json::from_value(request).map_err(|_|"금융 요청을 확인하지 못했습니다.")?;self.execute(root,request)}
 pub(crate) fn execute(&mut self,root:&Path,mut request:Request)->Result<Value,&'static str>{
  let password=match &mut request{Request::ExportBackup{password,..}|Request::InspectBackup{password,..}=>Zeroizing::new(std::mem::take(password)),_=>Zeroizing::new(String::new())};
  if !cfg!(windows){return Err("암호화 금융 저장소는 Windows에서만 사용할 수 있습니다.");}
  // Main supplies only its own isolated absolute root and picker-approved backup paths.
  if !root.is_absolute(){return Err("금융 저장소 위치를 확인하지 못했습니다.");}
  if let Request::CancelBackup{token}=request {self.transfer.cancel_ticket(token);return Ok(Value::Null);}
  if !matches!(request,Request::Load{})&&!root.join("finance.db").try_exists().map_err(|_|"금융 저장소를 확인하지 못했습니다.")?{return Err("금융 저장소가 없습니다. 목록을 다시 불러와 주세요.");}
  let mut store=platform::open_at(root)?;
  match request{
   Request::Load{}=>snapshot(store.load()?),
   Request::CreateIncome{expected,entry}=>snapshot(store.apply(&expected,IncomeMutation::Create(entry))?),
   Request::UpdateIncome{expected,entry}=>snapshot(store.apply(&expected,IncomeMutation::Update(entry))?),
   Request::DeleteIncome{expected,id}=>snapshot(store.apply(&expected,IncomeMutation::Delete(id))?),
   Request::ReplacePhase2{expected,phase2}=>snapshot(store.replace_phase2(&expected,phase2)?),
   Request::ExportBackup{expected,password:_,path}=>{
    let current=store.load()?;
    if current.identity!=expected{return Err("금융 데이터가 변경되었습니다. 최신 목록을 다시 불러와 주세요.");}
    let encrypted=my_finance_codec::export_snapshot(&current,&password)?;
    my_finance_transfer::write_backup(Path::new(&path),&encrypted)?;Ok(json!(true))
   },
   Request::SelectBackup{path}=>{self.transfer.cancel();let bytes=my_finance_transfer::read_backup(Path::new(&path))?;Ok(json!(self.transfer.select(bytes)?))},
   Request::InspectBackup{token,password:_}=>{serde_json::to_value(self.transfer.inspect(token,&password,&store.load()?)?).map_err(|_|"백업 검사 결과를 확인하지 못했습니다.")},
   Request::RestoreBackup{token,confirm_dataset_change}=>snapshot(self.transfer.commit_confirmed(token,&mut store,confirm_dataset_change)?),
   Request::CancelBackup{..}=>unreachable!(),
  }
 }
}
fn snapshot(value:my_finance_snapshot::FinanceSnapshot)->Result<Value,&'static str>{serde_json::to_value(value).map_err(|_|"금융 데이터를 읽지 못했습니다.")}
pub fn operation_valid(value:&[u8])->bool{serde_json::from_slice::<Request>(value).is_ok()}
#[cfg(test)]
mod bridge_tests{
 use super::*;
 #[test]fn malformed_unknown_and_path_commands_are_rejected(){for bytes in [br#"{"operation":"load","path":"other"}"#.as_slice(),br#"{"operation":"query","sql":"select *"}"#,br#"{"operation":"load","key":"plaintext"}"#]{assert!(!operation_valid(bytes));}}
 #[cfg(not(windows))]
 #[test]fn non_windows_never_opens_or_creates_finance_files(){let dir=tempfile::tempdir().unwrap();assert!(Worker::default().execute(dir.path(),Request::Load{}).is_err());assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(),0);}
}
