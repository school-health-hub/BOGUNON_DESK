// Original synthetic fixtures and assertions, selected unchanged from baseline.
use super::*;
use std::io::Write as _;
use rust_xlsxwriter::{Workbook,Chart,ChartType};
use zip::{write::SimpleFileOptions,ZipWriter};
    fn write_synthetic_xlsx(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "purchase-helper-{}-{name}.xlsx",
            std::process::id()
        ));
        let mut workbook = Workbook::new();
        let worksheet = workbook.add_worksheet();
        worksheet.write_string(0, 0, "품명").unwrap();
        worksheet.write_string(0, 1, "수량").unwrap();
        worksheet.write_string(0, 2, "단가").unwrap();
        worksheet.write_string(1, 0, "마스크").unwrap();
        worksheet.write_number(1, 1, 2).unwrap();
        worksheet.write_number(1, 2, 1000).unwrap();
        workbook.save(&path).unwrap();
        path
    }

    fn write_sparse_xlsx(name: &str, sheets: &[((u32, u16), (u32, u16))]) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "purchase-helper-{}-{name}.xlsx",
            std::process::id()
        ));
        let mut workbook = Workbook::new();
        for (index, &(first, last)) in sheets.iter().enumerate() {
            let worksheet = workbook.add_worksheet();
            worksheet.set_name(format!("Sheet{}", index + 1)).unwrap();
            worksheet.write_string(first.0, first.1, "품명").unwrap();
            worksheet.write_string(last.0, last.1, "품목").unwrap();
        }
        workbook.save(&path).unwrap();
        path
    }

    fn write_xlsx_with_declared_dimension(name: &str, declared_dimension: &str) -> PathBuf {
        let source = write_synthetic_xlsx(&format!("{name}-source"));
        let target = std::env::temp_dir().join(format!(
            "purchase-helper-{}-{name}.xlsx",
            std::process::id()
        ));
        let source_file = fs::File::open(&source).unwrap();
        let mut archive = ZipArchive::new(source_file).unwrap();
        let target_file = fs::File::create(&target).unwrap();
        let mut writer = ZipWriter::new(target_file);
        for index in 0..archive.len() {
            let mut entry = archive.by_index(index).unwrap();
            let entry_name = entry.name().to_owned();
            let options: SimpleFileOptions = entry.options();
            if entry.is_dir() {
                writer.add_directory(entry_name, options).unwrap();
                continue;
            }
            writer.start_file(&entry_name, options).unwrap();
            if entry_name == "xl/worksheets/sheet1.xml" {
                let mut xml = String::new();
                entry.read_to_string(&mut xml).unwrap();
                let start = xml.find("<dimension ").unwrap();
                let end = start + xml[start..].find("/>").unwrap() + 2;
                xml.replace_range(
                    start..end,
                    &format!(r#"<dimension ref="{declared_dimension}"/>"#),
                );
                writer.write_all(xml.as_bytes()).unwrap();
            } else {
                std::io::copy(&mut entry, &mut writer).unwrap();
            }
        }
        writer.finish().unwrap();
        let _ = fs::remove_file(source);
        target
    }

    fn write_xlsx_with_chartsheet(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "purchase-helper-{}-{name}.xlsx",
            std::process::id()
        ));
        let mut workbook = Workbook::new();
        let worksheet = workbook.add_worksheet();
        worksheet.write_string(0, 0, "품명").unwrap();
        worksheet.write_string(1, 0, "마스크").unwrap();

        let mut chart = Chart::new(ChartType::Column);
        chart.add_series().set_values("Sheet1!$A$2:$A$2");
        workbook
            .add_chartsheet()
            .insert_chart(0, 0, &chart)
            .unwrap();
        workbook.save(&path).unwrap();
        path
    }

    fn push_biff_record(stream: &mut Vec<u8>, record_type: u16, data: &[u8]) {
        stream.extend_from_slice(&record_type.to_le_bytes());
        stream.extend_from_slice(&(data.len() as u16).to_le_bytes());
        stream.extend_from_slice(data);
    }

    fn biff_dimensions(first_row: u32, last_row: u32, first_col: u16, last_col: u16) -> Vec<u8> {
        let mut data = Vec::with_capacity(14);
        data.extend_from_slice(&first_row.to_le_bytes());
        data.extend_from_slice(&last_row.to_le_bytes());
        data.extend_from_slice(&first_col.to_le_bytes());
        data.extend_from_slice(&last_col.to_le_bytes());
        data.extend_from_slice(&[0, 0]);
        data
    }

    fn biff_number_cell(row: u16, column: u16, value: f64) -> Vec<u8> {
        let mut data = Vec::with_capacity(14);
        data.extend_from_slice(&row.to_le_bytes());
        data.extend_from_slice(&column.to_le_bytes());
        data.extend_from_slice(&0u16.to_le_bytes());
        data.extend_from_slice(&value.to_le_bytes());
        data
    }

    fn biff_label_cell(row: u16, column: u16, value: &str) -> Vec<u8> {
        let encoded = value.encode_utf16().collect::<Vec<_>>();
        let mut data = Vec::with_capacity(9 + encoded.len() * 2);
        data.extend_from_slice(&row.to_le_bytes());
        data.extend_from_slice(&column.to_le_bytes());
        data.extend_from_slice(&0u16.to_le_bytes());
        data.extend_from_slice(&(encoded.len() as u16).to_le_bytes());
        data.push(1);
        for unit in encoded {
            data.extend_from_slice(&unit.to_le_bytes());
        }
        data
    }

    fn write_synthetic_xls(
        name: &str,
        dimensions: (u32, u32, u16, u16),
        records: &[(u16, Vec<u8>)],
    ) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("purchase-helper-{}-{name}.xls", std::process::id()));
        let sheet_name = b"Sheet1";
        let boundsheet_data_len = 8 + sheet_name.len();
        let sheet_offset = 8 + 4 + boundsheet_data_len + 4;
        let mut workbook = Vec::new();
        push_biff_record(&mut workbook, 0x0809, &[0x00, 0x06, 0x05, 0x00]);
        let mut boundsheet = Vec::with_capacity(boundsheet_data_len);
        boundsheet.extend_from_slice(&(sheet_offset as u32).to_le_bytes());
        boundsheet.extend_from_slice(&[0, 0, sheet_name.len() as u8, 0]);
        boundsheet.extend_from_slice(sheet_name);
        push_biff_record(&mut workbook, 0x0085, &boundsheet);
        push_biff_record(&mut workbook, 0x000A, &[]);
        push_biff_record(&mut workbook, 0x0809, &[0x00, 0x06, 0x10, 0x00]);
        push_biff_record(
            &mut workbook,
            0x0200,
            &biff_dimensions(dimensions.0, dimensions.1, dimensions.2, dimensions.3),
        );
        for (record_type, record) in records {
            push_biff_record(&mut workbook, *record_type, record);
        }
        push_biff_record(&mut workbook, 0x000A, &[]);

        let mut compound = cfb::create(&path).unwrap();
        let mut stream = compound.create_stream("/Workbook").unwrap();
        stream.write_all(&workbook).unwrap();
        drop(stream);
        drop(compound);
        path
    }

    fn unknown_rows() -> Vec<Vec<String>> {
        vec![
            vec![
                "상품".into(),
                "옵션".into(),
                "주문개수".into(),
                "판매금액".into(),
            ],
            vec!["일회용 장갑".into(), "M".into(), "2".into(), "12000".into()],
            vec!["알코올솜".into(), "100매".into(), "3".into(), "3500".into()],
        ]
    }

    fn manual_mapping() -> HashMap<String, usize> {
        HashMap::from([
            ("name".into(), 0),
            ("specification".into(), 1),
            ("quantity".into(), 2),
            ("unitPrice".into(), 3),
        ])
    }
    fn write_synthetic_xls_with_boundsheet_offset(
        name: &str,
        offset_for_len: impl FnOnce(usize) -> u32,
    ) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("purchase-helper-{}-{name}.xls", std::process::id()));
        let sheet_name = b"Sheet1";
        let mut workbook = Vec::new();
        push_biff_record(&mut workbook, 0x0809, &[0x00, 0x06, 0x05, 0x00]);
        let boundsheet_offset_position = workbook.len() + 4;
        let mut boundsheet = Vec::with_capacity(8 + sheet_name.len());
        boundsheet.extend_from_slice(&0u32.to_le_bytes());
        boundsheet.extend_from_slice(&[0, 0, sheet_name.len() as u8, 0]);
        boundsheet.extend_from_slice(sheet_name);
        push_biff_record(&mut workbook, 0x0085, &boundsheet);
        push_biff_record(&mut workbook, 0x000A, &[]);
        let sheet_offset = offset_for_len(workbook.len());
        workbook[boundsheet_offset_position..boundsheet_offset_position + 4]
            .copy_from_slice(&sheet_offset.to_le_bytes());

        let mut compound = cfb::create(&path).unwrap();
        let mut stream = compound.create_stream("/Workbook").unwrap();
        stream.write_all(&workbook).unwrap();
        drop(stream);
        drop(compound);
        path
    }

    fn write_synthetic_xls_with_boundsheet_data(name: &str, boundsheet: &[u8]) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("purchase-helper-{}-{name}.xls", std::process::id()));
        let mut workbook = Vec::new();
        push_biff_record(&mut workbook, 0x0809, &[0x00, 0x06, 0x05, 0x00]);
        push_biff_record(&mut workbook, 0x0085, boundsheet);
        push_biff_record(&mut workbook, 0x000A, &[]);

        let mut compound = cfb::create(&path).unwrap();
        let mut stream = compound.create_stream("/Workbook").unwrap();
        stream.write_all(&workbook).unwrap();
        drop(stream);
        drop(compound);
        path
    }

