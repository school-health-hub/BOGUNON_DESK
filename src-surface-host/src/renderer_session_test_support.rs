use crate::{
    cleanup::{BrowserExitEvidence, RuntimeIdentity},
    lifecycle::Attempt,
    ownership::Ledger,
    renderer_session::{
        HandlerAddFailure, HandlerKind, HandlerRegistry, HandlerToken, RendererSession,
        RendererSessionError, SessionCleanup, SessionOwnership,
    },
    udf::DirectoryIdentity,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AddScenario {
    NativeAddFailed,
    RollbackSucceeded,
    RollbackFailed,
    RollbackPanicked,
    RollbackUnknown,
}

#[derive(Default)]
pub(crate) struct FakeRegistry {
    pub(crate) adds: Vec<HandlerKind>,
    pub(crate) removes: Vec<HandlerKind>,
    pub(crate) add_scenario: Option<(HandlerKind, AddScenario)>,
    pub(crate) panic_on_add: Option<HandlerKind>,
    pub(crate) panic_on_remove: Option<HandlerKind>,
    pub(crate) remove_failure: Option<HandlerKind>,
    pub(crate) rollback_attempts: usize,
    pub(crate) rollback_successes: usize,
}

impl HandlerRegistry for FakeRegistry {
    type RemoveError = ();

    fn add(&mut self, handler: HandlerKind) -> Result<HandlerToken, HandlerAddFailure> {
        self.adds.push(handler);
        if self.panic_on_add == Some(handler) {
            panic!("injected native add panic");
        }
        if let Some((failed, scenario)) = self.add_scenario {
            if failed == handler {
                return match scenario {
                    AddScenario::NativeAddFailed => Err(HandlerAddFailure::RolledBack),
                    AddScenario::RollbackSucceeded => {
                        self.rollback_attempts += 1;
                        self.rollback_successes += 1;
                        Err(HandlerAddFailure::RolledBack)
                    }
                    AddScenario::RollbackFailed | AddScenario::RollbackUnknown => {
                        self.rollback_attempts += 1;
                        Err(HandlerAddFailure::Unresolved)
                    }
                    AddScenario::RollbackPanicked => {
                        self.rollback_attempts += 1;
                        panic!("injected native rollback panic");
                    }
                };
            }
        }
        Ok(HandlerToken(self.adds.len() as u64))
    }

    fn remove(
        &mut self,
        handler: HandlerKind,
        _token: HandlerToken,
    ) -> Result<(), Self::RemoveError> {
        self.removes.push(handler);
        if self.panic_on_remove == Some(handler) {
            panic!("injected native remove panic");
        }
        if self.remove_failure == Some(handler) {
            Err(())
        } else {
            Ok(())
        }
    }
}

#[test]
fn rollback_outcomes_match_the_registry_contract() {
    let cases = [
        (
            AddScenario::NativeAddFailed,
            RendererSessionError::NativeAddRolledBack,
            0,
            0,
        ),
        (
            AddScenario::RollbackSucceeded,
            RendererSessionError::NativeAddRolledBack,
            1,
            1,
        ),
        (
            AddScenario::RollbackFailed,
            RendererSessionError::NativeAddUnresolved,
            1,
            0,
        ),
        (
            AddScenario::RollbackPanicked,
            RendererSessionError::NativeAddPanicked,
            1,
            0,
        ),
        (
            AddScenario::RollbackUnknown,
            RendererSessionError::NativeAddUnresolved,
            1,
            0,
        ),
    ];
    for (scenario, expected, attempts, successes) in cases {
        let registry = FakeRegistry {
            add_scenario: Some((HandlerKind::FrameCreated, scenario)),
            ..FakeRegistry::default()
        };
        let (mut session, ledger) = fixture(registry);
        assert_eq!(session.register(HandlerKind::FrameCreated), Err(expected));
        assert_eq!(session.registry().rollback_attempts, attempts);
        assert_eq!(session.registry().rollback_successes, successes);
        let rollback_is_confirmed = matches!(
            scenario,
            AddScenario::NativeAddFailed | AddScenario::RollbackSucceeded
        );
        let expected_cleanup = if rollback_is_confirmed {
            SessionCleanup::Released
        } else {
            SessionCleanup::Unresolved
        };
        assert_eq!(session.cleanup(), Ok(expected_cleanup));
        assert_eq!(ledger.is_resolved(), rollback_is_confirmed);
    }
}

pub(crate) fn attempt() -> Attempt {
    Attempt::new(7, 11).unwrap_or_else(|| panic!("fixture identity must be non-zero"))
}

pub(crate) fn fixture(registry: FakeRegistry) -> (RendererSession<FakeRegistry>, Ledger) {
    let attempt = attempt();
    let mut ledger = Ledger::new(attempt);
    let session = RendererSession::begin(registry, &mut ledger, SessionOwnership::new(attempt, 23))
        .unwrap_or_else(|error| panic!("fixture session must begin: {error}"));
    (session, ledger)
}

pub(crate) fn handlers() -> [HandlerKind; 6] {
    [
        HandlerKind::NavigationStarting,
        HandlerKind::NavigationCompleted,
        HandlerKind::NewWindowRequested,
        HandlerKind::FrameCreated,
        HandlerKind::WebMessageReceived,
        HandlerKind::WebResourceResponseReceived,
    ]
}

pub(crate) fn register(session: &mut RendererSession<FakeRegistry>, handlers: &[HandlerKind]) {
    for handler in handlers {
        assert_eq!(session.register(*handler), Ok(()));
    }
}

pub(crate) fn runtime(ledger: &mut Ledger) -> (RuntimeIdentity, BrowserExitEvidence) {
    let attempt = attempt();
    let launch = crate::runtime_qa::RuntimeLaunchAuthority::for_test();
    (
        RuntimeIdentity::bind(
            ledger,
            &launch,
            attempt,
            31,
            41,
            DirectoryIdentity { volume: 1, file: 2 },
        )
        .unwrap_or_else(|error| panic!("runtime authority must bind: {error}")),
        BrowserExitEvidence {
            attempt,
            environment: 31,
            browser_process_id: 41,
            normal_exit: true,
        },
    )
}
