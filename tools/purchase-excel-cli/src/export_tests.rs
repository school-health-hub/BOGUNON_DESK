use super::*;
fn fixture()->PurchaseItem{serde_json::from_value(serde_json::json!({"id":"synthetic-export","selected":true,"name":"합성 품목","specification":"","quantity":2.5,"unitPrice":100.6,"importedAmount":null,"vendor":"합성 구매처","note":"줄1\n줄2","budgetItem":"","sourceName":null,"issues":[],"amountMismatchReviewed":false})).unwrap()}
#[test]
fn csv_and_xlsx_keep_original_cells_formats_and_column_order(){
 let items=vec![fixture()];let columns:Vec<String>=vec!["name".into(),"amount".into(),"quantity".into(),"unitPrice".into(),"specification".into(),"note".into(),"number".into()];
 for format in ["csv","xlsx"]{let bytes=export_bytes(format,&items,&columns).unwrap();verify_export(&bytes,format,&items,&columns).unwrap();if format=="csv"{assert_eq!(String::from_utf8(bytes).unwrap(),"\u{feff}품명,금액,수량,단가,규격,비고,번호\n합성 품목,252,2.5,100.6,,\"줄1\n줄2\",1\n");}else{
 let mut zip=ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();let mut styles=String::new();zip.by_name("xl/styles.xml").unwrap().read_to_string(&mut styles).unwrap();assert!(styles.contains("0.##"));assert!(styles.contains("#,##0"));let mut sheet=String::new();zip.by_name("xl/worksheets/sheet1.xml").unwrap().read_to_string(&mut sheet).unwrap();assert!(sheet.contains("width=\"28.7109375\""));
 }}
}
#[test]
fn formulas_remain_literal_and_csv_triggers_are_quoted(){
 let mut item=fixture();let columns:Vec<String>=vec!["name".into(),"note".into()];
 for trigger in ["=SUM(1,2)","+cmd","-cmd","@cmd","\tcmd","\rcmd"]{item.name=trigger.into();item.note="'already literal".into();let bytes=export_bytes("csv",&[item.clone()],&columns).unwrap();let rows=csv::ReaderBuilder::new().from_reader(&bytes[3..]).records().collect::<Result<Vec<_>,_>>().unwrap();assert_eq!(&rows[0][0],format!("'{trigger}"));verify_export(&bytes,"csv",&[item.clone()],&columns).unwrap();let bytes=export_bytes("xlsx",&[item.clone()],&columns).unwrap();verify_export(&bytes,"xlsx",&[item.clone()],&columns).unwrap();let mut archive=ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();let mut xml=String::new();archive.by_name("xl/worksheets/sheet1.xml").unwrap().read_to_string(&mut xml).unwrap();assert!(!xml.contains("<f>"));}
}
#[test]
fn generated_output_must_match_expected_contract(){
 let items=vec![fixture()];let cols=vec!["name".into(),"amount".into()];let csv=export_bytes("csv",&items,&cols).unwrap();assert!(verify_export(&csv[3..],"csv",&items,&cols).is_err());let mut corrupted=csv.clone();corrupted[4]^=1;assert!(verify_export(&corrupted,"csv",&items,&cols).is_err());assert!(verify_export(b"invalid","xlsx",&items,&cols).is_err());assert!(export_bytes("pdf",&items,&cols).is_err());assert!(export_bytes("csv",&[],&cols).is_err());
}
#[test]
fn export_cli_fixture(){
 let path=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/qa-fixtures");std::fs::create_dir_all(&path).unwrap();let items=vec![fixture()];let columns:Vec<String>=vec!["name".into(),"amount".into(),"quantity".into(),"unitPrice".into(),"specification".into(),"note".into()];std::fs::write(path.join("export-request.json"),serde_json::to_vec(&serde_json::json!({"items":items,"columns":columns})).unwrap()).unwrap();
}
