use std::{io::{BufRead,BufReader,Read,Write},path::PathBuf};
use my_finance_cli::Worker;
use serde::Deserialize;
use serde_json::json;
use zeroize::Zeroizing;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope{version:u8,id:u64,request:serde_json::Value}
fn main(){
 std::panic::set_hook(Box::new(|_|{}));
 if !cfg!(windows){return;}
 #[cfg(windows)]if install_limits().is_err(){return;}
 let args:Vec<_>=std::env::args_os().collect();if args.len()!=3||args[1]!="--root"{return;}
 let root=PathBuf::from(&args[2]);if !root.is_absolute(){return;}
 let mut input=BufReader::new(std::io::stdin().lock());let mut output=std::io::stdout().lock();let mut worker=Worker::default();
 if writeln!(output,"{}",json!({"version":1,"ready":"sqlcipher-dpapi"})).is_err()||output.flush().is_err(){return;}
 loop{
  let mut bytes=Zeroizing::new(Vec::new());
  let read=(&mut input).take(70*1024*1024+1).read_until(b'\n',&mut bytes);
  if !matches!(read,Ok(n) if n>0)||bytes.len()>70*1024*1024||bytes.last()!=Some(&b'\n'){break;}
  let envelope=match serde_json::from_slice::<Envelope>(&bytes){Ok(v) if v.version==1=>v,_=>break};
  let result=worker.execute_json(&root,envelope.request);
  let value=match result{Ok(data)=>json!({"version":1,"id":envelope.id,"ok":true,"data":data}),Err(error)=>json!({"version":1,"id":envelope.id,"ok":false,"error":error})};
  let mut response=match serde_json::to_vec(&value){Ok(v)=>Zeroizing::new(v),Err(_)=>break};if response.len()>70*1024*1024{break;}response.push(b'\n');
  if output.write_all(&response).is_err()||output.flush().is_err(){break;}
 }
}
#[cfg(windows)]
fn install_limits()->Result<(),()>{
 use windows_sys::Win32::{Foundation::CloseHandle,System::{JobObjects::*,Threading::GetCurrentProcess}};
 unsafe{let job=CreateJobObjectW(std::ptr::null(),std::ptr::null());if job.is_null(){return Err(());}
 let mut limits:JOBOBJECT_EXTENDED_LIMIT_INFORMATION=std::mem::zeroed();
 limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE|JOB_OBJECT_LIMIT_ACTIVE_PROCESS|JOB_OBJECT_LIMIT_PROCESS_MEMORY;
 limits.BasicLimitInformation.ActiveProcessLimit=1;limits.ProcessMemoryLimit=512*1024*1024;
 if SetInformationJobObject(job,JobObjectExtendedLimitInformation,&limits as *const _ as *const _,std::mem::size_of_val(&limits) as u32)==0||AssignProcessToJobObject(job,GetCurrentProcess())==0{CloseHandle(job);return Err(());}
 let mut actual:JOBOBJECT_EXTENDED_LIMIT_INFORMATION=std::mem::zeroed();
 if QueryInformationJobObject(job,JobObjectExtendedLimitInformation,&mut actual as *mut _ as *mut _,std::mem::size_of_val(&actual) as u32,std::ptr::null_mut())==0||actual.ProcessMemoryLimit!=limits.ProcessMemoryLimit||actual.BasicLimitInformation.LimitFlags&limits.BasicLimitInformation.LimitFlags!=limits.BasicLimitInformation.LimitFlags||actual.BasicLimitInformation.ActiveProcessLimit!=1{CloseHandle(job);return Err(());}
 // Retain kill-on-close handle until OS teardown. Request deadlines are per-operation in Main.
 Ok(())}
}