#[test]
    fn accepts_small_valid_xlsx_before_existing_import() {
        let path = write_synthetic_xlsx("preflight-valid");
        assert_eq!(preflight_xlsx(&path), Ok(()));
        let result = analyze_paths(vec![path.clone()], Vec::new()).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(result.sources[0].status, "success");
        assert_eq!(result.items.len(), 1);
    }

#[test]
    fn preserves_small_multi_sheet_xlsx_tables() {
        let path = write_sparse_xlsx("small-multi-sheet", &[((0, 0), (1, 1)), ((0, 0), (2, 2))]);
        let tables = spreadsheet_tables(&path).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(tables.len(), 2);
        assert_eq!(tables[0].1.len(), 2);
        assert_eq!(tables[1].1.len(), 3);
    }

#[test]
    fn rejects_sparse_xlsx_far_row_before_dense_materialization() {
        let path = write_sparse_xlsx("far-row", &[((0, 0), (MAX_SPREADSHEET_RAW_ROWS as u32, 0))]);
        assert_eq!(
            spreadsheet_tables(&path).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        let _ = fs::remove_file(path);
    }

#[test]
    fn rejects_sparse_xlsx_far_column_before_dense_materialization() {
        let path = write_sparse_xlsx(
            "far-column",
            &[((0, 0), (0, MAX_SPREADSHEET_COLUMNS as u16))],
        );
        assert_eq!(
            spreadsheet_tables(&path).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        let _ = fs::remove_file(path);
    }

#[test]
    fn rejects_sparse_xlsx_area_and_excel_maximum_corner_without_oom() {
        for (name, last) in [
            ("oversized-area", (1_000, 249)),
            ("excel-maximum-corner", (1_048_575, 16_383)),
        ] {
            let path = write_sparse_xlsx(name, &[((0, 0), last)]);
            assert_eq!(
                spreadsheet_tables(&path).unwrap_err(),
                SPREADSHEET_RESOURCE_LIMIT_MESSAGE
            );
            let _ = fs::remove_file(path);
        }
    }

#[test]
    fn accepts_exact_xlsx_dense_cell_boundary() {
        let path = write_sparse_xlsx("exact-cell-boundary", &[((0, 0), (999, 249))]);
        let tables = spreadsheet_tables(&path).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(tables[0].1.len(), 1_000);
        assert_eq!(tables[0].1[0].len(), 250);
    }

#[test]
    fn rejects_xlsx_workbook_total_before_materializing_over_budget_sheet() {
        let path = write_sparse_xlsx(
            "workbook-total",
            &[((0, 0), (999, 249)), ((0, 0), (999, 249)), ((0, 0), (0, 0))],
        );
        assert_eq!(
            spreadsheet_tables(&path).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        let _ = fs::remove_file(path);
    }

#[test]
    fn accepts_large_declared_xlsx_dimension_when_actual_cells_are_small() {
        let path = write_xlsx_with_declared_dimension("large-declared-dimension", "A1:XFD1048576");
        let tables = spreadsheet_tables(&path).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(tables[0].1.len(), 2);
        assert_eq!(tables[0].1[0].len(), 3);
        assert_eq!(tables[0].1[1][0], "마스크");
    }

#[test]
    fn preserves_xlsx_chartsheet_compatibility_without_dense_ranges() {
        let path = write_xlsx_with_chartsheet("chartsheet");
        let tables = spreadsheet_tables(&path).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(tables.len(), 2);
        assert_eq!(tables[0].1[1][0], "마스크");
        assert!(tables[1].1.is_empty());
    }

#[test]
    fn imports_small_valid_xls_with_korean_and_numeric_cells() {
        let records = vec![
            (0x0204, biff_label_cell(0, 0, "품명")),
            (0x0204, biff_label_cell(0, 1, "수량")),
            (0x0204, biff_label_cell(0, 2, "단가")),
            (0x0204, biff_label_cell(1, 0, "마스크")),
            (0x0203, biff_number_cell(1, 1, 2.0)),
            (0x0203, biff_number_cell(1, 2, 1_000.0)),
        ];
        let path = write_synthetic_xls("small-valid", (0, 2, 0, 3), &records);
        let result = analyze_paths(vec![path.clone()], Vec::new()).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(result.sources[0].status, "success");
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].name, "마스크");
        assert_eq!(result.items[0].quantity, Some(2.0));
        assert_eq!(result.items[0].unit_price, Some(1_000.0));
    }

#[test]
    fn rejects_xls_dense_ranges_before_calamine_open() {
        let oversized = write_synthetic_xls(
            "oversized-dimensions",
            (0, (MAX_SPREADSHEET_RAW_ROWS + 1) as u32, 0, 1),
            &[],
        );
        assert_eq!(
            spreadsheet_tables(&oversized).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        let _ = fs::remove_file(oversized);

        let stale = write_synthetic_xls(
            "stale-dimensions",
            (0, 1, 0, 1),
            &[(
                0x0203,
                biff_number_cell((MAX_SPREADSHEET_RAW_ROWS + 1) as u16, 0, 1.0),
            )],
        );
        assert_eq!(
            spreadsheet_tables(&stale).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        let _ = fs::remove_file(stale);

        let far_column = write_synthetic_xls(
            "far-column",
            (0, 1, 0, 1),
            &[(
                0x0203,
                biff_number_cell(0, MAX_SPREADSHEET_COLUMNS as u16, 1.0),
            )],
        );
        assert_eq!(
            spreadsheet_tables(&far_column).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        let _ = fs::remove_file(far_column);
    }

#[test]
    fn validates_xls_boundary_and_rejects_corrupt_compound_file() {
        let boundary = write_synthetic_xls("exact-boundary", (0, 1_000, 0, 250), &[]);
        assert_eq!(preflight_xls(&boundary), Ok(()));
        let _ = fs::remove_file(boundary);

        let corrupt = std::env::temp_dir().join(format!(
            "purchase-helper-{}-corrupt.xls",
            std::process::id()
        ));
        fs::write(&corrupt, b"not a compound file").unwrap();
        assert_eq!(
            preflight_xls(&corrupt).unwrap_err(),
            "스프레드시트를 읽지 못했습니다."
        );
        let _ = fs::remove_file(corrupt);
    }

#[test]
    fn rejects_xls_boundsheet_offsets_without_a_complete_record_header() {
        let beyond_stream =
            write_synthetic_xls_with_boundsheet_offset("offset-beyond-stream", |_| u32::MAX);
        assert_eq!(
            preflight_xls(&beyond_stream).unwrap_err(),
            "스프레드시트를 읽지 못했습니다."
        );
        let _ = fs::remove_file(beyond_stream);

        let final_byte =
            write_synthetic_xls_with_boundsheet_offset("offset-at-final-byte", |len| {
                (len - 1) as u32
            });
        assert_eq!(
            preflight_xls(&final_byte).unwrap_err(),
            "스프레드시트를 읽지 못했습니다."
        );
        let _ = fs::remove_file(final_byte);
    }

#[test]
    fn rejects_xls_boundsheet_records_shorter_than_calamine_metadata_fields() {
        for record_len in [4, 5] {
            let boundsheet = vec![0; record_len];
            let path = write_synthetic_xls_with_boundsheet_data(
                &format!("short-boundsheet-{record_len}"),
                &boundsheet,
            );
            assert_eq!(
                preflight_xls(&path).unwrap_err(),
                "스프레드시트를 읽지 못했습니다."
            );
            let _ = fs::remove_file(path);
        }
    }

#[test]
    fn validates_xls_dimensions_and_actual_cell_coordinates_before_calamine_open() {
        let mut normal = Vec::new();
        push_biff_record(&mut normal, 0x0200, &biff_dimensions(0, 2, 0, 2));
        push_biff_record(&mut normal, 0x0203, &biff_number_cell(1, 1, 0.0));
        push_biff_record(&mut normal, 0x000A, &[]);
        assert_eq!(validate_xls_sheet_stream(&normal, 0), Ok(4));

        let mut oversized_dimensions = Vec::new();
        push_biff_record(
            &mut oversized_dimensions,
            0x0200,
            &biff_dimensions(0, (MAX_SPREADSHEET_RAW_ROWS + 1) as u32, 0, 1),
        );
        assert_eq!(
            validate_xls_sheet_stream(&oversized_dimensions, 0).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );

        let mut stale_dimensions = Vec::new();
        push_biff_record(&mut stale_dimensions, 0x0200, &biff_dimensions(0, 1, 0, 1));
        push_biff_record(
            &mut stale_dimensions,
            0x0203,
            &biff_number_cell((MAX_SPREADSHEET_RAW_ROWS + 1) as u16, 0, 0.0),
        );
        assert_eq!(
            validate_xls_sheet_stream(&stale_dimensions, 0).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );

        let mut inverted_dimensions = Vec::new();
        push_biff_record(
            &mut inverted_dimensions,
            0x0200,
            &biff_dimensions(3, 3, 0, 1),
        );
        assert_eq!(
            validate_xls_sheet_stream(&inverted_dimensions, 0).unwrap_err(),
            "스프레드시트를 읽지 못했습니다."
        );
    }

#[test]
    fn rejects_malformed_xls_biff_without_internal_details() {
        let error = validate_xls_sheet_stream(&[0x03, 0x02, 0xff, 0xff], 0).unwrap_err();
        assert_eq!(error, "스프레드시트를 읽지 못했습니다.");
    }

#[test]
    fn accepts_spreadsheet_resource_boundaries_and_empty_sheets() {
        assert_eq!(
            validate_spreadsheet_sheet_count(MAX_SPREADSHEET_SHEETS),
            Ok(())
        );
        assert_eq!(spreadsheet_sheet_cell_count(0, 0), Ok(0));
        assert_eq!(
            spreadsheet_sheet_cell_count(MAX_SPREADSHEET_RAW_ROWS, 1),
            Ok(10_000)
        );
        assert_eq!(
            spreadsheet_sheet_cell_count(1, MAX_SPREADSHEET_COLUMNS),
            Ok(256)
        );
        assert_eq!(
            spreadsheet_sheet_cell_count(1_000, 250),
            Ok(MAX_SPREADSHEET_CELLS_PER_SHEET)
        );

        let mut total = 0;
        assert_eq!(
            reserve_spreadsheet_cells(&mut total, MAX_SPREADSHEET_CELLS_TOTAL),
            Ok(())
        );
        assert_eq!(total, MAX_SPREADSHEET_CELLS_TOTAL);
    }

#[test]
    fn rejects_spreadsheet_dimensions_without_truncation() {
        for result in [
            validate_spreadsheet_sheet_count(MAX_SPREADSHEET_SHEETS + 1),
            spreadsheet_sheet_cell_count(MAX_SPREADSHEET_RAW_ROWS + 1, 1).map(|_| ()),
            spreadsheet_sheet_cell_count(1, MAX_SPREADSHEET_COLUMNS + 1).map(|_| ()),
            spreadsheet_sheet_cell_count(1_001, 250).map(|_| ()),
        ] {
            assert_eq!(result.unwrap_err(), SPREADSHEET_RESOURCE_LIMIT_MESSAGE);
        }
    }

#[test]
    fn rejects_spreadsheet_total_cell_budget_and_overflow() {
        let mut total = MAX_SPREADSHEET_CELLS_TOTAL;
        assert_eq!(
            reserve_spreadsheet_cells(&mut total, 1).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        assert_eq!(total, MAX_SPREADSHEET_CELLS_TOTAL);

        let mut overflowing_total = usize::MAX;
        assert_eq!(
            reserve_spreadsheet_cells(&mut overflowing_total, 1).unwrap_err(),
            SPREADSHEET_RESOURCE_LIMIT_MESSAGE
        );
        assert_eq!(overflowing_total, usize::MAX);
    }

#[test]
    fn rejects_xlsx_entry_count_above_limit() {
        let result = validate_xlsx_metadata(
            MAX_XLSX_ENTRIES + 1,
            std::iter::empty::<XlsxEntryMetadata>(),
        );
        assert_eq!(result, Err(XlsxPreflightError::ResourceLimit));
    }

#[test]
    fn rejects_xlsx_entry_count_before_zip_archive_allocation() {
        assert_eq!(
            xlsx_entry_count_from_tail(&zip_eocd((MAX_XLSX_ENTRIES + 1) as u16, &[])),
            Err(XlsxPreflightError::ResourceLimit)
        );
        assert_eq!(
            xlsx_entry_count_from_tail(&zip_eocd(u16::MAX, &[])),
            Err(XlsxPreflightError::ResourceLimit)
        );
        assert_eq!(
            xlsx_entry_count_from_tail(&zip_eocd(MAX_XLSX_ENTRIES as u16, b"ok")),
            Ok(MAX_XLSX_ENTRIES)
        );
    }

#[test]
    fn rejects_single_xlsx_entry_above_uncompressed_limit() {
        let result = validate_xlsx_metadata(
            1,
            [XlsxEntryMetadata {
                compressed_bytes: MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES,
                uncompressed_bytes: MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES + 1,
            }],
        );
        assert_eq!(result, Err(XlsxPreflightError::ResourceLimit));
    }

#[test]
    fn rejects_xlsx_total_above_uncompressed_limit() {
        let half = MAX_XLSX_UNCOMPRESSED_BYTES / 2;
        let result = validate_xlsx_metadata(
            3,
            [
                XlsxEntryMetadata {
                    compressed_bytes: half,
                    uncompressed_bytes: half,
                },
                XlsxEntryMetadata {
                    compressed_bytes: half,
                    uncompressed_bytes: half,
                },
                XlsxEntryMetadata {
                    compressed_bytes: 1,
                    uncompressed_bytes: 1,
                },
            ],
        );
        assert_eq!(result, Err(XlsxPreflightError::ResourceLimit));
    }

#[test]
    fn rejects_extreme_xlsx_expansion_only_above_minimum_size() {
        let result = validate_xlsx_metadata(
            1,
            [XlsxEntryMetadata {
                compressed_bytes: 1,
                uncompressed_bytes: MIN_XLSX_RATIO_CHECK_BYTES + 1,
            }],
        );
        assert_eq!(result, Err(XlsxPreflightError::ResourceLimit));
    }

#[test]
    fn accepts_xlsx_resource_boundaries() {
        assert_eq!(
            validate_xlsx_metadata(
                MAX_XLSX_ENTRIES,
                std::iter::repeat_n(
                    XlsxEntryMetadata {
                        compressed_bytes: 0,
                        uncompressed_bytes: 0,
                    },
                    MAX_XLSX_ENTRIES,
                ),
            ),
            Ok(())
        );
        assert_eq!(
            validate_xlsx_metadata(
                2,
                [
                    XlsxEntryMetadata {
                        compressed_bytes: MAX_XLSX_UNCOMPRESSED_BYTES / 2,
                        uncompressed_bytes: MAX_XLSX_UNCOMPRESSED_BYTES / 2,
                    },
                    XlsxEntryMetadata {
                        compressed_bytes: MAX_XLSX_UNCOMPRESSED_BYTES / 2,
                        uncompressed_bytes: MAX_XLSX_UNCOMPRESSED_BYTES / 2,
                    },
                ],
            ),
            Ok(())
        );
        assert_eq!(
            validate_xlsx_metadata(
                1,
                [XlsxEntryMetadata {
                    compressed_bytes: 0,
                    uncompressed_bytes: MIN_XLSX_RATIO_CHECK_BYTES,
                }],
            ),
            Ok(())
        );
        let above_ratio_threshold = MIN_XLSX_RATIO_CHECK_BYTES + 1;
        assert_eq!(
            validate_xlsx_metadata(
                1,
                [XlsxEntryMetadata {
                    compressed_bytes: above_ratio_threshold.div_ceil(MAX_XLSX_EXPANSION_RATIO),
                    uncompressed_bytes: above_ratio_threshold,
                }],
            ),
            Ok(())
        );
    }

#[test]
    fn rejects_xlsx_metadata_size_arithmetic_overflow() {
        let result = validate_xlsx_metadata(
            2,
            [
                XlsxEntryMetadata {
                    compressed_bytes: u64::MAX,
                    uncompressed_bytes: 0,
                },
                XlsxEntryMetadata {
                    compressed_bytes: 1,
                    uncompressed_bytes: 0,
                },
            ],
        );
        assert_eq!(result, Err(XlsxPreflightError::ResourceLimit));
    }

#[test]
    fn rejects_invalid_xlsx_zip_without_exposing_archive_details() {
        let path = std::env::temp_dir().join(format!(
            "purchase-helper-{}-invalid.xlsx",
            std::process::id()
        ));
        fs::write(&path, b"not a zip archive").unwrap();
        let error = preflight_xlsx(&path).unwrap_err();
        let _ = fs::remove_file(path);
        assert_eq!(error, XlsxPreflightError::InvalidArchive);
        assert_eq!(error.user_message(), "스프레드시트를 읽지 못했습니다.");
    }

#[test]
    fn applies_zip_preflight_only_to_xlsx() {
        assert!(requires_xlsx_preflight(Path::new("quote.XLSX")));
        assert!(!requires_xlsx_preflight(Path::new("quote.xls")));
        assert!(!requires_xlsx_preflight(Path::new("quote.csv")));
        assert!(!requires_xlsx_preflight(Path::new("quote.pdf")));
    }

#[test]
    fn parses_titled_table() {
        let rows = vec![
            vec!["견적서".into()],
            vec!["품명".into(), "수량".into(), "단가".into()],
            vec!["마스크".into(), "2".into(), "1,500".into()],
        ];
        let items = parse_rows(&rows, "sample.csv").unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "마스크");
        assert_eq!(items[0].unit_price, Some(1500.0));
    }

#[test]
    fn unknown_headers_produce_mapping_candidate() {
        let options = generic_header_options(&unknown_rows());
        assert_eq!(options[0].row_index, 0);
        assert_eq!(
            options[0].signature,
            vec!["상품", "옵션", "주문개수", "판매금액"]
        );
        assert!(parse_rows(&unknown_rows(), "sample.xlsx").is_err());
    }

#[test]
    fn applies_manual_mapping_with_existing_validation() {
        let columns = normalize_mapping(&manual_mapping()).unwrap();
        let items = parse_rows_with_columns(&unknown_rows(), "sample.xlsx", 0, &columns).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].quantity, Some(2.0));
        assert_eq!(items[0].unit_price, Some(12000.0));
    }

#[test]
    fn rejects_missing_name_and_duplicate_mapping() {
        assert!(normalize_mapping(&HashMap::from([("quantity".into(), 2)])).is_err());
        assert!(
            normalize_mapping(&HashMap::from([("name".into(), 0), ("quantity".into(), 0)]))
                .is_err()
        );
    }

#[test]
    fn template_exact_signature_precedes_alias_fallback() {
        let template = ImportTemplate {
            id: "one".into(),
            name: "테스트".into(),
            header_signature: signature_for(&unknown_rows()[0]),
            mapping: manual_mapping(),
        };
        assert_eq!(
            template_items(&unknown_rows(), "sample.xlsx", &[template])
                .unwrap()
                .len(),
            2
        );
    }

#[test]
    fn reordered_signature_does_not_match_template() {
        let template = ImportTemplate {
            id: "one".into(),
            name: "테스트".into(),
            header_signature: signature_for(&unknown_rows()[0]),
            mapping: manual_mapping(),
        };
        let rows = vec![
            vec![
                "상품".into(),
                "주문개수".into(),
                "옵션".into(),
                "판매금액".into(),
            ],
            vec!["장갑".into(), "2".into(), "M".into(), "12000".into()],
        ];
        assert!(template_items(&rows, "sample.xlsx", &[template]).is_none());
    }

#[test]
    fn malformed_template_is_ignored() {
        let template = ImportTemplate {
            id: "bad".into(),
            name: "bad".into(),
            header_signature: signature_for(&unknown_rows()[0]),
            mapping: HashMap::from([("quantity".into(), 2)]),
        };
        assert!(template_items(&unknown_rows(), "sample.xlsx", &[template]).is_none());
    }

#[test]
    fn manual_mapping_keeps_amount_issue_and_total_exclusion() {
        let rows = vec![
            unknown_rows()[0].clone(),
            vec![
                "장갑".into(),
                "M".into(),
                "2".into(),
                "1000".into(),
                "3000".into(),
            ],
            vec!["합계".into(), "".into(), "".into(), "".into(), "".into()],
        ];
        let mapping = HashMap::from([
            ("name".into(), 0),
            ("quantity".into(), 2),
            ("unitPrice".into(), 3),
            ("amount".into(), 4),
        ]);
        let columns = normalize_mapping(&mapping).unwrap();
        let items = parse_rows_with_columns(&rows, "sample", 0, &columns).unwrap();
        assert_eq!(items.len(), 1);
        assert!(items[0].issues.contains(&"amountMismatch".to_owned()));
    }

    fn zip_eocd(entry_count: u16, comment: &[u8]) -> Vec<u8> {
        let mut eocd = vec![0; ZIP_EOCD_MIN_BYTES];
        eocd[0..4].copy_from_slice(&[0x50, 0x4b, 0x05, 0x06]);
        eocd[8..10].copy_from_slice(&entry_count.to_le_bytes());
        eocd[10..12].copy_from_slice(&entry_count.to_le_bytes());
        eocd[20..22].copy_from_slice(&(comment.len() as u16).to_le_bytes());
        eocd.extend_from_slice(comment);
        eocd
    }

use pdf_extract::{dictionary,Object,Stream};
    fn write_synthetic_pdf(name: &str, pages: &[&str]) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("purchase-helper-{}-{name}.pdf", std::process::id()));
        let mut document = Document::with_version("1.7");
        let font_id = document.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
            "Encoding" => "WinAnsiEncoding",
        });
        let pages_id = document.new_object_id();
        let mut page_ids = Vec::new();
        for page_text in pages {
            let operations = page_text
                .lines()
                .map(|line| {
                    let escaped = line
                        .replace('\\', "\\\\")
                        .replace('(', "\\(")
                        .replace(')', "\\)");
                    format!("({escaped}) Tj 0 -15 Td")
                })
                .collect::<Vec<_>>()
                .join("\n");
            let content = format!("BT /F1 10 Tf 50 750 Td\n{operations}\nET");
            let content_id = document.add_object(Stream::new(dictionary! {}, content.into_bytes()));
            let page_id = document.new_object_id();
            document.objects.insert(
                page_id,
                Object::Dictionary(dictionary! {
                    "Type" => "Page",
                    "Parent" => Object::Reference(pages_id),
                    "Contents" => Object::Reference(content_id),
                    "Resources" => dictionary! {
                        "Font" => dictionary! { "F1" => Object::Reference(font_id) },
                    },
                }),
            );
            page_ids.push(page_id);
        }
        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => page_ids.iter().copied().map(Object::Reference).collect::<Vec<_>>(),
                "Count" => page_ids.len() as i64,
                "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            }),
        );
        let catalog_id = document.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => Object::Reference(pages_id),
        });
        document.trailer.set("Root", catalog_id);
        document.save(&path).unwrap();
        path
    }
