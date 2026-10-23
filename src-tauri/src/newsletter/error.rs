use std::{error::Error, fmt};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum RepositoryError {
    InvalidProject,
    UnsupportedVersion,
    NotFound,
    Conflict,
    Corrupted,
    Unavailable,
}

impl fmt::Display for RepositoryError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Newsletter 프로젝트 저장소 작업을 완료할 수 없습니다.")
    }
}

impl Error for RepositoryError {}
