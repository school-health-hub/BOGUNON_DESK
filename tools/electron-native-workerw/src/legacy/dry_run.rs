use super::{
    admission::{Context, HostTransaction},
    machine::Progress,
    mock::Mock,
    model::{self, OperationId},
};
use crate::lifecycle::Attempt;
use serde::{Deserialize, Serialize};

/// Internal Host binding after authentication. Synthetic window ID is never an OS HWND.
pub struct DryRunBinding {
    pub generation: u64,
    pub attempt: u64,
    pub host_pid: u32,
    pub host_created: u64,
    pub explorer_pid: u32,
    pub explorer_created: u64,
    pub model_window: u64,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DryRunOperation {
    Prepare,
    Attach,
    Detach,
    Cancel,
    HostLostFixture,
    ReturnNormal,
}
pub struct DryRunRequest {
    pub sequence: u64,
    pub host_pid: u32,
    pub model_window: u64,
    pub explorer_created: u64,
    pub operation: DryRunOperation,
}
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DryRunReport {
    pub scope: &'static str,
    pub sequence: u64,
    pub accepted: bool,
    pub state: &'static str,
    pub cleanup: &'static str,
    pub error: Option<&'static str>,
    pub actual_attachment_verified: bool,
}
pub struct DryRunEngine {
    tx: HostTransaction,
    mock: Mock,
    binding: Context,
}
impl DryRunEngine {
    pub fn new(b: DryRunBinding) -> Result<Self, &'static str> {
        let mut mock = Mock::default();
        let owner = model::WindowIdentity {
            handle: b.model_window,
            process: model::ProcessIdentity {
                pid: b.host_pid,
                creation_time: b.host_created,
                verified_image: 1,
            },
            thread: 1,
            generation: b.generation,
        };
        let explorer = model::ProcessIdentity {
            pid: b.explorer_pid,
            creation_time: b.explorer_created,
            verified_image: 2,
        };
        mock.original.window.main = owner;
        mock.original.window.owner = None;
        mock.original.window.z_order_anchor = None;
        mock.original.explorer = explorer;
        mock.original.worker.process = explorer;
        mock.current = mock.original.window.clone();
        mock.explorer = explorer;
        mock.worker = mock.original.worker;
        let binding = Context {
            attempt: Attempt {
                generation: b.generation,
                nonce: b.attempt,
            },
            owner,
            explorer,
            sequence: 1,
        };
        let tx = HostTransaction::new(binding).map_err(|_| "BindingRejected")?;
        Ok(Self { tx, mock, binding })
    }
    fn drive(&mut self, id: OperationId) -> Result<(), &'static str> {
        for _ in 0..32 {
            if self.tx.step(id, &mut self.mock) == Progress::Finished {
                return Ok(());
            }
        }
        self.tx.host_lost();
        Err("ProgressUnknown")
    }
    pub fn dispatch(&mut self, r: DryRunRequest) -> DryRunReport {
        let result = self.apply(&r);
        DryRunReport {
            scope: "DryRun",
            sequence: r.sequence,
            accepted: result.is_ok(),
            state: self.tx.state(),
            cleanup: if self.tx.state() == "CleanupUnknown" {
                "CleanupUnknown"
            } else {
                "NotVerified"
            },
            error: result.err(),
            actual_attachment_verified: false,
        }
    }
    fn apply(&mut self, r: &DryRunRequest) -> Result<(), &'static str> {
        let c = Context {
            sequence: r.sequence,
            owner: model::WindowIdentity {
                handle: r.model_window,
                process: model::ProcessIdentity {
                    pid: r.host_pid,
                    ..self.binding.owner.process
                },
                ..self.binding.owner
            },
            explorer: model::ProcessIdentity {
                creation_time: r.explorer_created,
                ..self.binding.explorer
            },
            ..self.binding
        };
        match r.operation {
            DryRunOperation::Prepare | DryRunOperation::Attach => {
                let id = self.tx.attach(c).map_err(rejection)?;
                if matches!(r.operation, DryRunOperation::Prepare) {
                    self.tx.step(id, &mut self.mock);
                    self.tx.step(id, &mut self.mock);
                    Ok(())
                } else {
                    self.drive(id)
                }
            }
            DryRunOperation::Cancel | DryRunOperation::Detach => {
                let id = self.tx.detach(c).map_err(rejection)?;
                self.drive(id)
            }
            DryRunOperation::HostLostFixture => self.tx.host_lost_request(c).map_err(rejection),
            DryRunOperation::ReturnNormal => {
                let id = self.tx.detach(c).map_err(rejection)?;
                self.drive(id)
            }
        }
    }
    pub fn connection_closed(&mut self) {
        self.tx.host_lost();
    }
}
fn rejection(error: super::admission::Rejection) -> &'static str {
    use super::admission::Rejection::*;
    match error {
        Session => "Session",
        Owner => "Owner",
        Explorer => "Explorer",
        Replay => "Replay",
        Retired => "Retired",
        Busy => "Busy",
        CleanupUnknown => "CleanupUnknown",
        Ownership => "Ownership",
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn engine() -> DryRunEngine {
        DryRunEngine::new(DryRunBinding {
            generation: 1,
            attempt: 2,
            host_pid: 10,
            host_created: 20,
            explorer_pid: 30,
            explorer_created: 40,
            model_window: 901,
        })
        .unwrap()
    }
    fn req(sequence: u64, operation: DryRunOperation) -> DryRunRequest {
        DryRunRequest {
            sequence,
            host_pid: 10,
            model_window: 901,
            explorer_created: 40,
            operation,
        }
    }
    #[test]
    fn authentic_host_bridge_reaches_existing_workerw_model_without_live_claim() {
        let mut e = engine();
        let r = e.dispatch(req(1, DryRunOperation::Attach));
        assert!(r.accepted);
        assert_eq!(r.state, "ModelAttached");
        assert!(!r.actual_attachment_verified);
        assert!(!e.dispatch(req(2, DryRunOperation::Attach)).accepted);
        let r = e.dispatch(req(3, DryRunOperation::Detach));
        assert!(r.accepted);
        assert_eq!(r.cleanup, "NotVerified");
        assert!(!e.dispatch(req(4, DryRunOperation::Attach)).accepted);
    }
    #[test]
    fn cancel_and_unknown_are_terminal() {
        for unknown in [false, true] {
            let mut e = engine();
            assert!(e.dispatch(req(1, DryRunOperation::Prepare)).accepted);
            let r = e.dispatch(req(
                2,
                if unknown {
                    DryRunOperation::HostLostFixture
                } else {
                    DryRunOperation::Cancel
                },
            ));
            assert!(r.accepted);
            assert!(!e.dispatch(req(3, DryRunOperation::Attach)).accepted);
        }
    }
    #[test]
    fn foreign_window_and_replay_never_reach_mutations() {
        let mut e = engine();
        let mut r = req(1, DryRunOperation::Attach);
        r.model_window = 902;
        assert_eq!(e.dispatch(r).error, Some("Owner"));
        assert!(e.dispatch(req(1, DryRunOperation::Attach)).accepted);
        assert_eq!(
            e.dispatch(req(1, DryRunOperation::Detach)).error,
            Some("Replay")
        );
    }
}