#[test]
    fn reconstructs_pdf_rows_without_splitting_single_spaces() {
        let rows = pdf_text_rows(
            "견 적 서\n품명  규격  수량  단가  금액\n일회용 니트릴 장갑  M  2  ₩12,500  25,000\n페이지 1/1",
        )
        .unwrap();
        assert_eq!(rows[0], vec!["견 적 서"]);
        assert_eq!(rows[2][0], "일회용 니트릴 장갑");
        assert!(!rows.iter().flatten().any(|value| value.contains("페이지")));
        let items = parse_rows(&rows, "synthetic.pdf").unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].unit_price, Some(12500.0));
    }
#[test]
    fn unknown_pdf_headers_produce_existing_mapping_candidate() {
        let rows =
            pdf_text_rows("상품  옵션사항  주문개수  판매금액\nDisposable gloves  M  2  12000")
                .unwrap();
        assert!(parse_rows(&rows, "unknown.pdf").is_err());
        let candidate = make_candidate("unknown.pdf", "PDF", &rows).unwrap();
        assert_eq!(candidate.sheet_name, "PDF");
        let columns = normalize_mapping(&manual_mapping()).unwrap();
        let items = parse_rows_with_columns(&rows, "unknown.pdf", 0, &columns).unwrap();
        assert_eq!(items.len(), 1);
    }
