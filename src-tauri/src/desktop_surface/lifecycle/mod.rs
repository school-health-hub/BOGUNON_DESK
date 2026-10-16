//! 9B-2A simulation only. No native adapter or application command is connected.
#[cfg(test)]
mod identity_tests;
mod machine;
#[cfg(test)]
mod mock;
mod model;
#[cfg(all(test, windows))]
mod observation;
#[cfg(all(test, windows))]
mod observation_fixture;
#[cfg(all(test, windows))]
mod observation_reader;
#[cfg(all(test, windows))]
mod read_only_process;
#[cfg(all(test, windows))]
mod read_only_tests;
#[cfg(all(test, windows))]
mod read_only_topology;
#[cfg(all(test, windows))]
mod read_only_windows;
#[cfg(test)]
mod tests;
