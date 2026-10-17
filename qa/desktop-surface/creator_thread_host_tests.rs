use super::*;
use crate::native_contract::{
    ownership_receipt::Synthetic,
    verifier::fake::{Fake, Fault},
};
#[path = "creator_thread_host_fixture.rs"]
mod fixture;
use fixture::{available, closed, fixture};
#[test]
fn normal_create() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = fixture();
    h.create().unwrap();
    assert_eq!(h.pump(4), Ok(1));
    assert!(matches!(h.state(), State::Available(_)));
}
#[test]
fn normal_close() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = available();
    h.close().unwrap();
    assert_eq!(h.pump(4), Ok(1));
    assert_eq!(h.state(), State::Absent);
}
#[test]
fn delayed_callback() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = fixture();
    h.create().unwrap();
    h.backend.delay = true;
    assert_eq!(h.pump(4), Ok(0));
    assert!(matches!(h.state(), State::Creating(_)));
    h.backend.delay = false;
    assert_eq!(h.pump(4), Ok(1));
}
#[test]
fn duplicate_callback() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = fixture();
    h.create().unwrap();
    let n = h.backend.notices[0].clone();
    h.backend.notices.push(n);
    assert!(h.pump(4).is_err());
    assert!(h.faulted());
}
#[test]
fn reverse_callback() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = fixture();
    h.create().unwrap();
    h.backend.notices[0].sequence = 2;
    assert!(h.pump(4).is_err());
}
#[test]
fn prior_generation() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = available();
    let old = h.backend.notices_for_test.clone().unwrap();
    h.close().unwrap();
    h.pump(4).unwrap();
    h.verify_cleanup().unwrap();
    h.pump(4).unwrap();
    h.replacement().unwrap();
    h.pump(4).unwrap();
    h.backend.notices.push(old);
    assert!(h.pump(4).is_err());
}
#[test]
fn prior_owner() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = fixture();
    h.create().unwrap();
    let mut other = fixture();
    other.create().unwrap();
    h.backend.notices[0].owner = other.backend.owner.clone().unwrap();
    assert!(h.pump(4).is_err());
}
#[test]
fn retired_owner() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = closed();
    let old = h.backend.notices_for_test.clone().unwrap();
    h.verify_cleanup().unwrap();
    h.backend.notices.push(old);
    assert!(h.pump(4).is_err());
}
#[test]
fn overflow() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = fixture();
    h.create().unwrap();
    h.backend.overflow = true;
    assert_eq!(h.pump(16), Err(Error::Overflow));
}
#[test]
fn reentry() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = fixture();
    h.entered = true;
    assert_eq!(h.create(), Err(Error::Reentry));
    assert!(h.faulted());
}
#[test]
fn create_close_race() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = fixture();
    h.create().unwrap();
    h.close().unwrap();
    h.pump(4).unwrap();
    assert!(matches!(h.state(), State::Disposing(_)));
    h.pump(4).unwrap();
    assert_eq!(h.state(), State::Absent);
}
#[test]
fn close_loss_race_loss_before_disposal_completion() {
    // Given disposal completion captured, and an origin-owner loss arriving first.
    let mut h = available();
    let before = h.inspect().clone();
    h.close().unwrap();
    let mut loss = h.backend.notices[0].clone();
    loss.binding = h.backend.owner.as_ref().unwrap().creation().binding.clone();
    h.backend.notices[0].sequence += 1;
    h.backend.notices.insert(0, loss);
    // When the conflicting loss and disposal callbacks are transferred together.
    assert!(h.pump(4).is_err());
    // Then uncertainty is retained, replacement denied, and every Main field preserved.
    assert!(h.faulted());
    assert!(h.replacement().is_err());
    assert_eq!(h.inspect(), &before);
}
#[test]
fn close_loss_race_loss_after_disposal_completion() {
    // Given disposal completion followed by a late origin-owner loss.
    let mut h = available();
    let before = h.inspect().clone();
    h.close().unwrap();
    let mut loss = h.backend.notices[0].clone();
    loss.binding = h.backend.owner.as_ref().unwrap().creation().binding.clone();
    loss.sequence += 1;
    h.backend.notices.push(loss);
    // When disposal is processed before the late conflicting loss.
    assert_eq!(h.pump(4), Err(Error::Unknown));
    // Then close completion cannot stand in for cleanup proof or authorize replacement.
    assert_eq!(h.state(), State::Absent);
    assert!(h.faulted());
    assert!(h.replacement().is_err());
    assert_eq!(h.inspect(), &before);
}
#[test]
fn cleanup_delay() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = closed();
    h.verify_cleanup().unwrap();
    assert!(h.pending.is_some());
    assert!(!h.faulted());
    h.pump(4).unwrap();
    assert!(h.pending.is_none());
}
#[test]
fn cleanup_failure() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = closed();
    h.backend.fault = Fault::Destroy;
    assert!(h.verify_cleanup().is_err());
    assert!(h.replacement().is_err());
}
#[test]
fn outcome_unknown() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = fixture();
    h.backend.fault = Fault::Unknown;
    assert!(h.create().is_err());
    assert!(h.faulted());
}
#[test]
fn budget_exceeded() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = fixture();
    h.create().unwrap();
    assert_eq!(h.pump(0), Err(Error::Budget));
    assert!(h.faulted());
}
#[test]
fn pump_stop_failure() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = available();
    h.backend.stop_failure = true;
    assert_eq!(h.stop(), Err(Error::PumpStop));
    assert!(h.replacement().is_err());
}
#[test]
fn replacement_blocked() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = available();
    assert!(h.replacement().is_err());
}
#[test]
fn explicit_cleanup_replacement() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = closed();
    h.verify_cleanup().unwrap();
    h.pump(4).unwrap();
    h.replacement().unwrap();
    h.pump(4).unwrap();
    assert!(matches!(h.state(), State::Available(_)));
}
#[test]
fn main_preserved() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = fixture();
    let before = h.inspect().clone();
    h.create().unwrap();
    h.pump(4).unwrap();
    h.close().unwrap();
    h.pump(4).unwrap();
    h.verify_cleanup().unwrap();
    assert_eq!(h.inspect(), &before);
}
#[test]
fn callback_after_stop() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = available();
    h.stop().unwrap();
    assert!(h.pump(4).is_err());
}
#[test]
fn wrong_operation() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = available();
    h.close().unwrap();
    h.backend.notices[0].binding = h.backend.owner.as_ref().unwrap().creation().binding.clone();
    assert!(h.pump(4).is_err());
}
#[test]
fn unexpected_loss() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = available();
    let mut notice = h.backend.notices_for_test.clone().unwrap();
    notice.kind = NoticeKind::Destroyed;
    notice.sequence = 2;
    h.backend.notices.push(notice);
    assert_eq!(h.pump(4), Err(Error::Unknown));
}
#[test]
fn stop_does_not_verify_cleanup() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = available();
    h.stop().unwrap();
    assert!(h.faulted());
    assert!(h.replacement().is_err());
}

#[test]
fn budget_count_exhaustion() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = fixture();
    h.create().unwrap();
    let mut second = h.backend.notices[0].clone();
    second.sequence = 2;
    h.backend.notices.push(second);
    assert_eq!(h.pump(1), Err(Error::Budget));
}
#[test]
fn main_preserved_on_callback_failure() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = fixture();
    let before = h.inspect().clone();
    h.create().unwrap();
    h.backend.notices[0].sequence = 4;
    assert!(h.pump(4).is_err());
    assert_eq!(h.inspect(), &before);
}
#[test]
fn delayed_cleanup_blocks_replacement() {
    // Given a Synthetic own-only fixture; When the named host event occurs; Then admission is checked.
    let mut h = closed();
    h.verify_cleanup().unwrap();
    assert!(h.replacement().is_err());
}

#[path = "creator_thread_failure_tests.rs"]
mod failure_tests;
