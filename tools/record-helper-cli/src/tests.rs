use std::{fs,path::PathBuf};
use super::fixtures::{write_pdf,write_docx,write_hwpx,write_hwp,TEST_HWP_PROPERTY_COMPRESSED,TEST_HWP_PROPERTY_PRIVACY_SECURITY};
#[test]
fn writes_only_synthetic_electron_integration_fixtures(){
 let root=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../build/record-helper-fixtures");fs::create_dir_all(&root).unwrap();
 let files=[("synthetic.pdf",write_pdf("electron-synthetic",&["Synthetic student activity report text"])),("synthetic.docx",write_docx("electron-synthetic","합성 학생이 실험 과정을 설명함")),("synthetic.hwpx",write_hwpx("electron-synthetic","합성 학생이 토론에 참여함")),("synthetic.hwp",write_hwp("electron-synthetic","합성 활동 결과를 정리함",0,0x0500_0000)),("compressed.hwp",write_hwp("electron-compressed","합성 압축 활동보고서",TEST_HWP_PROPERTY_COMPRESSED,0x0500_0000)),("protected.hwp",write_hwp("electron-protected","합성 비공개",TEST_HWP_PROPERTY_PRIVACY_SECURITY,0x0500_0000))];
 for (name,path) in files{fs::copy(&path,root.join(name)).unwrap();fs::remove_file(path).unwrap();}
}

#[test]
fn rejects_a_real_password_encrypted_pdf(){
 use pdf_extract::{Document,Object,EncryptionState,EncryptionVersion,Permissions};
 let plain=write_pdf("encryption-synthetic",&["Synthetic protected activity report"]);
 let mut doc=Document::load(&plain).unwrap();
 doc.trailer.set("ID",Object::Array(vec![Object::string_literal("synthetic-record-id"),Object::string_literal("synthetic-record-id")]));
 let state=EncryptionState::try_from(EncryptionVersion::V2{document:&doc,owner_password:"synthetic-owner",user_password:"synthetic-user",key_length:128,permissions:Permissions::all()}).unwrap();
 doc.encrypt(&state).unwrap();
 let protected=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../build/record-helper-fixtures/encrypted.pdf");fs::create_dir_all(protected.parent().unwrap()).unwrap();doc.save(&protected).unwrap();
 let batch=super::super::extract_reports(vec![protected]);assert!(batch.reports.is_empty());assert_eq!(batch.failures.len(),1);fs::remove_file(plain).unwrap();
}
