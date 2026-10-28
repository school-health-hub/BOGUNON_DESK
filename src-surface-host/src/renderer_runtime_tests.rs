use crate::renderer_runtime::{NavigationResult, RendererRuntimeState, RendererSignal};

#[test]
fn renderer_ready_is_latched_but_requires_successful_navigation_to_pass() {
    let state = RendererRuntimeState::new();
    assert_eq!(state.signal(), RendererSignal::WaitingForNavigation);
    assert!(state.mark_ready());
    assert!(!state.mark_ready());
    assert_eq!(state.signal(), RendererSignal::WaitingForNavigation);

    state.finish_navigation(NavigationResult::Succeeded);
    assert_eq!(state.signal(), RendererSignal::Ready);
}

#[test]
fn navigation_failure_can_never_become_renderer_ready() {
    let state = RendererRuntimeState::new();
    state.finish_navigation(NavigationResult::Failed);
    assert!(state.mark_ready());
    assert_eq!(state.signal(), RendererSignal::NavigationFailed);
}