#[cfg(test)]
mod connection_tests {
    use super::*;
    #[test]
    fn connection_loss_is_sticky_and_identity_mismatch_cannot_cancel() {
        let mut e = DryRunEngine::new(DryRunBinding {
            generation: 1,
            attempt: 2,
            host_pid: 10,
            host_created: 20,
            explorer_pid: 30,
            explorer_created: 40,
            model_window: 901,
        })
        .unwrap();
        let req = |sequence, operation| DryRunRequest {
            sequence,
            operation,
            host_pid: 10,
            model_window: 901,
            explorer_created: 40,
        };
        assert!(e.dispatch(req(1, DryRunOperation::Prepare)).accepted);
        let mut bad = req(2, DryRunOperation::Cancel);
        bad.host_pid = 11;
        assert_eq!(e.dispatch(bad).error, Some("Owner"));
        let mut bad = req(2, DryRunOperation::Cancel);
        bad.explorer_created = 41;
        assert_eq!(e.dispatch(bad).error, Some("Explorer"));
        assert!(e.dispatch(req(2, DryRunOperation::ReturnNormal)).accepted);
        assert!(!e.dispatch(req(3, DryRunOperation::Attach)).accepted);
        e.connection_closed();
        assert_eq!(
            e.dispatch(req(4, DryRunOperation::ReturnNormal)).error,
            Some("CleanupUnknown")
        );
    }
}