#[test]
    fn repeats_pdf_header_without_importing_it_as_an_item() {
        let rows = pdf_text_rows(
            "Name  Qty  UnitPrice\nMasks  1  1000\nName  Qty  UnitPrice\nGloves  2  2000",
        )
        .unwrap();
        let items = parse_rows(&rows, "two-pages.pdf").unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].name, "Masks");
        assert_eq!(items[1].name, "Gloves");
    }
#[test]
    fn extracts_a_synthetic_text_pdf_and_reuses_templates() {
        let path = write_synthetic_pdf(
            "text-table",
            &["Quotation\nName\tSpec\tQty\tUnitPrice\tAmount\nMasks\tKF94\t2\t10000\t20000\nGloves\tM\t3\t5000\t15000"],
        );
        let rows = pdf_rows(&path).unwrap();
        assert_eq!(parse_rows(&rows, "text-table.pdf").unwrap().len(), 2);
        let result = analyze_paths(vec![path.clone()], Vec::new()).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(result.sources[0].status, "success");
        assert_eq!(result.items.len(), 2);
    }
#[test]
    fn extracts_multi_page_pdf_and_skips_repeated_headers_and_totals() {
        let path = write_synthetic_pdf(
            "multi-page",
            &[
                "Name\tQty\tUnitPrice\nMasks\t1\t1000",
                "Name\tQty\tUnitPrice\nGloves\t2\t2000\nTotal\t\t3000\nPage 2/2",
            ],
        );
        let rows = pdf_rows(&path).unwrap();
        let items = parse_rows(&rows, "multi-page.pdf").unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].name, "Masks");
        assert_eq!(items[1].name, "Gloves");
    }
