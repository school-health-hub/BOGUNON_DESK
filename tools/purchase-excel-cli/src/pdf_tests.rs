use super::*;
use pdf_extract::{EncryptionState,EncryptionVersion,Permissions};
fn fixtures()->PathBuf{let dir=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/qa-fixtures");fs::create_dir_all(&dir).unwrap();dir}
fn korean_pdf(path:&Path){
    let lines=["품명\t수량\t단가\t금액","합성 품목\t2\t1500\t3000","합계\t\t\t3000"];
    korean_pdf_lines(path,&lines);
}
fn korean_pdf_lines(path:&Path,lines:&[&str]){
    let chars:std::collections::BTreeSet<u16>=lines.iter().flat_map(|line|line.encode_utf16()).collect();
    let cmap=format!("/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /SyntheticUCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange {} beginbfchar {} endbfchar endcmap CMapName currentdict /CMap defineresource pop end end",chars.len(),chars.iter().map(|c|format!("<{c:04X}> <{c:04X}>")).collect::<Vec<_>>().join("\n"));
    let mut doc=Document::with_version("1.7");let unicode=doc.add_object(Stream::new(dictionary!{},cmap.into_bytes()));
    let descendant=doc.add_object(dictionary!{"Type"=>"Font","Subtype"=>"CIDFontType2","BaseFont"=>"SyntheticKorean","CIDSystemInfo"=>dictionary!{"Registry"=>Object::string_literal("Adobe"),"Ordering"=>Object::string_literal("Identity"),"Supplement"=>0},"FontDescriptor"=>dictionary!{"Type"=>"FontDescriptor","FontName"=>"SyntheticKorean","Flags"=>4,"FontBBox"=>vec![0.into(),0.into(),1000.into(),1000.into()],"ItalicAngle"=>0,"Ascent"=>1000,"Descent"=>0,"CapHeight"=>1000,"StemV"=>80},"DW"=>1000,"CIDToGIDMap"=>"Identity"});
    let font=doc.add_object(dictionary!{"Type"=>"Font","Subtype"=>"Type0","BaseFont"=>"SyntheticKorean","Encoding"=>"Identity-H","DescendantFonts"=>vec![Object::Reference(descendant)],"ToUnicode"=>Object::Reference(unicode)});
    let operations=lines.iter().map(|line|format!("<{}> Tj 0 -20 Td",line.encode_utf16().map(|c|format!("{c:04X}")).collect::<String>())).collect::<Vec<_>>().join("\n");
    let content=doc.add_object(Stream::new(dictionary!{},format!("BT /F1 10 Tf 20 700 Td {operations} ET").into_bytes()));
    let pages=doc.new_object_id();let page=doc.add_object(dictionary!{"Type"=>"Page","Parent"=>Object::Reference(pages),"Contents"=>Object::Reference(content),"Resources"=>dictionary!{"Font"=>dictionary!{"F1"=>Object::Reference(font)}}});
    doc.objects.insert(pages,Object::Dictionary(dictionary!{"Type"=>"Pages","Kids"=>vec![Object::Reference(page)],"Count"=>1,"MediaBox"=>vec![0.into(),0.into(),612.into(),792.into()]}));
    let catalog=doc.add_object(dictionary!{"Type"=>"Catalog","Pages"=>Object::Reference(pages)});doc.trailer.set("Root",catalog);doc.save(path).unwrap();
}
#[test]
fn generates_pdf_cli_fixtures_and_preserves_failure_contracts(){
    let dir=fixtures();
    let input=write_synthetic_pdf("cli-text",&["Name\tQty\tUnitPrice\tAmount\nSynthetic\t2\t100\t200\nTotal\t\t\t200"]);let path=dir.join("synthetic.pdf");fs::copy(&input,&path).unwrap();let _=fs::remove_file(input);
    let result=analyze_paths(vec![path.clone()],vec![]).unwrap();assert_eq!(result.items.len(),1);assert_eq!(result.items[0].unit_price,Some(100.0));fs::write(dir.join("expected-pdf.json"),serde_json::to_vec(&result).unwrap()).unwrap();
    let unknown=write_synthetic_pdf("cli-pdf-unknown",&["Product\tOrderCount\tSalePrice\nSynthetic\t3\t25"]);fs::copy(&unknown,dir.join("unknown.pdf")).unwrap();let _=fs::remove_file(unknown);
    let scanned=write_synthetic_pdf("cli-scanned",&[""]);let scanned_path=dir.join("scanned.pdf");fs::copy(&scanned,&scanned_path).unwrap();let _=fs::remove_file(scanned);
    // A real bitmap-only page, rather than using a blank page as the scan fixture.
    let mut scan=Document::load(&scanned_path).unwrap();let image=scan.add_object(Stream::new(dictionary!{"Type"=>"XObject","Subtype"=>"Image","Width"=>1,"Height"=>1,"ColorSpace"=>"DeviceRGB","BitsPerComponent"=>8},vec![255,255,255]));let contents=scan.add_object(Stream::new(dictionary!{},b"q 200 0 0 200 20 20 cm /Im0 Do Q".to_vec()));let page_id=*scan.get_pages().values().next().unwrap();let page=scan.get_object_mut(page_id).unwrap().as_dict_mut().unwrap();page.set("Resources",dictionary!{"XObject"=>dictionary!{"Im0"=>Object::Reference(image)}});page.set("Contents",Object::Reference(contents));scan.save(&scanned_path).unwrap();
    let r=analyze_paths(vec![scanned_path],vec![]).unwrap();assert_eq!(r.sources[0].status,"unsupported");assert!(r.sources[0].message.as_ref().unwrap().contains("OCR"));
    let mut encrypted=Document::load(&path).unwrap();encrypted.trailer.set("ID",vec![Object::string_literal("synthetic-pdf-id"),Object::string_literal("synthetic-pdf-id")]);
    let state=EncryptionState::try_from(EncryptionVersion::V1{document:&encrypted,owner_password:"synthetic-owner",user_password:"synthetic-only",permissions:Permissions::all()}).unwrap();encrypted.encrypt(&state).unwrap();let encrypted_path=dir.join("encrypted.pdf");encrypted.save(&encrypted_path).unwrap();let r=analyze_paths(vec![encrypted_path],vec![]).unwrap();assert_eq!(r.sources[0].status,"unsupported");assert!(r.sources[0].message.as_ref().unwrap().contains("암호화"));
    let damaged=dir.join("damaged.pdf");fs::write(&damaged,b"%PDF-1.7\ninvalid").unwrap();assert_eq!(analyze_paths(vec![damaged],vec![]).unwrap().sources[0].status,"error");
    let pages=vec!["";MAX_PDF_PAGES+1];let excess=write_synthetic_pdf("cli-too-many-pages",&pages);fs::copy(&excess,dir.join("oversized-pages.pdf")).unwrap();let _=fs::remove_file(excess);
    assert!(analyze_paths(vec![dir.join("oversized-pages.pdf")],vec![]).unwrap().sources[0].message.as_ref().unwrap().contains("50페이지"));
}
#[test]
fn extracts_korean_unicode_table_and_skips_total(){
    let path=fixtures().join("korean.pdf");korean_pdf(&path);let result=analyze_paths(vec![path],vec![]).unwrap();assert_eq!(result.items.len(),1);assert_eq!(result.items[0].name,"합성 품목");assert_eq!(result.items[0].quantity,Some(2.0));assert_eq!(result.items[0].unit_price,Some(1500.0));assert_eq!(result.items[0].imported_amount,Some(3000.0));
}

#[test]
fn win_qa_04_real_pdf_excludes_labeled_total(){
 let path=fixtures().join("win-qa04.pdf");
 korean_pdf_lines(&path,&["품목명\t규격\t수량\t단가","합성 거즈\t10cm\t2\t3000","합성 밴드\t표준형\t5\t1500","합성 소독솜\t100매\t1\t4000","합성 체온계\t디지털\t1\t6000","예상 합계: 23,500원"]);
 let result=analyze_paths(vec![path],vec![]).unwrap();assert_eq!(result.items.len(),4);
 assert_eq!(result.items.iter().map(|i|i.name.as_str()).collect::<Vec<_>>(),["합성 거즈","합성 밴드","합성 소독솜","합성 체온계"]);
 assert_eq!(result.items.iter().map(|i|i.quantity.unwrap()*i.unit_price.unwrap()).sum::<f64>(),23_500.0);
}
