use super::*;
use std::path::PathBuf;
#[path = "live_qa_policy.rs"]
mod policy;
pub(crate) use policy::approved_search;
use policy::Mode;
#[path = "live_qa_diagnostics.rs"]
pub(crate) mod diagnostics;

pub(crate) struct ReadOnlyTransport {
    client: ReqwestPlanTransport,
    mode: Mode,
    receipt: PathBuf,
}
impl ReadOnlyTransport {
    pub(crate) fn models(root: &std::path::Path) -> Result<Self, ChatGptPlanErrorDto> {
        Self::new(root, Mode::Models, "unused")
    }
    pub(crate) fn search(root: &std::path::Path) -> Result<Self, ChatGptPlanErrorDto> {
        Self::new(root, Mode::Search, "search-attempt-4.receipt")
    }
    pub(crate) fn review(root: &std::path::Path) -> Result<Self, ChatGptPlanErrorDto> {
        Self::new(root, Mode::Review, "review-attempt.receipt")
    }
    fn new(root: &std::path::Path, mode: Mode, receipt: &str) -> Result<Self, ChatGptPlanErrorDto> {
        Ok(Self {
            client: ReqwestPlanTransport {
                client: reqwest::Client::builder()
                    .timeout(std::time::Duration::from_secs(120))
                    .redirect(reqwest::redirect::Policy::none())
                    .retry(reqwest::retry::never())
                    .build()
                    .map_err(|_| ChatGptPlanErrorDto::storage())?,
            },
            mode,
            receipt: root.join(receipt),
        })
    }
}
impl PlanTransport for ReadOnlyTransport {
    async fn send(&self, request: ApiRequest) -> Result<ApiResponse, InternalError> {
        let method = match request.method {
            ApiMethod::Get => "GET",
            ApiMethod::Post => "POST",
        };
        if !policy::permits(self.mode, method, &request.url) {
            return Err(InternalError::bare(InternalErrorKind::Reauth));
        }
        match self.mode {
            Mode::Models => {}
            Mode::Search | Mode::Review => {
                let payload = match &request.body {
                    RequestBody::Json(value) => value,
                    _ => return Err(InternalError::INVALID_RESPONSE),
                };
                let web_tool = payload
                    .get("tools")
                    .and_then(serde_json::Value::as_array)
                    .is_some_and(|tools| {
                        tools.iter().any(|tool| {
                            tool.get("type").and_then(serde_json::Value::as_str)
                                == Some("web_search")
                        })
                    });
                let expected_web = matches!(self.mode, Mode::Search);
                if web_tool != expected_web {
                    return Err(InternalError::INVALID_RESPONSE);
                }
                if matches!(self.mode, Mode::Search)
                    && !policy::approved_tool_choice(
                        payload
                            .get("tool_choice")
                            .and_then(serde_json::Value::as_str),
                    )
                {
                    return Err(InternalError::bare(InternalErrorKind::Permission));
                }
                // Fail closed on refresh, duplicate dispatch, receipt failure and restart.
                if matches!(self.mode, Mode::Search) {
                    let root = self
                        .receipt
                        .parent()
                        .ok_or(InternalError::INVALID_RESPONSE)?;
                    policy::claim_fourth(root)
                        .map_err(|_| InternalError::bare(InternalErrorKind::Permission))?;
                    diagnostics::write_new(&root.join("search-4-before-dispatch.json"), &serde_json::json!({"slot":4,"stage":"reservedBeforeHttp","automaticRetry":false,"toolChoice":"auto"}))
                        .map_err(|_| InternalError::TRANSPORT)?;
                } else {
                    // This approval permits no additional AI review request.
                    return Err(InternalError::bare(InternalErrorKind::Permission));
                }
            }
        }
        let result = self.client.send(request).await;
        if matches!(self.mode, Mode::Search) {
            let root = self
                .receipt
                .parent()
                .ok_or(InternalError::INVALID_RESPONSE)?;
            let summary = match &result {
                Ok(response) => {
                    let mut summary = diagnostics::summarize(
                        response.status,
                        response.request_id.is_some(),
                        &response.body,
                    );
                    summary["searchParseReason"] =
                        serde_json::json!(web_search::diagnose(&response.body));
                    summary["httpAccepted"] = serde_json::json!(ensure_success(response).is_ok());
                    summary["sharedStreamAccepted"] =
                        serde_json::json!(parse_response_stream(&response.body).is_ok());
                    summary
                }
                Err(_) => serde_json::json!({"stage":"httpTransportFailure","retryAllowed":false}),
            };
            diagnostics::write_new(&root.join("search-4-http-response.json"), &summary)
                .map_err(|_| InternalError::TRANSPORT)?;
        }
        result
    }
}
