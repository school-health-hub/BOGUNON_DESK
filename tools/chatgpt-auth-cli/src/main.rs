#![allow(dead_code)]
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    io::{self, BufRead, Read, Write},
    path::PathBuf,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
mod chatgpt {
    include!(concat!(env!("OUT_DIR"), "/chatgpt/mod.rs"));
}
use chatgpt::{
    credential::ChatGptCredentialMutationState,
    lifecycle::{self, BrowserOpener, SignInEnvironment},
    storage::{DefaultChatGptStorage, DpapiProtector},
};
#[derive(Deserialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum Request {
    State {},
    SignIn {},
    Models {},
    Generate {
        model: String,
        prompt: String,
        account_id: String,
    },
    Disconnect {},
    Acknowledge {},
}
fn emit(value: Value) -> Result<(), ()> {
    let mut out = io::stdout().lock();
    serde_json::to_writer(&mut out, &value).map_err(|_| ())?;
    out.write_all(b"\n").map_err(|_| ())?;
    out.flush().map_err(|_| ())
}
struct Opener;
impl BrowserOpener for Opener {
    fn open(&self, url: &str) -> Result<(), lifecycle::ChatGptLifecycleError> {
        emit(json!({"event":"authorize","url":url}))
            .map_err(|_| lifecycle::ChatGptLifecycleError::BrowserOpen)
    }
}
fn timestamp() -> Result<u64, &'static str> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .map_err(|_| "clock")
}
fn identity(storage: &DefaultChatGptStorage) -> Result<Option<String>, String> {
    use sha2::{Digest, Sha256};
    storage
        .load_registration()
        .map(|r| {
            r.map(|r| {
                format!(
                    "{:x}",
                    Sha256::digest(format!(
                        "{}\0{}\0{}",
                        r.issuer,
                        r.issued_client_id.as_str(),
                        r.subject
                    ))
                )
            })
        })
        .map_err(|_| "storage".into())
}
fn state(storage: &DefaultChatGptStorage) -> Result<Value, String> {
    let connection = lifecycle::connection_state(storage, false, None).map_err(|_| "storage")?;
    Ok(json!({"connection":connection,"accountId":identity(storage)?}))
}
async fn execute(storage: &DefaultChatGptStorage, request: Request) -> Result<Value, String> {
    let guard = ChatGptCredentialMutationState::default();
    match request {
        Request::State {} => state(storage),
        Request::SignIn {} => {
            let transport = chatgpt::http::ReqwestTransport::new().map_err(|_| "connection")?;
            let connection = lifecycle::sign_in(SignInEnvironment::new(
                storage,
                &transport,
                &Opener,
                Duration::from_secs(300),
                timestamp()?,
                &guard,
            ))
            .await
            .map_err(|e| match e {
                lifecycle::ChatGptLifecycleError::OAuth(chatgpt::oauth::OAuthError::Loopback(
                    chatgpt::loopback::LoopbackError::Cancelled,
                )) => "cancelled".to_owned(),
                _ => "authentication".to_owned(),
            })?;
            Ok(json!({"connection":connection,"accountId":identity(storage)?}))
        }
        Request::Disconnect {} => {
            let transport = chatgpt::http::ReqwestTransport::new().map_err(|_| "connection")?;
            let connection = lifecycle::disconnect(storage, &transport, &guard)
                .await
                .map_err(|_| "storage")?;
            Ok(json!({"connection":connection,"accountId":identity(storage)?}))
        }
        Request::Acknowledge {} => {
            if let Some(mut registration) = storage.load_registration().map_err(|_| "storage")? {
                registration.plan_usage_notice_acknowledged = true;
                storage
                    .save_registration(&registration)
                    .map_err(|_| "storage")?;
            }
            state(storage)
        }
        Request::Models {} => {
            let transport = chatgpt::plan::ReqwestPlanTransport::new().map_err(|_| "connection")?;
            let models = chatgpt::plan::list_models(storage, &transport, &guard, timestamp()?)
                .await
                .map_err(|e| {
                    serde_json::to_string(&e.code)
                        .unwrap_or_default()
                        .trim_matches('"')
                        .to_owned()
                })?;
            Ok(json!({"models":models,"state":state(storage)?}))
        }
        Request::Generate {
            model,
            prompt,
            account_id,
        } => {
            if identity(storage)?.as_deref() != Some(&account_id) {
                return Err("accountChanged".into());
            }
            if model.is_empty()
                || model.len() > 128
                || !model
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"-._".contains(&b))
                || prompt.trim().is_empty()
                || prompt.len() > 65536
                || prompt.contains('\0')
            {
                return Err("input".into());
            }
            let transport = chatgpt::plan::ReqwestPlanTransport::new().map_err(|_| "connection")?;
            let models = chatgpt::plan::list_models(storage, &transport, &guard, timestamp()?)
                .await
                .map_err(|e| {
                    serde_json::to_string(&e.code)
                        .unwrap_or_default()
                        .trim_matches('"')
                        .to_owned()
                })?;
            if !models.iter().any(|m| m.slug == model) {
                return Err("model".into());
            }
            let text = chatgpt::plan::generate_text(
                storage,
                &transport,
                &guard,
                timestamp()?,
                &chatgpt::plan::GenerateTextRequest::new(model, prompt),
            )
            .await
            .map_err(|e| {
                serde_json::to_string(&e.code)
                    .unwrap_or_default()
                    .trim_matches('"')
                    .to_owned()
            })?;
            if text.trim().is_empty() || text.len() > 65536 {
                return Err("invalidResponse".into());
            }
            Ok(json!({"text":text,"accountId":account_id}))
        }
    }
}
#[tokio::main]
async fn main() {
    // No credentials, prompts or provider error bodies in stderr/logs. One request per process.
    let result = run().await;
    let _ = emit(match result {
        Ok(data) => json!({"ok":true,"data":data}),
        Err(code) => json!({"ok":false,"code":code}),
    });
}
async fn run() -> Result<Value, String> {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.len() != 2 || args[0] != "--data-dir" {
        return Err("input".into());
    }
    let root = PathBuf::from(&args[1]);
    if !root.is_absolute() {
        return Err("input".into());
    }
    let mut bytes = Vec::new();
    io::stdin()
        .lock()
        .take(70001)
        .read_until(b'\n', &mut bytes)
        .map_err(|_| "input")?;
    if bytes.len() > 70000 || !bytes.ends_with(b"\n") {
        return Err("input".into());
    }
    let request: Request = serde_json::from_slice(&bytes).map_err(|_| "input")?;
    if !cfg!(windows) {
        return Err("unsupportedPlatform".into());
    }
    validate_root(&root)?;
    let storage = DefaultChatGptStorage::new(&root, DpapiProtector);
    let data = execute(&storage, request).await?;
    if let Some(secret) = storage.load_credential().map_err(|_| "storage")? {
        let public = serde_json::to_string(&data).map_err(|_| "invalidResponse")?;
        for value in [
            Some(&secret.access_token),
            secret.refresh_token.as_ref(),
            Some(&secret.id_token),
        ]
        .into_iter()
        .flatten()
        {
            if public.contains(value.expose()) {
                return Err("invalidResponse".into());
            }
        }
    }
    Ok(data)
}

