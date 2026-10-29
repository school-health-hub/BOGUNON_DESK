//! Exact production pure storage/request modules; no Tauri or HTTP adapter build.
#[cfg(test)]
#[path = "../src/education_video/command_core.rs"]
pub mod command_core;
#[cfg(test)]
#[path = "../src/education_video/command_tests.rs"]
pub mod command_tests;
#[path = "../src/education_video/destination.rs"]
pub mod destination;
#[path = "../src/education_video/legacy.rs"]
pub mod legacy;
#[path = "../src/education_video/model.rs"]
pub mod model;
#[cfg(test)]
#[path = "../src/education_video/phase2_tests.rs"]
pub mod phase2_tests;
#[path = "../src/education_video/registry.rs"]
pub mod registry;
#[path = "../src/education_video/request_core.rs"]
pub mod request_core;
#[path = "../src/education_video/retention.rs"]
pub mod retention;
#[path = "../src/education_video/store.rs"]
pub mod store;
#[path = "../src/education_video/timestamps.rs"]
pub mod timestamps;
#[cfg(test)]
#[path = "../src/education_video/transport_tests.rs"]
pub mod transport_tests;
#[path = "../src/education_video/wire.rs"]
pub mod wire;

#[cfg(test)]
#[path = "../src/education_video/tests.rs"]
pub mod tests;

#[cfg(test)]
mod stdio_bridge;

#[cfg(test)]
#[path = "../src/chatgpt/plan/web_search_parser.rs"]
mod chatgpt_web_search_parser;

#[path = "../src/education_video/ai_metadata.rs"]
pub mod ai_metadata;
