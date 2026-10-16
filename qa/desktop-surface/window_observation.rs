use crate::{observation::*, window_lifecycle::WindowError};

pub fn unchanged<Q: ReadQueries>(
    queries: &Q,
    before: &ObservedWindow,
    after: &ObservedWindow,
) -> Result<(), WindowError> {
    let equal = before.identity == after.identity
        && before.parent == after.parent
        && before.owner == after.owner
        && before.style == after.style
        && before.extended_style == after.extended_style
        && before.placement == after.placement
        && before.screen == after.screen
        && before.client == after.client
        && before.visible == after.visible
        && before.minimized == after.minimized
        && before.maximized == after.maximized
        && before.monitor == after.monitor
        && before.dpi == after.dpi
        && queries.dpi_equal(before.context, after.context)
        && queries.dpi_equal(before.caller_context, after.caller_context);
    if equal {
        Ok(())
    } else {
        Err(WindowError::Observation)
    }
}
pub fn relations(windows: &[ObservedWindow]) -> Result<(), WindowError> {
    let [root, owned, child] = windows else {
        return Err(WindowError::Observation);
    };
    if !matches!(root.parent, Parent::DesktopRoot(_))
        || root.owner.is_some()
        || !matches!(owned.parent, Parent::DesktopRoot(_))
        || owned.owner.as_ref() != Some(&root.identity)
        || child.parent != Parent::Child(root.identity.clone())
        || child.owner.is_some()
        || windows.iter().any(|w| {
            w.visible
                || w.minimized
                || w.maximized
                || w.dpi == 0
                || w.identity.process != root.identity.process
                || w.identity.thread != root.identity.thread
                || w.client.0 != 0
                || w.client.1 != 0
                || w.client.2 <= 0
                || w.client.3 <= 0
        })
    {
        return Err(WindowError::Observation);
    }
    Ok(())
}
