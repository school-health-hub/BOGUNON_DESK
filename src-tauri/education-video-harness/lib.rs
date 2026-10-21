//! Runs the exact production storage and destination modules without Tauri GUI dependencies.
#[path = "../src/education_video/destination.rs"]
pub mod destination;
#[path = "../src/education_video/model.rs"]
pub mod model;
#[path = "../src/education_video/store.rs"]
pub mod store;
#[cfg(test)]
#[path = "../src/education_video/tests.rs"]
pub mod tests;