#[test]
    fn pdf_unknown_headers_use_saved_exact_signature_template() {
        let path = write_synthetic_pdf(
            "unknown-table",
            &["Product\tOption\tOrderCount\tSalePrice\nGloves\tM\t2\t12000"],
        );
        let first = analyze_paths(vec![path.clone()], Vec::new()).unwrap();
        assert_eq!(first.sources[0].status, "needsMapping");
        let mapping = HashMap::from([
            ("name".to_owned(), 0),
            ("specification".to_owned(), 1),
            ("quantity".to_owned(), 2),
            ("unitPrice".to_owned(), 3),
        ]);
        let template = ImportTemplate {
            id: "pdf-template".to_owned(),
            name: "Synthetic PDF".to_owned(),
            header_signature: first.candidates[0].header_options[0].signature.clone(),
            mapping,
        };
        let second = analyze_paths(vec![path.clone()], vec![template]).unwrap();
        let _ = fs::remove_file(path);
        assert_eq!(second.sources[0].status, "success");
        assert_eq!(second.items.len(), 1);
        assert!(second.candidates.is_empty());
    }
#[test]
    fn treats_an_image_only_pdf_as_unsupported() {
        let path = write_synthetic_pdf("scanned", &[""]);
        let error = pdf_rows(&path).unwrap_err();
        let result = analyze_paths(vec![path.clone()], Vec::new()).unwrap();
        let _ = fs::remove_file(path);
        assert!(matches!(error, PdfTableError::Unsupported(_)));
        assert_eq!(result.sources[0].status, "unsupported");
        assert!(result.sources[0]
            .message
            .as_deref()
            .is_some_and(|message| message.contains("스캔 문서 OCR")));
    }
