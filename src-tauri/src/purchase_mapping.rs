use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::purchase_helper::{
    field_for, is_total_row, parse_number, signature_for, ImportTemplate, IMPORT_FIELDS,
};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MappingConfidence {
    Automatic,
    Review,
    Manual,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FieldRecommendation {
    pub(crate) field: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) column_index: Option<usize>,
    pub(crate) header: String,
    pub(crate) confidence: MappingConfidence,
    pub(crate) reasons: Vec<String>,
    pub(crate) warnings: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MappingRecommendation {
    pub(crate) mapping: HashMap<String, usize>,
    pub(crate) confidence: MappingConfidence,
    pub(crate) fields: Vec<FieldRecommendation>,
    pub(crate) warnings: Vec<String>,
}

fn valid_template(template: &ImportTemplate, width: usize) -> bool {
    let mut used = HashSet::new();
    template.mapping.contains_key("name")
        && template.mapping.iter().all(|(field, index)| {
            IMPORT_FIELDS.contains(&field.as_str()) && *index < width && used.insert(*index)
        })
}

fn numeric_warning(field: &str, value: &str) -> bool {
    let remaining = match field {
        "quantity" => value.trim().trim_end_matches(['개', '매']),
        "unitPrice" | "amount" => value.trim().trim_end_matches('원'),
        _ => return false,
    };
    let valid = parse_number(value).is_some_and(|number| {
        number.is_finite()
            && match field {
                "quantity" => number > 0.0,
                _ => number >= 0.0,
            }
    });
    !valid || remaining.chars().any(char::is_alphabetic)
}

fn data_warnings(rows: &[&Vec<String>], field: &str, index: usize) -> Vec<String> {
    let mut checked = 0;
    let mut non_empty = 0;
    let mut concerns = 0;
    for row in rows {
        checked += 1;
        let value = row.get(index).map_or("", String::as_str).trim();
        if value.is_empty() {
            continue;
        }
        non_empty += 1;
        if numeric_warning(field, value)
            || (field == "name" && value.chars().all(|character| character.is_ascii_digit()))
        {
            concerns += 1;
        }
    }
    if checked == 0 {
        return vec!["검사할 데이터 행이 없어 직접 확인해야 합니다.".to_owned()];
    }
    if non_empty == 0 {
        return vec![format!(
            "검사한 {checked}행에서 이 열은 모두 비어 있습니다."
        )];
    }
    let mut warnings = Vec::new();
    if field == "name" && non_empty < checked {
        warnings.push(format!(
            "검사한 {checked}행 중 품명이 빈 행이 {}개 있습니다.",
            checked - non_empty
        ));
    }
    if concerns > 0 {
        warnings.push(format!("검사한 {checked}행 중 숫자·문자 혼합 또는 값 확인이 필요한 행이 {concerns}개 있습니다."));
    }
    warnings
}

pub(crate) fn recommend(
    rows: &[Vec<String>],
    header_row: usize,
    templates: &[ImportTemplate],
) -> MappingRecommendation {
    let headers = rows.get(header_row).map_or(&[][..], Vec::as_slice);
    let mut aliases: HashMap<&str, Vec<usize>> = HashMap::new();
    for (index, value) in headers.iter().enumerate() {
        if let Some(field) = field_for(value) {
            aliases.entry(field).or_default().push(index);
        }
    }
    let mut mapping = HashMap::new();
    let mut warnings = Vec::new();
    for field in IMPORT_FIELDS {
        if let Some(indices) = aliases.get(field) {
            if indices.len() == 1 {
                mapping.insert(field.to_owned(), indices[0]);
            } else {
                warnings.push(format!(
                    "같은 항목으로 인식되는 원본 열이 {}개 있어 직접 선택해야 합니다.",
                    indices.len()
                ));
            }
        }
    }
    let signature = signature_for(headers);
    let matches = templates
        .iter()
        .filter(|template| !signature.is_empty() && template.header_signature == signature)
        .collect::<Vec<_>>();
    let mut selected: Option<&ImportTemplate> = None;
    for template in matches {
        if !valid_template(template, headers.len()) {
            warnings.push("저장된 열 설정의 필수 연결·열 범위·중복을 확인해야 합니다. 이 설정은 자동 적용하지 않습니다.".to_owned());
            continue;
        }
        if let Some(previous) = selected {
            if previous.mapping != template.mapping {
                warnings.push(
                    "동일한 머리글에 서로 다른 저장 연결이 있어 확인이 필요합니다.".to_owned(),
                );
            }
        } else {
            selected = Some(template);
        }
    }
    if let Some(template) = selected {
        mapping = template.mapping.clone();
    }
    if mapping.len() < 3
        && !["quantity", "unitPrice", "amount"]
            .iter()
            .any(|field| mapping.contains_key(*field))
    {
        warnings.push("품명 외 수량·단가·금액 등의 연결을 확인해야 합니다.".to_owned());
    }
    let data_rows = rows
        .iter()
        .skip(header_row + 1)
        .filter(|row| {
            !row.iter().all(|cell| cell.trim().is_empty())
                && signature_for(row) != signature
                && !mapping
                    .get("name")
                    .and_then(|index| row.get(*index))
                    .is_some_and(|value| is_total_row(value))
        })
        .collect::<Vec<_>>();
    let fields = IMPORT_FIELDS
        .into_iter()
        .map(|field| {
            let index = mapping.get(field).copied();
            let header = index
                .and_then(|column| headers.get(column))
                .cloned()
                .unwrap_or_default();
            let mut reasons = Vec::new();
            let mut field_warnings = Vec::new();
            if let Some(template) = selected {
                if index.is_some() {
                    reasons.push(format!(
                        "정확한 머리글 순서와 일치하는 저장 설정 ‘{}’의 연결입니다.",
                        template.name
                    ));
                }
            }
            if let Some(column) = index {
                match field_for(&header) {
                    Some(matched) if matched == field => {
                        reasons.push("기존 머리글 별칭과 일치합니다.".to_owned())
                    }
                    Some(_) => field_warnings
                        .push("저장된 연결과 현재 머리글의 의미가 다릅니다.".to_owned()),
                    None => field_warnings.push(
                        "현재 머리글 별칭으로 연결 의미를 확인할 수 없어 확인이 필요합니다."
                            .to_owned(),
                    ),
                }
                if aliases
                    .get(field)
                    .is_some_and(|indices| indices.len() != 1 || indices[0] != column)
                {
                    field_warnings.push(
                        "다른 원본 열도 같은 항목으로 인식되어 확인이 필요합니다.".to_owned(),
                    );
                }
                field_warnings.extend(data_warnings(&data_rows, field, column));
            } else if aliases.get(field).is_some_and(|indices| indices.len() > 1) {
                field_warnings
                    .push("원본 열 후보가 여러 개여서 자동 선택하지 않았습니다.".to_owned());
            }
            let confidence = match index {
                None => MappingConfidence::Manual,
                Some(_) if field_warnings.is_empty() => MappingConfidence::Automatic,
                Some(_) => MappingConfidence::Review,
            };
            FieldRecommendation {
                field: field.to_owned(),
                column_index: index,
                header,
                confidence,
                reasons,
                warnings: field_warnings,
            }
        })
        .collect::<Vec<_>>();
    let confidence = if !mapping.contains_key("name") {
        MappingConfidence::Manual
    } else if !warnings.is_empty()
        || fields.iter().any(|field| {
            field.column_index.is_some() && field.confidence != MappingConfidence::Automatic
        })
    {
        MappingConfidence::Review
    } else {
        MappingConfidence::Automatic
    };
    MappingRecommendation {
        mapping,
        confidence,
        fields,
        warnings,
    }
}
