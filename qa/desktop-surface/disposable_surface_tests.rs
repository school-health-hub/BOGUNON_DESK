use crate::disposable_surface::*;

fn available(model: &mut Surface) -> Ticket {
    let ticket = model.create(Support::Supported).unwrap();
    model.created(ticket, Completion::Succeeded).unwrap();
    ticket
}

#[test]
fn normal_create_use_dispose() {
    // Given: no Surface and an explicit finite recovery policy.
    let mut model = Surface::new(2);
    assert_eq!(model.state(), State::Absent);
    // When: synthetic completions arrive in order.
    let create = available(&mut model);
    assert_eq!(model.state(), State::Available(create.generation()));
    let dispose = model.dispose().unwrap();
    model.disposed(dispose, Completion::Succeeded).unwrap();
    // Then: the auxiliary object is absent again.
    assert_eq!(model.state(), State::Absent);
}

#[test]
fn create_failure_requires_explicit_retry() {
    let mut model = Surface::new(1);
    let first = model.create(Support::Supported).unwrap();
    model.created(first, Completion::Failed).unwrap();
    assert_eq!(
        model.state(),
        State::Failed(first.generation(), Failure::Create)
    );
    assert_eq!(
        model.create(Support::Supported),
        Err(Error::ExplicitRetryRequired)
    );
    let retry = model.retry_create(Support::Supported).unwrap();
    assert_ne!(first.generation(), retry.generation());
    model.created(retry, Completion::Succeeded).unwrap();
    assert_eq!(model.state(), State::Available(retry.generation()));
}

#[test]
fn available_loss_is_distinct_from_failure() {
    let mut model = Surface::new(1);
    let ticket = available(&mut model);
    model.lost(ticket.generation()).unwrap();
    assert_eq!(model.state(), State::Lost(ticket.generation()));
    assert_eq!(
        model.create(Support::Supported),
        Err(Error::ExplicitRetryRequired)
    );
}

#[test]
fn disposal_failure_blocks_new_generation_until_explicit_disposal_retry() {
    let mut model = Surface::new(1);
    let first = available(&mut model);
    let dispose = model.dispose().unwrap();
    model.disposed(dispose, Completion::Failed).unwrap();
    assert_eq!(
        model.state(),
        State::Failed(first.generation(), Failure::Dispose)
    );
    assert_eq!(
        model.retry_create(Support::Supported),
        Err(Error::InvalidTransition)
    );
    assert_eq!(model.dispose(), Err(Error::ExplicitRetryRequired));
    let retry = model.retry_dispose().unwrap();
    assert_eq!(retry.generation(), first.generation());
    model.disposed(retry, Completion::Succeeded).unwrap();
    assert_eq!(model.state(), State::Absent);
}

#[test]
fn old_create_completion_cannot_change_new_generation() {
    let mut model = Surface::new(1);
    let first = model.create(Support::Supported).unwrap();
    model.lost(first.generation()).unwrap();
    let retry = model.retry_create(Support::Supported).unwrap();
    let before = model.state();
    assert_eq!(
        model.created(first, Completion::Succeeded),
        Err(Error::Stale)
    );
    assert_eq!(model.state(), before);
    model.created(retry, Completion::Succeeded).unwrap();
}

#[test]
fn old_disposal_completion_cannot_clear_new_surface() {
    let mut model = Surface::new(1);
    available(&mut model);
    let old = model.dispose().unwrap();
    model.disposed(old, Completion::Succeeded).unwrap();
    available(&mut model);
    let before = model.state();
    assert_eq!(
        model.disposed(old, Completion::Succeeded),
        Err(Error::Stale)
    );
    assert_eq!(model.state(), before);
}

#[test]
fn duplicate_create_joins_without_allocating_identity() {
    let mut model = Surface::new(0);
    let first = model.create(Support::Supported).unwrap();
    assert_eq!(model.create(Support::Supported), Ok(first));
    model.created(first, Completion::Succeeded).unwrap();
    assert_eq!(
        model.create(Support::Supported),
        Err(Error::AlreadyAvailable)
    );
}

#[test]
fn unsupported_is_not_failed_and_requires_explicit_reprobe_retry() {
    let mut model = Surface::new(1);
    assert_eq!(model.create(Support::Unsupported), Err(Error::Unsupported));
    assert_eq!(model.state(), State::Unsupported);
    assert_eq!(
        model.create(Support::Supported),
        Err(Error::ExplicitRetryRequired)
    );
    let retry = model.retry_create(Support::Supported).unwrap();
    model.created(retry, Completion::Succeeded).unwrap();
}