#[test]
    fn rejects_pdf_page_and_text_limits() {
        let pages = vec![""; MAX_PDF_PAGES + 1];
        let path = write_synthetic_pdf("too-many-pages", &pages);
        assert!(
            matches!(pdf_rows(&path), Err(PdfTableError::Error(message)) if message.contains("50페이지"))
        );
        let _ = fs::remove_file(path);
        let oversized = "A".repeat(MAX_PDF_TEXT_BYTES + 1);
        assert!(
            matches!(pdf_text_rows(&oversized), Err(PdfTableError::Error(message)) if message.contains("2MB"))
        );
    }
#[test]
fn cli_fixtures_and_automatic_sheet_contract() {
    let dir=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/qa-fixtures");fs::create_dir_all(&dir).unwrap();
    let mut workbook=Workbook::new();
    for (index, count) in [1usize,2].iter().enumerate(){let sheet=workbook.add_worksheet();sheet.set_name(format!("Synthetic{index}")).unwrap();for (col,name) in ["품명","수량","단가"].iter().enumerate(){sheet.write_string(0,col as u16,*name).unwrap();}for row in 1..=*count{sheet.write_string(row as u32,0,"합성 품목").unwrap();sheet.write_number(row as u32,1,2).unwrap();sheet.write_number(row as u32,2,100).unwrap();}}
    let xlsx=dir.join("synthetic.xlsx");workbook.save(&xlsx).unwrap();let result=analyze_paths(vec![xlsx.clone()],vec![]).unwrap();assert_eq!(result.items.len(),2);
    fs::write(dir.join("expected-xlsx.json"),serde_json::to_vec(&result).unwrap()).unwrap();
    let records=vec![(0x0204,biff_label_cell(0,0,"품명")),(0x0204,biff_label_cell(0,1,"수량")),(0x0204,biff_label_cell(0,2,"단가")),(0x0204,biff_label_cell(1,0,"합성 XLS")),(0x0203,biff_number_cell(1,1,2.0)),(0x0203,biff_number_cell(1,2,100.0))];
    let xls=write_synthetic_xls("cli-fixture",(0,2,0,3),&records);fs::copy(&xls,dir.join("synthetic.xls")).unwrap();let _=fs::remove_file(xls);
    let mut unknown=Workbook::new();let sheet=unknown.add_worksheet();for (col,name) in ["대상","개입","예상값"].iter().enumerate(){sheet.write_string(0,col as u16,*name).unwrap();}sheet.write_string(1,0,"합성 매핑").unwrap();sheet.write_number(1,1,3).unwrap();sheet.write_number(1,2,25).unwrap();unknown.save(dir.join("unknown.xlsx")).unwrap();
}

#[path="pdf_tests.rs"]
mod pdf_tests;
