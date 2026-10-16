//! Bounded, expiring, single-use restore tickets. No paths/passwords in IPC output.
use crate::my_finance_snapshot::{FinanceSnapshot, RestoreDecision};
use crate::my_finance_store::{restore_decision, FinanceStore};
use serde::Serialize;
use std::{
    io::{Read, Write},
    path::Path,
    time::{Duration, Instant},
};
use uuid::Uuid;
use zeroize::Zeroizing;

const EXPIRED: &str = "백업 검사 세션이 만료되었습니다. 파일을 다시 선택해 주세요.";
const FILE_ERROR: &str =
    "백업 파일을 읽거나 저장하지 못했습니다. 파일과 저장 위치를 확인해 주세요.";
const TTL: Duration = Duration::from_secs(300);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RestorePreview {
    pub token: Uuid,
    pub eligible: bool,
    pub reason: &'static str,
    pub requires_dataset_confirmation: bool,
    pub current_dataset_id: Uuid,
    pub backup_dataset_id: Uuid,
    pub current_revision: u64,
    pub backup_revision: u64,
    pub record_count: usize,
}

struct Ticket {
    token: Uuid,
    expires: Instant,
    encrypted: Vec<u8>,
    prepared: Option<(Zeroizing<Vec<u8>>, Zeroizing<Vec<u8>>)>,
}
#[derive(Default)]
pub(crate) struct TransferSession(Option<Ticket>);

impl TransferSession {
    pub(crate) fn cancel(&mut self) {
        self.0 = None;
    }
    pub(crate) fn cancel_ticket(&mut self, token: Uuid) {
        if self.0.as_ref().is_some_and(|ticket| ticket.token == token) {
            self.cancel();
        }
    }
    pub(crate) fn select(&mut self, encrypted: Vec<u8>) -> Result<Uuid, &'static str> {
        self.cancel();
        if encrypted.len() > crate::my_finance_backup::MAX_BACKUP {
            return Err(FILE_ERROR);
        }
        let token = Uuid::new_v4();
        self.0 = Some(Ticket {
            token,
            expires: Instant::now() + TTL,
            encrypted,
            prepared: None,
        });
        Ok(token)
    }
    pub(crate) fn inspect(
        &mut self,
        token: Uuid,
        password: &str,
        current: &FinanceSnapshot,
    ) -> Result<RestorePreview, &'static str> {
        self.check(token)?;
        let ticket = self.0.as_mut().ok_or(EXPIRED)?;
        ticket.prepared = None;
        let (incoming, _) = crate::my_finance_codec::inspect_restore(
            &ticket.encrypted,
            password,
            Some(&current.identity),
        )?;
        let decision = restore_decision(current, &incoming);
        let requires_dataset_confirmation = decision == RestoreDecision::AllowNewDataset;
        let eligible = matches!(
            decision,
            RestoreDecision::AllowForward | RestoreDecision::AllowNewDataset
        );
        let reason = match decision {
            RestoreDecision::AllowNewDataset => "사용 이력이 없는 빈 저장소입니다. 백업의 데이터셋으로 변경하는 최초 이식이 가능합니다.",
            RestoreDecision::AllowForward => {
                "같은 데이터셋의 후속 백업입니다. 최종 확인 후 복원할 수 있습니다."
            }
            RestoreDecision::AlreadyCurrent => {
                "현재 데이터와 같습니다. 복원할 변경 사항이 없습니다."
            }
            RestoreDecision::RejectStale => "현재 데이터보다 오래된 백업이므로 복원할 수 없습니다.",
            RestoreDecision::RejectDifferentDataset => {
                "다른 데이터셋의 백업이므로 복원할 수 없습니다."
            }
            RestoreDecision::RejectDiverged => {
                "변경 이력 또는 내용이 충돌하므로 복원할 수 없습니다."
            }
            _ => "지원하지 않는 버전이거나 유효하지 않은 백업입니다.",
        };
        let preview = RestorePreview {
            token,
            eligible,
            reason,
            requires_dataset_confirmation,
            current_dataset_id: current.identity.dataset_id,
            backup_dataset_id: incoming.identity.dataset_id,
            current_revision: current.identity.revision,
            backup_revision: incoming.identity.revision,
            record_count: incoming.income.len(),
        };
        if eligible {
            let payload = Zeroizing::new(serde_json::to_vec(&incoming).map_err(|_| FILE_ERROR)?);
            // Retain only a zeroizing serialized payload and an exact pre-image.
            let preimage = Zeroizing::new(serde_json::to_vec(current).map_err(|_| FILE_ERROR)?);
            ticket.prepared = Some((preimage, payload));
        }
        Ok(preview)
    }
    pub(crate) fn commit(
        &mut self,
        token: Uuid,
        store: &mut FinanceStore,
    ) -> Result<FinanceSnapshot, &'static str> {
        self.commit_confirmed(token, store, false)
    }
    pub(crate) fn commit_confirmed(
        &mut self,
        token: Uuid,
        store: &mut FinanceStore,
        confirm_dataset_change: bool,
    ) -> Result<FinanceSnapshot, &'static str> {
        self.check(token)?;
        // Consume even on failure: never retry an uncertain restore automatically.
        let mut ticket = self.0.take().ok_or(EXPIRED)?;
        let (expected, payload) = ticket.prepared.take().ok_or(EXPIRED)?;
        let expected: FinanceSnapshot =
            serde_json::from_slice(&expected).map_err(|_| FILE_ERROR)?;
        if store.load()? != expected {
            return Err("금융 데이터가 변경되었습니다. 최신 목록을 다시 불러와 주세요.");
        }
        let incoming = serde_json::from_slice(&payload).map_err(|_| FILE_ERROR)?;
        store.restore_confirmed(&expected, incoming, confirm_dataset_change)
    }
    fn check(&mut self, token: Uuid) -> Result<(), &'static str> {
        if self
            .0
            .as_ref()
            .is_some_and(|ticket| Instant::now() >= ticket.expires)
        {
            self.cancel();
        }
        if self.0.as_ref().is_some_and(|ticket| ticket.token == token) {
            Ok(())
        } else {
            Err(EXPIRED)
        }
    }
}

