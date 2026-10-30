use super::{TemplateContractError, TemplateManifest};

pub(crate) const APPROVED_TEMPLATE_SHA256: &str =
    "15217AE983DEE30575C86CE9573B38568404985CA9C1CF2CF4E2DBA905A3FF36";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BookmarkKind {
    Point,
    Start,
    End,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BookmarkRule {
    pub(crate) kind: BookmarkKind,
    pub(crate) name: String,
    pub(crate) path: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ZipEntryRule {
    pub(crate) name: String,
    pub(crate) method: u16,
    pub(crate) flags: u16,
    pub(crate) extra_len: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ApprovedTemplateContract {
    pub(crate) sha256: String,
    pub(crate) zip_entries: Vec<ZipEntryRule>,
    pub(crate) bookmarks: Vec<BookmarkRule>,
    pub(crate) table_count: usize,
    pub(crate) frame_count: usize,
    pub(crate) style_reference_count: usize,
    pub(crate) style_reference_sha256: String,
}

impl ApprovedTemplateContract {
    pub(crate) fn production() -> Self {
        Self {
            sha256: APPROVED_TEMPLATE_SHA256.to_owned(),
            zip_entries: [
                "META-INF/manifest.xml",
                "content.xml",
                "meta.xml",
                "mimetype",
                "settings.xml",
                "styles.xml",
            ]
            .into_iter()
            .map(|name| ZipEntryRule {
                name: name.to_owned(),
                method: 8,
                flags: 4,
                extra_len: 17,
            })
            .collect(),
            bookmarks: production_bookmarks(),
            table_count: 4,
            frame_count: 4,
            style_reference_count: 255,
            style_reference_sha256:
                "1926FEAEAD668395F2A79731AFEEC9F369CFFAF91D96D911B684043E47C63503".to_owned(),
        }
    }

    pub(crate) fn validate(
        &self,
        manifest: &TemplateManifest,
    ) -> Result<(), TemplateContractError> {
        if manifest.zip_entries != self.zip_entries {
            return Err(TemplateContractError::StructureMismatch(
                "ZIP entry contract",
            ));
        }
        if manifest.bookmarks != self.bookmarks {
            return Err(TemplateContractError::StructureMismatch(
                "bookmark contract",
            ));
        }
        if manifest.table_count != self.table_count || manifest.frame_count != self.frame_count {
            return Err(TemplateContractError::StructureMismatch(
                "table/frame count",
            ));
        }
        if manifest.style_reference_count != self.style_reference_count
            || manifest.style_reference_sha256 != self.style_reference_sha256
        {
            return Err(TemplateContractError::StructureMismatch("style references"));
        }
        Ok(())
    }
}

pub(crate) fn p10_output_zip_contract() -> Vec<ZipEntryRule> {
    [
        "META-INF/manifest.xml",
        "content.xml",
        "meta.xml",
        "mimetype",
        "settings.xml",
        "styles.xml",
    ]
    .into_iter()
    .map(|name| ZipEntryRule {
        name: name.to_owned(),
        method: u16::from(name != "mimetype") * 8,
        flags: 0,
        extra_len: 0,
    })
    .collect()
}

fn production_bookmarks() -> Vec<BookmarkRule> {
    const ROOT: &str = "document-content[0]/body[0]/text[0]";
    let header = format!("{ROOT}/p[0]/span[0]/frame[0]/text-box[0]/table[0]");
    let footer = format!("{ROOT}/p[2]/span[0]/frame[0]/text-box[0]/table[0]/table-header-rows[0]/table-row[0]/table-cell[0]/p[0]/span[0]");
    let inner = format!("{footer}/frame[1]/text-box[0]/table[0]");
    let mut rules = vec![
        point("CellField1¡머리표어¡F", &format!("{header}/table-header-rows[0]/table-row[0]/table-cell[0]/p[0]/bookmark[0]")),
        point("CellField2¡로고¡F", &format!("{header}/table-row[0]/table-cell[0]/p[0]/bookmark[0]")),
        point("CellField3¡발신기관명¡F", &format!("{header}/table-row[0]/table-cell[1]/p[0]/bookmark[0]")),
        point("CellField4¡심볼¡F", &format!("{header}/table-row[0]/table-cell[2]/p[0]/bookmark[0]")),
        point("CellField5¡수신¡F", &format!("{header}/table-row[2]/table-cell[1]/p[0]/bookmark[0]")),
        point("CellField6¡경유¡F", &format!("{header}/table-row[3]/table-cell[1]/p[0]/bookmark[0]")),
        point("CellField7¡결재제목¡T", &format!("{header}/table-row[4]/table-cell[1]/p[0]/bookmark[0]")),
        BookmarkRule { kind: BookmarkKind::Start, name: "NormalField1¡본문¡본문을 입력하십시오¡T¡F".to_owned(), path: format!("{ROOT}/p[1]/span[0]/bookmark-start[0]") },
        BookmarkRule { kind: BookmarkKind::End, name: "NormalField1¡본문¡본문을 입력하십시오¡T¡F".to_owned(), path: format!("{ROOT}/p[1]/span[2]/bookmark-end[0]") },
        point("CellField8¡관인¡T", &format!("{footer}/frame[0]/text-box[0]/table[0]/table-header-rows[0]/table-row[0]/table-cell[0]/p[0]/bookmark[0]")),
        point("CellField9¡발신명의¡F", &format!("{inner}/table-header-rows[0]/table-row[0]/table-cell[1]/p[0]/bookmark[0]")),
        point("CellField10¡관인생략¡F", &format!("{inner}/table-header-rows[0]/table-row[0]/table-cell[2]/p[0]/bookmark[0]")),
        point("CellField11¡수신처캡션¡F", &format!("{inner}/table-row[0]/table-cell[0]/p[0]/bookmark[0]")),
        point("CellField12¡수신처¡F", &format!("{inner}/table-row[0]/table-cell[1]/p[0]/bookmark[0]")),
        point("CellField13¡서식버전-201212¡F", &format!("{inner}/table-row[1]/table-cell[0]/p[0]/bookmark[0]")),
    ];
    let placements = [
        (14, "직위.1", 2, 0),
        (15, "서명.1", 2, 1),
        (16, "직위.2", 2, 2),
        (17, "서명.2", 2, 3),
        (18, "직위.3", 2, 4),
        (19, "서명.3", 2, 5),
        (20, "직위.4", 2, 6),
        (21, "서명.4", 2, 7),
        (22, "협조직위.1", 3, 1),
        (23, "협조.1", 3, 2),
        (24, "협조직위.2", 3, 3),
        (25, "협조.2", 3, 4),
        (26, "협조직위.3", 3, 5),
        (27, "협조.3", 3, 6),
        (28, "협조직위.4", 3, 7),
        (29, "협조.4", 3, 8),
        (30, "문서번호", 4, 1),
        (31, "시행일자", 4, 3),
        (32, "접수번호", 4, 6),
        (33, "접수일자", 4, 8),
        (34, "우편번호", 5, 1),
        (35, "주소", 5, 2),
        (36, "홈페이지", 5, 4),
        (37, "전화", 6, 1),
        (38, "전송", 6, 3),
        (39, "이메일", 6, 5),
        (40, "공개여부", 6, 7),
    ];
    rules.extend(placements.into_iter().map(|(number, label, row, cell)| {
        let flag = if (34..=39).contains(&number) {
            "T"
        } else {
            "F"
        };
        point(
            &format!("CellField{number}¡{label}¡{flag}"),
            &format!("{inner}/table-row[{row}]/table-cell[{cell}]/p[0]/bookmark[0]"),
        )
    }));
    rules.push(point("CellField41¡꼬리표어¡T", &format!("{ROOT}/p[2]/span[0]/frame[0]/text-box[0]/table[0]/table-row[0]/table-cell[0]/p[0]/bookmark[0]")));
    rules
}

fn point(name: &str, path: &str) -> BookmarkRule {
    BookmarkRule {
        kind: BookmarkKind::Point,
        name: name.to_owned(),
        path: path.to_owned(),
    }
}
