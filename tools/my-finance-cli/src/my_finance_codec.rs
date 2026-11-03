//! Serialized snapshot codec. The only valid payload for the encrypted backup
//! envelope is a validated FinanceSnapshot. No filesystem access here.
use super::{
    my_finance_backup,
    my_finance_snapshot::{self, FinanceSnapshot, RestoreDecision, SnapshotIdentity},
};
use zeroize::Zeroizing;

pub(crate) fn export_snapshot(
    snapshot: &FinanceSnapshot,
    password: &str,
) -> Result<Vec<u8>, &'static str> {
    if !my_finance_snapshot::validate_snapshot(snapshot) {
        return Err("백업할 금융 데이터가 올바르지 않습니다.");
    }
    let payload = Zeroizing::new(
        serde_json::to_vec(snapshot).map_err(|_| "백업 데이터를 직렬화하지 못했습니다.")?,
    );
    my_finance_backup::seal(&payload, password)
}

/// Decrypt and validate before inspecting lineage. This never mutates local
/// data; caller must stage, snapshot, and atomically restore separately.
pub(crate) fn inspect_restore(
    encrypted: &[u8],
    password: &str,
    current: Option<&SnapshotIdentity>,
) -> Result<(FinanceSnapshot, RestoreDecision), &'static str> {
    let plaintext = Zeroizing::new(my_finance_backup::open(encrypted, password)?);
    let snapshot: FinanceSnapshot =
        serde_json::from_slice(&plaintext).map_err(|_| "백업 데이터 구조가 올바르지 않습니다.")?;
    let decision = my_finance_snapshot::decide_restore(current, &snapshot);
    Ok((snapshot, decision))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::my_finance_snapshot::{
        DeductionKind, IncomeDeduction, IncomeEntry, IncomeKind, SnapshotIdentity, TaxCategory,
        SNAPSHOT_SCHEMA_VERSION,
    };
    use uuid::Uuid;

    fn snapshot() -> FinanceSnapshot {
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
                paid_on: Some("2026-10-15".into()),
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
            phase2: crate::my_finance_snapshot::Phase2Data::default(),
        }
    }

    #[test]
    fn roundtrip_and_restore_inspection() {
        let source = snapshot();
        let backup = export_snapshot(&source, "long-test-password-123").unwrap();
        let (decoded, decision) = inspect_restore(&backup, "long-test-password-123", None).unwrap();
        assert_eq!(decoded, source);
        assert_eq!(decision, RestoreDecision::AllowNewDataset);
    }

    #[test]
    fn legacy_schema_is_rejected_without_implicit_migration() {
        let mut legacy = snapshot();
        legacy.identity.schema_version = 1;
        assert!(export_snapshot(&legacy, "long-test-password-123").is_err());
    }

    #[test]
    fn wrong_password_does_not_produce_a_snapshot() {
        let backup = export_snapshot(&snapshot(), "long-test-password-123").unwrap();
        assert!(inspect_restore(&backup, "wrong-password-123", None).is_err());
    }

    #[test]
    fn rejects_invalid_snapshot_before_encryption() {
        let mut source = snapshot();
        source.income[0].deductions[0].amount_krw = 999_999;
        assert!(export_snapshot(&source, "long-test-password-123").is_err());
    }

    #[test]
    fn returns_conflict_without_changing_current_snapshot() {
        let source = snapshot();
        let mut other = source.clone();
        other.identity.history[0] = Uuid::new_v4();
        let backup = export_snapshot(&other, "long-test-password-123").unwrap();
        let (_, decision) =
            inspect_restore(&backup, "long-test-password-123", Some(&source.identity)).unwrap();
        assert_eq!(decision, RestoreDecision::RejectDiverged);
        assert_eq!(source.identity.revision, 1);
    }
}
