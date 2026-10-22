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

#[cfg(test)]
mod tests {
    use super::*;
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
