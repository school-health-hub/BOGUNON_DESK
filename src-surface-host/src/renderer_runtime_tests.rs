use crate::renderer_runtime::{NavigationResult, RendererRuntimeState, RendererSignal};

#[test]
fn renderer_ready_requires_successful_navigation_and_is_single_use() {
    let state = RendererRuntimeState::new();
    assert_eq!(state.signal(), RendererSignal::WaitingForNavigation);
    assert!(!state.mark_ready());

    state.finish_navigation(NavigationResult::Succeeded);
    assert_eq!(state.signal(), RendererSignal::WaitingForReady);
    assert!(state.mark_ready());
    assert!(!state.mark_ready());
    assert_eq!(state.signal(), RendererSignal::Ready);
}

#[test]
fn navigation_failure_can_never_become_renderer_ready() {
    let state = RendererRuntimeState::new();
    state.finish_navigation(NavigationResult::Failed);
    assert!(!state.mark_ready());
    assert_eq!(state.signal(), RendererSignal::NavigationFailed);
}