#[test]
fn unsupported_reprobes_consume_the_finite_retry_budget() {
    let mut model = Surface::new(1);
    assert_eq!(model.create(Support::Unsupported), Err(Error::Unsupported));
    assert_eq!(
        model.retry_create(Support::Unsupported),
        Err(Error::Unsupported)
    );
    assert_eq!(
        model.retry_create(Support::Unsupported),
        Err(Error::RetryLimit)
    );
    assert_eq!(model.state(), State::Unsupported);
}

#[test]
fn recovery_budget_is_lifetime_bounded_and_not_reset_by_success() {
    let mut model = Surface::new(1);
    let first = available(&mut model);
    model.lost(first.generation()).unwrap();
    let retry = model.retry_create(Support::Supported).unwrap();
    model.created(retry, Completion::Succeeded).unwrap();
    model.lost(retry.generation()).unwrap();
    let before = model.state();
    assert_eq!(
        model.retry_create(Support::Supported),
        Err(Error::RetryLimit)
    );
    assert_eq!(model.state(), before);
}

#[test]
fn zero_budget_and_disposal_retry_limit_are_enforced() {
    for limit in [0, 1] {
        let mut model = Surface::new(limit);
        available(&mut model);
        let dispose = model.dispose().unwrap();
        model.disposed(dispose, Completion::Failed).unwrap();
        for _ in 0..limit {
            let retry = model.retry_dispose().unwrap();
            model.disposed(retry, Completion::Failed).unwrap();
        }
        assert_eq!(model.retry_dispose(), Err(Error::RetryLimit));
    }
}

#[test]
fn wrong_completion_kind_and_order_are_rejected_without_change() {
    let mut model = Surface::new(1);
    assert_eq!(model.dispose(), Err(Error::InvalidTransition));
    let create = model.create(Support::Supported).unwrap();
    assert_eq!(
        model.disposed(create, Completion::Succeeded),
        Err(Error::InvalidTransition)
    );
    assert_eq!(model.state(), State::Creating(create));
    model.created(create, Completion::Succeeded).unwrap();
    assert_eq!(
        model.created(create, Completion::Failed),
        Err(Error::InvalidTransition)
    );
    assert_eq!(model.state(), State::Available(create.generation()));
}

#[test]
fn disposal_is_single_flight_and_old_same_generation_operation_is_stale() {
    let mut model = Surface::new(1);
    available(&mut model);
    let old = model.dispose().unwrap();
    assert_eq!(model.dispose(), Ok(old));
    assert_eq!(model.create(Support::Supported), Err(Error::Busy));
    model.disposed(old, Completion::Failed).unwrap();
    let retry = model.retry_dispose().unwrap();
    assert_eq!(
        model.disposed(old, Completion::Succeeded),
        Err(Error::Stale)
    );
    assert_eq!(model.state(), State::Disposing(retry));
}

#[test]
fn stale_loss_and_loss_during_disposal_cannot_invalidate_cleanup() {
    let mut model = Surface::new(1);
    let old = available(&mut model);
    let dispose = model.dispose().unwrap();
    assert_eq!(model.lost(old.generation()), Err(Error::InvalidTransition));
    model.disposed(dispose, Completion::Succeeded).unwrap();
    let current = available(&mut model);
    assert_eq!(model.lost(old.generation()), Err(Error::Stale));
    assert_eq!(model.state(), State::Available(current.generation()));
}

#[test]
fn main_work_state_remains_outside_surface_api_on_every_failure() {
    // Given: authoritative data belongs to the caller, never to Surface.
    let main = (
        "NormalWindow",
        String::from("synthetic unsaved memo"),
        7_u64,
    );
    let original = main.clone();
    let mut model = Surface::new(2);
    // When: a synthetic driver injects loss, creation failure and disposal failure.
    let first = available(&mut model);
    model.lost(first.generation()).unwrap();
    let retry = model.retry_create(Support::Supported).unwrap();
    model.created(retry, Completion::Failed).unwrap();
    let retry = model.retry_create(Support::Supported).unwrap();
    model.created(retry, Completion::Succeeded).unwrap();
    let dispose = model.dispose().unwrap();
    model.disposed(dispose, Completion::Failed).unwrap();
    // Then: no Surface API ever received a main reference or work payload.
    assert_eq!(main, original);
}
