mod admission;
#[cfg(test)]
mod admission_tests;
pub(crate) mod dry_run;
#[cfg(test)]
mod identity_tests;
mod machine;
mod mock;
mod model;
#[cfg(all(windows, feature = "windows-adapter-skip-miri"))]
mod native;
#[cfg(all(windows, feature = "windows-adapter-skip-miri"))]
mod native_bridge;
#[cfg(all(windows, feature = "windows-adapter-skip-miri"))]
mod native_writes;
#[cfg(all(
    windows,
    any(
        feature = "windows-adapter-skip-miri",
        feature = "windows-observation-skip-miri"
    )
))]
mod observation;
#[cfg(all(
    windows,
    any(
        feature = "windows-adapter-skip-miri",
        feature = "windows-observation-skip-miri"
    )
))]
mod observation_reader;
#[cfg(all(windows, feature = "windows-adapter-skip-miri"))]
mod owned;
#[cfg(all(
    windows,
    any(
        feature = "windows-adapter-skip-miri",
        feature = "windows-observation-skip-miri"
    )
))]
mod read_only_process;
#[cfg(all(
    windows,
    any(
        feature = "windows-adapter-skip-miri",
        feature = "windows-observation-skip-miri"
    )
))]
mod read_only_topology;
#[cfg(all(
    windows,
    any(
        feature = "windows-adapter-skip-miri",
        feature = "windows-observation-skip-miri"
    )
))]
mod read_only_windows;
#[cfg(test)]
mod tests;
mod write_plan;

#[cfg(all(windows, feature = "windows-observation-skip-miri"))]
pub(crate) mod live_read_only;
