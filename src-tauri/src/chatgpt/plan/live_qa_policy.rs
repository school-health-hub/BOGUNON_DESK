use std::{
    fs::OpenOptions,
    io::{self, Write},
    path::Path,
};

#[derive(Clone, Copy)]
pub(crate) enum Mode {
    Models,
    Search,
    Review,
}

pub(crate) fn approved_fingerprint(byte_len: usize, sha256: &str) -> bool {
    byte_len == 964 && sha256 == "e806072de6813dbb960686403f4d88f4eef5a682c3f13909d441b14f85b4e802"
}

pub(crate) fn permits(mode: Mode, method: &str, url: &str) -> bool {
    match mode {
        Mode::Models => method == "GET" && url == "https://api.openai.com/v1/models",
        Mode::Search | Mode::Review => {
            method == "POST" && url == "https://api.openai.com/v1/responses"
        }
    }
}

pub(crate) fn claim_once(path: &Path) -> io::Result<()> {
    let mut receipt = OpenOptions::new().write(true).create_new(true).open(path)?;
    receipt.write_all(b"attempt reserved before dispatch; no automatic retry\n")?;
    receipt.sync_all()
}

pub(crate) fn claim_second(root: &Path) -> io::Result<()> {
    if !root.join("search-attempt.receipt").is_file() {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "original attempt required",
        ));
    }
    claim_once(&root.join("search-attempt-2.receipt"))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn approved_condition_fingerprint_rejects_changed_input() {
        let digest = "e806072de6813dbb960686403f4d88f4eef5a682c3f13909d441b14f85b4e802";
        assert!(approved_fingerprint(964, digest));
        assert!(!approved_fingerprint(963, digest));
        assert!(!approved_fingerprint(964, "wrong"));
    }
    #[test]
    fn refresh_and_revoke_are_never_permitted() {
        for mode in [Mode::Models, Mode::Search, Mode::Review] {
            assert!(!permits(
                mode,
                "POST",
                "https://auth.openai.com/oauth/token"
            ));
            assert!(!permits(
                mode,
                "POST",
                "https://auth.openai.com/oauth/revoke"
            ));
            assert!(!permits(mode, "GET", "https://api.openai.com/v1/responses"));
        }
        assert!(permits(
            Mode::Models,
            "GET",
            "https://api.openai.com/v1/models"
        ));
        assert!(permits(
            Mode::Search,
            "POST",
            "https://api.openai.com/v1/responses"
        ));
    }
    #[test]
    fn second_approval_preserves_first_and_cannot_repeat() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path();
        assert!(claim_second(root).is_err());
        let first = root.join("search-attempt.receipt");
        claim_once(&first).unwrap();
        let original = std::fs::read(&first).unwrap();
        claim_second(root).unwrap();
        assert_eq!(
            claim_second(root).unwrap_err().kind(),
            io::ErrorKind::AlreadyExists
        );
        assert_eq!(std::fs::read(&first).unwrap(), original);
    }
    #[test]
    fn durable_attempt_cannot_be_reused_after_restart() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("search-attempt.receipt");
        claim_once(&path).unwrap();
        assert_eq!(
            claim_once(&path).unwrap_err().kind(),
            io::ErrorKind::AlreadyExists
        );
    }
}
