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

pub(crate) fn approved_search(model: &str, byte_len: usize, sha256: &str) -> bool {
    model == "gpt-6.1-sol" && approved_fingerprint(byte_len, sha256)
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

pub(crate) fn claim_third(root: &Path) -> io::Result<()> {
    if !root.join("search-attempt.receipt").is_file()
        || !root.join("search-attempt-2.receipt").is_file()
    {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "both previous attempts required",
        ));
    }
    claim_once(&root.join("search-attempt-3.receipt"))
}

pub(crate) fn approved_tool_choice(choice: Option<&str>) -> bool {
    choice == Some("auto")
}

pub(crate) fn claim_fourth(root: &Path) -> io::Result<()> {
    if [
        "search-attempt.receipt",
        "search-attempt-2.receipt",
        "search-attempt-3.receipt",
    ]
    .iter()
    .any(|name| !root.join(name).is_file())
    {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "all three previous attempts required",
        ));
    }
    claim_once(&root.join("search-attempt-4.receipt"))
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
    fn third_search_requires_exact_approved_model_before_dispatch() {
        let digest = "e806072de6813dbb960686403f4d88f4eef5a682c3f13909d441b14f85b4e802";
        assert!(approved_search("gpt-6.1-sol", 964, digest));
        for model in [
            "gpt-6-astra",
            "gpt-6-sol",
            "gpt-5.6-luna",
            "gpt-6.1-sol-extra",
            "",
        ] {
            assert!(!approved_search(model, 964, digest));
        }
        assert!(!approved_search("gpt-6.1-sol", 963, digest));
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
    fn third_approval_requires_both_preserves_them_and_cannot_repeat() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path();
        assert!(claim_third(root).is_err());
        let first = root.join("search-attempt.receipt");
        let second = root.join("search-attempt-2.receipt");
        claim_once(&second).unwrap();
        assert!(claim_third(root).is_err());
        claim_once(&first).unwrap();
        let originals = (
            std::fs::read(&first).unwrap(),
            std::fs::read(&second).unwrap(),
        );
        claim_third(root).unwrap();
        assert_eq!(
            claim_third(root).unwrap_err().kind(),
            io::ErrorKind::AlreadyExists
        );
        assert_eq!(
            (
                std::fs::read(&first).unwrap(),
                std::fs::read(&second).unwrap()
            ),
            originals
        );
        let first_only = tempfile::tempdir().unwrap();
        claim_once(&first_only.path().join("search-attempt.receipt")).unwrap();
        assert!(claim_third(first_only.path()).is_err());
    }
    #[test]
    fn fourth_approval_requires_all_previous_and_never_reuses_receipts() {
        let names = [
            "search-attempt.receipt",
            "search-attempt-2.receipt",
            "search-attempt-3.receipt",
        ];
        for missing in 0..3 {
            let directory = tempfile::tempdir().unwrap();
            for (index, name) in names.iter().enumerate() {
                if index != missing {
                    claim_once(&directory.path().join(name)).unwrap();
                }
            }
            assert!(claim_fourth(directory.path()).is_err());
            assert!(!directory.path().join("search-attempt-4.receipt").exists());
        }
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path();
        for (index, name) in names.iter().enumerate() {
            std::fs::write(root.join(name), format!("original-{index}")).unwrap();
        }
        let originals: Vec<_> = names
            .iter()
            .map(|name| std::fs::read(root.join(name)).unwrap())
            .collect();
        claim_fourth(root).unwrap();
        assert_eq!(
            claim_fourth(root).unwrap_err().kind(),
            io::ErrorKind::AlreadyExists
        );
        assert_eq!(
            names
                .iter()
                .map(|name| std::fs::read(root.join(name)).unwrap())
                .collect::<Vec<_>>(),
            originals
        );
    }
    #[test]
    fn fourth_approval_only_accepts_auto_tool_choice() {
        assert!(approved_tool_choice(Some("auto")));
        for choice in [None, Some("required"), Some("none"), Some("AUTO"), Some("")] {
            assert!(!approved_tool_choice(choice));
        }
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
