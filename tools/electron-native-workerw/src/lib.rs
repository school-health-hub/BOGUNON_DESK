//! Compile-only WorkerW adapter and isolated contracts. No binary, Main route or execution permit issuer.
#![deny(unsafe_op_in_unsafe_fn)]
// Historical modules and the future Host bridge have no runtime callers in this checkpoint.
#[allow(dead_code)]
mod legacy;
#[allow(dead_code)]
mod lifecycle;
#[allow(dead_code)]
mod ownership;
