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
pub(crate) enum IncomeKind {
    Salary,
    Consulting,
    Ebook,
    Lecture,
    Other,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TaxCategory {
    Unverified,
    Employment,
    Business,
    OtherIncome,
    Royalty,
    NonTaxable,
    Unknown,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum DeductionKind {
    IncomeTax,
    LocalIncomeTax,
    EmploymentInsurance,
    PlatformFee,
    Other,
}

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
    #[serde(default)]
    pub phase2: Phase2Data,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Phase2Data {
    #[serde(default)]
    pub investment_accounts: Vec<InvestmentAccount>,
    #[serde(default)]
    pub instruments: Vec<InvestmentInstrument>,
    #[serde(default)]
    pub trades: Vec<InvestmentTrade>,
    #[serde(default)]
    pub dividends: Vec<DividendEntry>,
    #[serde(default)]
    pub asset_balances: Vec<AssetBalance>,
    #[serde(default)]
    pub liabilities: Vec<LiabilityBalance>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Market {
    Kr,
    Us,
    Other,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum InstrumentKind {
    Stock,
    Etf,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TradeKind {
    Buy,
    Sell,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum AssetKind {
    Cash,
    Deposit,
    Savings,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct InvestmentAccount {
    pub id: Uuid,
    pub name: String,
    pub market: Market,
    pub currency: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct InvestmentInstrument {
    pub id: Uuid,
    pub account_id: Uuid,
    pub symbol: String,
    pub name: String,
    pub kind: InstrumentKind,
    pub currency: String,
    pub market_price_minor: i64,
    pub valuation_exchange_rate_micros: i64,
    pub valued_on: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct InvestmentTrade {
    pub id: Uuid,
    pub instrument_id: Uuid,
    pub kind: TradeKind,
    pub traded_on: String,
    pub quantity_micros: i64,
    pub unit_price_minor: i64,
    pub exchange_rate_micros: i64,
    pub fees_krw: i64,
    pub taxes_krw: i64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DividendEntry {
    pub id: Uuid,
    pub instrument_id: Uuid,
    pub paid_on: String,
    pub gross_minor: i64,
    pub currency: String,
    pub exchange_rate_micros: i64,
    pub withholding_krw: i64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AssetBalance {
    pub id: Uuid,
    pub label: String,
    pub kind: AssetKind,
    pub currency: String,
    pub amount_minor: i64,
    pub exchange_rate_micros: i64,
    pub as_of: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct LiabilityBalance {
    pub id: Uuid,
    pub label: String,
    pub currency: String,
    pub amount_minor: i64,
    pub exchange_rate_micros: i64,
    pub as_of: String,
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
    if b.len() != 10
        || b[4] != b'-'
        || b[7] != b'-'
        || !b
            .iter()
            .enumerate()
            .all(|(i, x)| i == 4 || i == 7 || x.is_ascii_digit())
    {
        return false;
    }
    let Ok(year) = value[..4].parse::<u32>() else {
        return false;
    };
    let Ok(month) = value[5..7].parse::<u32>() else {
        return false;
    };
    let Ok(day) = value[8..10].parse::<u32>() else {
        return false;
    };
    if !(1900..=9999).contains(&year) || !(1..=12).contains(&month) {
        return false;
    }
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
        || !validate_phase2(&snapshot.phase2)
    {
        return false;
    }
    let mut changes = std::collections::HashSet::new();
    if !id.history.iter().all(|change| changes.insert(*change)) {
        return false;
    }
    let mut records = std::collections::HashSet::new();
    snapshot
        .income
        .iter()
        .all(|entry| records.insert(entry.id) && validate_income_entry(entry))
}

pub(crate) fn validate_phase2(data: &Phase2Data) -> bool {
    let total = data.investment_accounts.len()
        + data.instruments.len()
        + data.trades.len()
        + data.dividends.len()
        + data.asset_balances.len()
        + data.liabilities.len();
    if total > MAX_RECORDS {
        return false;
    }
    let valid_text = |value: &str, max: usize| !value.trim().is_empty() && value.len() <= max;
    let valid_currency =
        |value: &str| value.len() == 3 && value.bytes().all(|b| b.is_ascii_uppercase());
    let valid_money = |value: i64| value >= 0 && value <= 9_007_199_254_740_991;
    let mut ids = std::collections::HashSet::new();
    let accounts: std::collections::HashSet<_> =
        data.investment_accounts.iter().map(|x| x.id).collect();
    let instruments: std::collections::HashSet<_> = data.instruments.iter().map(|x| x.id).collect();
    let shape_valid = data.investment_accounts.iter().all(|x| {
        ids.insert(x.id)
            && !x.id.is_nil()
            && valid_text(&x.name, 200)
            && valid_currency(&x.currency)
    }) && data.instruments.iter().all(|x| {
        ids.insert(x.id)
            && !x.id.is_nil()
            && accounts.contains(&x.account_id)
            && valid_text(&x.symbol, 40)
            && valid_text(&x.name, 200)
            && valid_currency(&x.currency)
            && valid_money(x.market_price_minor)
            && x.valuation_exchange_rate_micros > 0
            && valid_iso_date(&x.valued_on)
    }) && data.trades.iter().all(|x| {
        ids.insert(x.id)
            && !x.id.is_nil()
            && instruments.contains(&x.instrument_id)
            && valid_iso_date(&x.traded_on)
            && x.quantity_micros > 0
            && valid_money(x.unit_price_minor)
            && x.exchange_rate_micros > 0
            && valid_money(x.fees_krw)
            && valid_money(x.taxes_krw)
    }) && data.dividends.iter().all(|x| {
        ids.insert(x.id)
            && !x.id.is_nil()
            && instruments.contains(&x.instrument_id)
            && valid_iso_date(&x.paid_on)
            && valid_money(x.gross_minor)
            && valid_currency(&x.currency)
            && x.exchange_rate_micros > 0
            && valid_money(x.withholding_krw)
    }) && data.asset_balances.iter().all(|x| {
        ids.insert(x.id)
            && !x.id.is_nil()
            && valid_text(&x.label, 200)
            && valid_currency(&x.currency)
            && valid_money(x.amount_minor)
            && x.exchange_rate_micros > 0
            && valid_iso_date(&x.as_of)
    }) && data.liabilities.iter().all(|x| {
        ids.insert(x.id)
            && !x.id.is_nil()
            && valid_text(&x.label, 200)
            && valid_currency(&x.currency)
            && valid_money(x.amount_minor)
            && x.exchange_rate_micros > 0
            && valid_iso_date(&x.as_of)
    });
    if !shape_valid {
        return false;
    }
    data.instruments.iter().all(|instrument| {
        let mut trades = data
            .trades
            .iter()
            .filter(|trade| trade.instrument_id == instrument.id)
            .collect::<Vec<_>>();
        trades.sort_by(|left, right| {
            left.traded_on
                .cmp(&right.traded_on)
                .then(left.id.cmp(&right.id))
        });
        trades
            .into_iter()
            .try_fold(0_i64, |quantity, trade| match trade.kind {
                TradeKind::Buy => quantity.checked_add(trade.quantity_micros),
                TradeKind::Sell if trade.quantity_micros <= quantity => {
                    quantity.checked_sub(trade.quantity_micros)
                }
                TradeKind::Sell => None,
            })
            .is_some()
    })
}

pub(crate) fn validate_income_entry(entry: &IncomeEntry) -> bool {
    !entry.id.is_nil()
        && !entry.source_name.trim().is_empty()
        && entry.source_name.len() <= 200
        && valid_iso_date(&entry.earned_on)
        && entry
            .paid_on
            .as_ref()
            .is_none_or(|date| valid_iso_date(date))
        && entry.gross_krw >= 0
        && entry.contract_label.len() <= 200
        && entry.notes.len() <= 5000
        && entry.deductions.len() <= 100
        && entry.deductions.iter().all(|d| d.amount_krw >= 0)
        && entry
            .deductions
            .iter()
            .try_fold(0_i64, |sum, d| sum.checked_add(d.amount_krw))
            .is_some_and(|sum| sum <= entry.gross_krw && entry.net_krw == entry.gross_krw - sum)
        && (!entry.tax_category_verified
            || !matches!(
                entry.tax_category,
                TaxCategory::Unverified | TaxCategory::Unknown
            ))
}

pub(crate) fn decide_restore(
    current: Option<&SnapshotIdentity>,
    incoming: &FinanceSnapshot,
) -> RestoreDecision {
    if !validate_snapshot(incoming) {
        return RestoreDecision::RejectInvalid;
    }
    let Some(local) = current else {
        return RestoreDecision::AllowNewDataset;
    };
    let remote = &incoming.identity;
    if local.schema_version != SNAPSHOT_SCHEMA_VERSION
        || local.dataset_id.is_nil()
        || local.revision == 0
        || local.history.len() != local.revision as usize
        || local.history.iter().any(Uuid::is_nil)
        || local
            .history
            .iter()
            .copied()
            .collect::<std::collections::HashSet<_>>()
            .len()
            != local.history.len()
    {
        return RestoreDecision::RejectInvalid;
    }
    if local.dataset_id != remote.dataset_id {
        return RestoreDecision::RejectDifferentDataset;
    }
    let shared = local.history.len().min(remote.history.len());
    if local.history[..shared] != remote.history[..shared] {
        return RestoreDecision::RejectDiverged;
    }
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
                deductions: vec![IncomeDeduction {
                    kind: DeductionKind::Other,
                    amount_krw: 3_600,
                }],
                net_krw: 396_400,
                notes: String::new(),
                tax_category: TaxCategory::Unverified,
                tax_category_verified: false,
            }],
            phase2: Phase2Data::default(),
        }
    }

    #[test]
    fn accepts_new_and_forward_snapshots() {
        let mut next = fixture();
        assert_eq!(
            decide_restore(None, &next),
            RestoreDecision::AllowNewDataset
        );
        let previous = next.identity.clone();
        next.identity.history.push(Uuid::new_v4());
        next.identity.revision = 2;
        assert_eq!(
            decide_restore(Some(&previous), &next),
            RestoreDecision::AllowForward
        );
    }

    #[test]
    fn rejects_stale_divergent_and_different_datasets() {
        let current = fixture();
        let mut incoming = current.clone();
        assert_eq!(
            decide_restore(Some(&current.identity), &incoming),
            RestoreDecision::AlreadyCurrent
        );
        incoming.identity.dataset_id = Uuid::new_v4();
        assert_eq!(
            decide_restore(Some(&current.identity), &incoming),
            RestoreDecision::RejectDifferentDataset
        );
        incoming = current.clone();
        incoming.identity.history[0] = Uuid::new_v4();
        assert_eq!(
            decide_restore(Some(&current.identity), &incoming),
            RestoreDecision::RejectDiverged
        );
        incoming = current.clone();
        incoming.identity.history.push(Uuid::new_v4());
        incoming.identity.revision = 2;
        assert_eq!(
            decide_restore(Some(&incoming.identity), &current),
            RestoreDecision::RejectStale
        );
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
        snapshot.income[0].deductions.push(IncomeDeduction {
            kind: DeductionKind::Other,
            amount_krw: i64::MAX,
        });
        assert!(!validate_snapshot(&snapshot));
    }

    #[test]
    fn rejects_invalid_records_and_unsupported_versions() {
        let mut snapshot = fixture();
        snapshot.income[0].earned_on = "2026-02-30".into();
        assert_eq!(
            decide_restore(None, &snapshot),
            RestoreDecision::RejectInvalid
        );
        snapshot = fixture();
        snapshot.identity.schema_version = 99;
        assert_eq!(
            decide_restore(None, &snapshot),
            RestoreDecision::RejectInvalid
        );
        snapshot = fixture();
        snapshot.income[0].deductions[0].amount_krw = 400_001;
        assert_eq!(
            decide_restore(None, &snapshot),
            RestoreDecision::RejectInvalid
        );
    }

    #[test]
    fn phase_one_snapshot_without_phase2_fields_migrates_additively() {
        let source = fixture();
        let mut value = serde_json::to_value(&source).unwrap();
        value.as_object_mut().unwrap().remove("phase2");
        let migrated: FinanceSnapshot = serde_json::from_value(value).unwrap();
        assert_eq!(migrated.income, source.income);
        assert_eq!(migrated.identity, source.identity);
        assert_eq!(migrated.phase2, Phase2Data::default());
        assert!(validate_snapshot(&migrated));
    }

    #[test]
    fn phase2_rejects_overselling_and_accepts_linked_synthetic_records() {
        let account_id = Uuid::new_v4();
        let instrument_id = Uuid::new_v4();
        let mut data = Phase2Data {
            investment_accounts: vec![InvestmentAccount {
                id: account_id,
                name: "Synthetic".into(),
                market: Market::Us,
                currency: "USD".into(),
            }],
            instruments: vec![InvestmentInstrument {
                id: instrument_id,
                account_id,
                symbol: "SYN".into(),
                name: "Synthetic ETF".into(),
                kind: InstrumentKind::Etf,
                currency: "USD".into(),
                market_price_minor: 12_000,
                valuation_exchange_rate_micros: 1_400_000_000,
                valued_on: "2026-10-20".into(),
            }],
            trades: vec![InvestmentTrade {
                id: Uuid::new_v4(),
                instrument_id,
                kind: TradeKind::Buy,
                traded_on: "2026-01-01".into(),
                quantity_micros: 1_000_000,
                unit_price_minor: 10_000,
                exchange_rate_micros: 1_300_000_000,
                fees_krw: 1_000,
                taxes_krw: 0,
            }],
            dividends: vec![],
            asset_balances: vec![],
            liabilities: vec![],
        };
        assert!(validate_phase2(&data));
        data.trades.push(InvestmentTrade {
            id: Uuid::new_v4(),
            instrument_id,
            kind: TradeKind::Sell,
            traded_on: "2026-02-01".into(),
            quantity_micros: 2_000_000,
            unit_price_minor: 11_000,
            exchange_rate_micros: 1_350_000_000,
            fees_krw: 1_000,
            taxes_krw: 2_000,
        });
        assert!(!validate_phase2(&data));
    }
}
