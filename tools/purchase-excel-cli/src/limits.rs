// Set hard limits before reading any request or opening an input workbook.
#[cfg(windows)]
pub fn install() -> Result<(), ()> {
    use windows_sys::Win32::{Foundation::CloseHandle, System::{JobObjects::*, Threading::GetCurrentProcess}};
    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() { return Err(()); }
        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_ACTIVE_PROCESS | JOB_OBJECT_LIMIT_PROCESS_MEMORY | JOB_OBJECT_LIMIT_PROCESS_TIME;
        limits.BasicLimitInformation.ActiveProcessLimit = 1;
        limits.BasicLimitInformation.PerProcessUserTimeLimit = 30 * 10_000_000;
        limits.ProcessMemoryLimit = 512 * 1024 * 1024;
        if SetInformationJobObject(job, JobObjectExtendedLimitInformation, &limits as *const _ as *const _, std::mem::size_of_val(&limits) as u32) == 0 || AssignProcessToJobObject(job, GetCurrentProcess()) == 0 {
            CloseHandle(job); return Err(());
        }
        let mut actual: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        if QueryInformationJobObject(job, JobObjectExtendedLimitInformation, &mut actual as *mut _ as *mut _, std::mem::size_of_val(&actual) as u32, std::ptr::null_mut()) == 0 || actual.ProcessMemoryLimit != limits.ProcessMemoryLimit || actual.BasicLimitInformation.LimitFlags & limits.BasicLimitInformation.LimitFlags != limits.BasicLimitInformation.LimitFlags || actual.BasicLimitInformation.ActiveProcessLimit != 1 {
            CloseHandle(job); return Err(());
        }
        // Retain until OS process teardown. Closing this kill-on-close job here would kill us.
        Ok(())
    }
}
#[cfg(target_os="linux")]
pub fn install() -> Result<(), ()> {
    unsafe {
        let memory=libc::rlimit{rlim_cur:512*1024*1024,rlim_max:512*1024*1024};
        let cpu=libc::rlimit{rlim_cur:30,rlim_max:30};
        if libc::setrlimit(libc::RLIMIT_AS,&memory)!=0 || libc::setrlimit(libc::RLIMIT_CPU,&cpu)!=0 {return Err(());}
    }
    Ok(())
}
#[cfg(not(any(windows,target_os="linux")))]
pub fn install() -> Result<(), ()> { Err(()) }
