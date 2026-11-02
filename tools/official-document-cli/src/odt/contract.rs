use super::{OdtError, TemplateManifest};

pub const HOME_V1_SHA256: &str = "8BC0FD240B1BEA06758794D9F07A75ABF7FAF13BAC1FBDBCDD3556BE3FF6C285";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BookmarkKind {
    Point,
    Start,
    End,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BookmarkRule {
    pub kind: BookmarkKind,
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ZipEntryRule {
    pub name: String,
    pub method: u16,
    pub flags: u16,
    pub extra_len: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApprovedTemplateContract {
    pub sha256: String,
    pub zip_entries: Vec<ZipEntryRule>,
    pub bookmarks: Vec<BookmarkRule>,
    pub table_count: usize,
    pub frame_count: usize,
    pub style_reference_count: usize,
    pub style_reference_sha256: String,
}

impl ApprovedTemplateContract {
    pub fn home_v1() -> Self {
        Self {
            sha256: HOME_V1_SHA256.to_owned(),
            zip_entries: template_zip_contract(),
            bookmarks: production_bookmarks(),
            table_count: 4,
            frame_count: 4,
            style_reference_count: 255,
            style_reference_sha256:
                "95162FDFF6196124FB6A01108DFFD13178A18261F2B581996B565D5FB465F028".to_owned(),
        }
    }

    pub fn validate(&self, manifest: &TemplateManifest) -> Result<(), OdtError> {
        if manifest.zip_entries != self.zip_entries {
            return Err(OdtError::Structure("ZIP entry contract"));
        }
        if manifest.bookmarks != self.bookmarks {
            return Err(OdtError::Structure("bookmark contract"));
        }
        if manifest.table_count != self.table_count || manifest.frame_count != self.frame_count {
            return Err(OdtError::Structure("table/frame count"));
        }
        if manifest.style_reference_count != self.style_reference_count
            || manifest.style_reference_sha256 != self.style_reference_sha256
        {
            return Err(OdtError::Structure("style references"));
        }
        Ok(())
    }
}

pub fn output_zip_contract() -> Vec<ZipEntryRule> {
    zip_contract(8, 0, 0, true)
}

fn template_zip_contract() -> Vec<ZipEntryRule> {
    zip_contract(8, 4, 17, false)
}

fn zip_contract(
    method: u16,
    flags: u16,
    extra_len: usize,
    stored_mimetype: bool,
) -> Vec<ZipEntryRule> {
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
        method: if stored_mimetype && name == "mimetype" {
            0
        } else {
            method
        },
        flags,
        extra_len,
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
