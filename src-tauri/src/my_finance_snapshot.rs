//! Validated backup snapshot metadata and fail-closed restore decisions.
//! Pure policy only: never performs filesystem writes or decrypts DB files.
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub(crate) const SNAPSHOT_SCHEMA_VERSION: u32 = 2;
const MAX_RECORDS: usize = 100_000;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SnapshotIdentity {
    pub schema_version: u32,
    pub dataset_id: Uuid,
    pub revision: u64,
    pub history: Vec<Uuid>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum IncomeKind { Salary, Consulting, Ebook, Lecture, Other }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TaxCategory { Unverified, Employment, Business, OtherIncome, Royalty, NonTaxable, Unknown }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum DeductionKind { IncomeTax, LocalIncomeTax, EmploymentInsurance, PlatformFee, Other }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct IncomeDeduction {
    pub kind: DeductionKind,
    pub amount_krw: i64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct IncomeEntry {
    pub id: Uuid,
    pub source_name: String,
    pub income_kind: IncomeKind,
    pub contract_label: String,
    pub tax_category: TaxCategory,
    pub tax_category_verified: bool,
    pub earned_on: String,
    pub paid_on: Option<String>,
    pub gross_krw: i64,
    pub deductions: Vec<IncomeDeduction>,
    pub net_krw: i64,
    pub notes: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FinanceSnapshot {
    pub identity: SnapshotIdentity,
    pub income: Vec<IncomeEntry>,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum RestoreDecision {
    AllowNewDataset,
    AllowForward,
    AlreadyCurrent,
    RejectStale,
    RejectDiverged,
    RejectDifferentDataset,
    RejectInvalid,
}

fn valid_iso_date(value: &str) -> bool {
    let b = value.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-'
        || !b.iter().enumerate().all(|(i, x)| i == 4 || i == 7 || x.is_ascii_digit())
    {
        return false;
    }
    let Ok(year) = value[..4].parse::<u32>() else { return false };
    let Ok(month) = value[5..7].parse::<u32>() else { return false };
    let Ok(day) = value[8..10].parse::<u32>() else { return false };
    if !(1900..=9999).contains(&year) || !(1..=12).contains(&month) { return false; }
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = match month {
        2 if leap => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    day >= 1 && day <= days
}

pub(crate) fn validate_snapshot(snapshot: &FinanceSnapshot) -> bool {
    let id = &snapshot.identity;
    if id.schema_version != SNAPSHOT_SCHEMA_VERSION
        || id.dataset_id.is_nil()
        || id.revision == 0
        || id.revision > MAX_RECORDS as u64
        || id.history.len() != id.revision as usize
        || id.history.iter().any(Uuid::is_nil)
        || snapshot.income.len() > MAX_RECORDS
    {
        return false;
    }
    let mut changes = std::collections::HashSet::new();
    if !id.history.iter().all(|change| changes.insert(*change)) { return false; }
    let mut records = std::collections::HashSet::new();
    snapshot.income.iter().all(|entry| records.insert(entry.id) && validate_income_entry(entry))
}

pub(crate) fn validate_income_entry(entry: &IncomeEntry) -> bool {
    !entry.id.is_nil()
        && !entry.source_name.trim().is_empty()
        && entry.source_name.len() <= 200
        && valid_iso_date(&entry.earned_on)
        && entry.paid_on.as_ref().is_none_or(|date| valid_iso_date(date))
        && entry.gross_krw >= 0
        && entry.contract_label.len() <= 200
        && entry.notes.len() <= 5000
        && entry.deductions.len() <= 100
        && entry.deductions.iter().all(|d| d.amount_krw >= 0)
        && entry.deductions.iter().try_fold(0_i64, |sum, d| sum.checked_add(d.amount_krw))
            .is_some_and(|sum| sum <= entry.gross_krw && entry.net_krw == entry.gross_krw - sum)
        && (!entry.tax_category_verified || !matches!(entry.tax_category, TaxCategory::Unverified | TaxCategory::Unknown))
}

pub(crate) fn decide_restore(
    current: Option<&SnapshotIdentity>,
    incoming: &FinanceSnapshot,
) -> RestoreDecision {
    if !validate_snapshot(incoming) { return RestoreDecision::RejectInvalid; }
    let Some(local) = current else { return RestoreDecision::AllowNewDataset };
    let remote = &incoming.identity;
    if local.schema_version != SNAPSHOT_SCHEMA_VERSION
        || local.dataset_id.is_nil()
        || local.revision == 0
        || local.history.len() != local.revision as usize
        || local.history.iter().any(Uuid::is_nil)
        || local.history.iter().copied().collect::<std::collections::HashSet<_>>().len() != local.history.len()
    {
        return RestoreDecision::RejectInvalid;
    }
    if local.dataset_id != remote.dataset_id { return RestoreDecision::RejectDifferentDataset; }
    let shared = local.history.len().min(remote.history.len());
    if local.history[..shared] != remote.history[..shared] { return RestoreDecision::RejectDiverged; }
    match remote.revision.cmp(&local.revision) {
        std::cmp::Ordering::Greater => RestoreDecision::AllowForward,
        std::cmp::Ordering::Equal => RestoreDecision::AlreadyCurrent,
        std::cmp::Ordering::Less => RestoreDecision::RejectStale,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> FinanceSnapshot {
        FinanceSnapshot {
            identity: SnapshotIdentity {
                schema_version: SNAPSHOT_SCHEMA_VERSION,
                dataset_id: Uuid::new_v4(),
                revision: 1,
                history: vec![Uuid::new_v4()],
            },
            income: vec![IncomeEntry {
                id: Uuid::new_v4(),
                source_name: "Example".into(),
                income_kind: IncomeKind::Consulting,
                contract_label: "advisory".into(),
                earned_on: "2026-10-15".into(),
                paid_on: None,
                gross_krw: 400_000,
                deductions: vec![IncomeDeduction { kind: DeductionKind::Other, amount_krw: 3_600 }],
                net_krw: 396_400,
                notes: String::new(),
                tax_category: TaxCategory::Unverified,
                tax_category_verified: false,
            }],
        }
    }

    #[test]
    fn accepts_new_and_forward_snapshots() {
        let mut next = fixture();
        assert_eq!(decide_restore(None, &next), RestoreDecision::AllowNewDataset);
        let previous = next.identity.clone();
        next.identity.history.push(Uuid::new_v4());
        next.identity.revision = 2;
        assert_eq!(decide_restore(Some(&previous), &next), RestoreDecision::AllowForward);
    }

    #[test]
    fn rejects_stale_divergent_and_different_datasets() {
        let current = fixture();
        let mut incoming = current.clone();
        assert_eq!(decide_restore(Some(&current.identity), &incoming), RestoreDecision::AlreadyCurrent);
        incoming.identity.dataset_id = Uuid::new_v4();
        assert_eq!(decide_restore(Some(&current.identity), &incoming), RestoreDecision::RejectDifferentDataset);
        incoming = current.clone();
        incoming.identity.history[0] = Uuid::new_v4();
        assert_eq!(decide_restore(Some(&current.identity), &incoming), RestoreDecision::RejectDiverged);
        incoming = current.clone();
        incoming.identity.history.push(Uuid::new_v4());
        incoming.identity.revision = 2;
        assert_eq!(decide_restore(Some(&incoming.identity), &current), RestoreDecision::RejectStale);
    }

    #[test]
    fn rejects_legacy_schema_and_inconsistent_net_amount() {
        let mut snapshot = fixture();
        snapshot.identity.schema_version = 1;
        assert!(!validate_snapshot(&snapshot));
        let mut snapshot = fixture();
        snapshot.income[0].net_krw = 396_401;
        assert!(!validate_snapshot(&snapshot));
        let mut snapshot = fixture();
        snapshot.income[0].deductions.push(IncomeDeduction { kind: DeductionKind::Other, amount_krw: i64::MAX });
        assert!(!validate_snapshot(&snapshot));
    }

    #[test]
    fn rejects_invalid_records_and_unsupported_versions() {
        let mut snapshot = fixture();
        snapshot.income[0].earned_on = "2026-02-30".into();
        assert_eq!(decide_restore(None, &snapshot), RestoreDecision::RejectInvalid);
        snapshot = fixture();
        snapshot.identity.schema_version = 99;
        assert_eq!(decide_restore(None, &snapshot), RestoreDecision::RejectInvalid);
        snapshot = fixture();
        snapshot.income[0].deductions[0].amount_krw = 400_001;
        assert_eq!(decide_restore(None, &snapshot), RestoreDecision::RejectInvalid);
    }
}
