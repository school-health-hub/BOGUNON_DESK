use std::{env,fs,path::PathBuf};
fn main(){
 let repo=PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("../..");
 let source=repo.join("src-tauri/src/record_helper_import");
 let out=PathBuf::from(env::var("OUT_DIR").unwrap()).join("engine");fs::create_dir_all(out.join("tests")).unwrap();
 for name in ["hwp.rs","hwp_text.rs","pdf.rs","util.rs","zip_text.rs"]{let p=source.join(name);println!("cargo:rerun-if-changed={}",p.display());fs::copy(p,out.join(name)).unwrap();}
 let p=source.join("mod.rs");println!("cargo:rerun-if-changed={}",p.display());let s=fs::read_to_string(p).unwrap();
 let s=s.split("async fn run_extraction_worker").next().expect("Original extraction boundary missing").replace("use tauri::AppHandle;\n","").replace("use tauri_plugin_dialog::DialogExt;\n","").replace("fn extract_reports(paths:","pub fn extract_reports(paths:");
 fs::write(out.join("mod.rs"),format!("{s}\n#[cfg(test)] mod tests;\n")).unwrap();
 for name in ["fixtures.rs","hwp_controls.rs","boundaries.rs","smoke.rs"]{
  let p=source.join("tests").join(name);println!("cargo:rerun-if-changed={}",p.display());let mut s=fs::read_to_string(p).unwrap();
  if name=="smoke.rs"{s=s.split("#[test]\nfn preserves_cancelled_picker").next().unwrap().to_owned();}
  if name=="boundaries.rs"{if let Some(i)=s.find("tauri::"){let end=s[..i].rfind("#[test]").unwrap();s.truncate(end);}}
  fs::write(out.join("tests").join(name),s).unwrap();
 }
 let extra=repo.join("tools/record-helper-cli/src/tests.rs");println!("cargo:rerun-if-changed={}",extra.display());fs::copy(extra,out.join("tests/additions.rs")).unwrap();
 fs::write(out.join("tests.rs"),"mod fixtures; mod smoke; mod boundaries; mod hwp_controls; mod additions;\n").unwrap();
 println!("cargo:rerun-if-changed={}",repo.join("tools/official-document-cli/src/limits.rs").display());
}
