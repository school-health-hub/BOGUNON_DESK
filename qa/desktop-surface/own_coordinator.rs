use crate::disposable_surface::{Completion, Support};
use crate::own_result::{Counters, Error};
use crate::surface_event_router::Router;
use crate::surface_event_types::{Action, Binding, Event, MainState, RouteError};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NoticeKind {
    Created,
    Destroyed,
    CloseRequested,
}
#[derive(Debug, Clone)]
pub struct Notice {
    pub binding: Binding,
    pub kind: NoticeKind,
}

pub trait Driver {
    fn create(&mut self, binding: &Binding) -> Result<(), Error>;
    fn observe(&mut self) -> Result<(), Error>;
    fn drain(&mut self) -> Result<Vec<Notice>, Error>;
    fn dispose(&mut self, binding: &Binding) -> Result<(), Error>;
    fn cleanup(&mut self) -> Result<(), Error>;
    fn remaining(&self) -> Option<u32>;
}

pub fn run(driver: &mut impl Driver) -> Result<Counters, Error> {
    let main = MainState::new(1, 2, String::from("synthetic-unsaved-note"));
    let before = main.projection();
    let mut router = Router::new(before, 1);
    let binding = router
        .create(Support::Supported)
        .map_err(|_| Error::Model)?;
    if let Err(error) = driver.create(&binding) {
        router
            .created(&binding, Completion::Failed)
            .map_err(|_| Error::Model)?;
        return Err(error);
    }
    let mut counters = Counters {
        created: 0,
        destroyed: 0,
        rejected: 0,
        main_unchanged: false,
    };
    require_notice(driver.drain()?, &binding, NoticeKind::Created)?;
    router
        .created(&binding, Completion::Succeeded)
        .map_err(|_| Error::Model)?;
    counters.created += 1;
    let observation = driver.observe();
    observed(&mut router, &binding, driver.drain()?)?;
    observation?;
    if router.projection(&binding).map_err(|_| Error::Model)? != &before {
        return Err(Error::Main);
    }
    let event = Event {
        binding: binding.clone(),
        sequence: 1,
        action: Action::RefreshProjection,
    };
    let request = router.accept(event.clone()).map_err(|_| Error::Model)?;
    if request.sequence() != 1 || request.revision() != before.revision() {
        return Err(Error::Model);
    }
    match router.accept(event) {
        Err(RouteError::Sequence) => counters.rejected += 1,
        Ok(_) | Err(_) => return Err(Error::Model),
    }
    let disposal = router.dispose().map_err(|_| Error::Model)?;
    if let Err(error) = driver.dispose(&disposal) {
        router
            .disposed(&disposal, Completion::Failed)
            .map_err(|_| Error::Model)?;
        return Err(error);
    }
    require_notice(driver.drain()?, &disposal, NoticeKind::Destroyed)?;
    router
        .disposed(&disposal, Completion::Succeeded)
        .map_err(|_| Error::Model)?;
    counters.destroyed += 1;
    counters.main_unchanged =
        main.projection() == before && main.unsaved_note() == "synthetic-unsaved-note";
    if !counters.main_unchanged {
        return Err(Error::Main);
    }
    Ok(counters)
}

pub(crate) fn observed(
    router: &mut Router,
    binding: &Binding,
    notices: Vec<Notice>,
) -> Result<(), Error> {
    match notices.as_slice() {
        [] => Ok(()),
        [Notice {
            binding: origin,
            kind: NoticeKind::Destroyed,
        }] if origin == binding => {
            router.lost(origin).map_err(|_| Error::Callback)?;
            Err(Error::Native)
        }
        _ => Err(Error::Callback),
    }
}

fn require_notice(notices: Vec<Notice>, binding: &Binding, kind: NoticeKind) -> Result<(), Error> {
    let mut found = false;
    for notice in notices {
        if notice.binding != *binding || notice.kind != kind || found {
            return Err(Error::Callback);
        }
        found = true;
    }
    if found {
        Ok(())
    } else {
        Err(Error::Callback)
    }
}
