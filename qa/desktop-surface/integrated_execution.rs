//! Trusted bridge only: construction occurs after the integrated Attempt latch.
//! The separate Integrated entrypoint reaches this bridge only through its Gate.
//! No OS message dispatcher exists here.
#[cfg(all(windows, not(test)))]
pub(crate) fn run(
    key: crate::integrated_runner::gate::ExecutionKey<'_>,
) -> Result<
    crate::integrated_runner::result::RunResult<super::ownership_receipt::Native>,
    crate::integrated_runner::gate::ExecutionError,
> {
    use super::creator_thread_host::synchronous_driver::Driver;
    let mut driver = Driver::native(crate::main_boundary_state::Authoritative::synthetic());
    let report = driver
        .run()
        .map_err(|_| crate::integrated_runner::gate::ExecutionError::DriverAdmission)?;
    Ok(key.complete(&report))
}
