mod admission;
#[cfg(test)]
mod admission_tests;
#[cfg(test)]
mod identity_tests;
mod machine;
#[cfg(test)]
mod mock;
mod model;
#[cfg(all(windows, feature = "windows-adapter-skip-miri"))]
mod native;
#[cfg(all(windows, feature = "windows-adapter-skip-miri"))]
mod native_bridge;
#[cfg(all(windows, feature = "windows-adapter-skip-miri"))]
mod native_writes;
#[cfg(all(windows, feature = "windows-adapter-skip-miri"))]
mod observation;
#[cfg(all(windows, feature = "windows-adapter-skip-miri"))]
mod observation_reader;
#[cfg(all(windows, feature = "windows-adapter-skip-miri"))]
mod owned;
#[cfg(all(windows, feature = "windows-adapter-skip-miri"))]
mod read_only_process;
#[cfg(all(windows, feature = "windows-adapter-skip-miri"))]
mod read_only_topology;
#[cfg(all(windows, feature = "windows-adapter-skip-miri"))]
mod read_only_windows;
#[cfg(test)]
mod tests;
mod write_plan;