fn validate_root(root: &std::path::Path) -> Result<(), String> {
    for path in root.ancestors() {
        if let Ok(meta) = std::fs::symlink_metadata(path) {
            if meta.file_type().is_symlink() || !meta.is_dir() {
                return Err("storage".into());
            }
        }
    }
    for name in [
        "chatgpt-host.json",
        "chatgpt-registration.bin",
        "chatgpt-auth.bin",
    ] {
        if let Ok(meta) = std::fs::symlink_metadata(root.join(name)) {
            if !meta.is_file() || meta.file_type().is_symlink() || meta.len() > 65536 {
                return Err("storage".into());
            }
        }
    }
    Ok(())
}
#[cfg(test)]
mod adapter_tests {
    use super::*;
    #[test]
    fn rejects_unknown_actions_fields_and_secret_arguments() {
        for value in [
            json!({"action":"fetch","url":"https://example.com"}),
            json!({"action":"state","token":"synthetic"}),
            json!({"action":"generate","model":"gpt-test","prompt":"test"}),
        ] {
            assert!(serde_json::from_value::<Request>(value).is_err());
        }
        assert!(serde_json::from_value::<Request>(
            json!({"action":"generate","model":"gpt-test","prompt":"test","accountId":"a"})
        )
        .is_ok());
    }
    #[test]
    fn no_tauri_runtime_or_duplicated_authentication_source() {
        let source = include_str!(concat!(env!("OUT_DIR"), "/chatgpt/lifecycle.rs"));
        assert!(!source.contains("tauri::"));
        assert!(source.contains("tokio::task::spawn_blocking"));
    }
}

#[cfg(test)]
fn test_block_on<F: std::future::Future>(future: F) -> F::Output {
    tokio::runtime::Runtime::new()
        .expect("test runtime")
        .block_on(future)
}
