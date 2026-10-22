use super::*;
use std::path::PathBuf;
#[path = "live_qa_policy.rs"]
mod policy;
use policy::Mode;

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
        Self::new(root, Mode::Search, "search-attempt.receipt")
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
                // Fail closed on refresh, duplicate dispatch, receipt failure and restart.
                policy::claim_once(&self.receipt)
                    .map_err(|_| InternalError::bare(InternalErrorKind::Permission))?;
            }
        }
        self.client.send(request).await
    }
}