pub(crate) fn read_backup(path: &Path) -> Result<Vec<u8>, &'static str> {
    let file = std::fs::File::open(path).map_err(|_| FILE_ERROR)?;
    let metadata = file.metadata().map_err(|_| FILE_ERROR)?;
    if !metadata.is_file() || metadata.len() > crate::my_finance_backup::MAX_BACKUP as u64 {
        return Err(FILE_ERROR);
    }
    let mut encrypted = Vec::new();
    file.take(crate::my_finance_backup::MAX_BACKUP as u64 + 1)
        .read_to_end(&mut encrypted)
        .map_err(|_| FILE_ERROR)?;
    if encrypted.len() > crate::my_finance_backup::MAX_BACKUP {
        return Err(FILE_ERROR);
    }
    Ok(encrypted)
}

/// Only ciphertext touches the filesystem. Never replace an existing file,
/// including the live DB/key or another backup, even after a dialog race.
pub(crate) fn write_backup(path: &Path, encrypted: &[u8]) -> Result<(), &'static str> {
    let parent = path.parent().ok_or(FILE_ERROR)?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|_| FILE_ERROR)?;
    temp.write_all(encrypted).map_err(|_| FILE_ERROR)?;
    temp.as_file().sync_all().map_err(|_| FILE_ERROR)?;
    temp.persist_noclobber(path)
        .map_err(|_| "이미 있는 파일은 덮어쓰지 않습니다. 새 파일명을 선택해 주세요.")?;
    Ok(())
}

#[cfg(test)]
#[path = "my_finance_transfer_tests.rs"]
mod tests;
