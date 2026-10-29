use super::{destination, wire::*};
use serde::Deserialize;
pub const TIMEOUT_SECONDS: u64 = 12;
pub const REAL_DISPATCH_ENABLED: bool = false;
pub struct RequestId(uuid::Uuid);
impl RequestId {
    fn parse(value: &str) -> Result<Self, SearchError> {
        let id = uuid::Uuid::parse_str(value).map_err(|_| SearchError::InvalidRequest)?;
        if value.len() != 36
            || id.get_variant() != uuid::Variant::RFC4122
            || !(1..=8).contains(&id.get_version_num())
        {
            return Err(SearchError::InvalidRequest);
        }
        Ok(Self(id))
    }
    pub fn header_value(&self) -> String {
        self.0.hyphenated().to_string()
    }
}
/// Deliberately not Debug/Serialize: contains a request-scoped credential.
pub struct RequestPlan {
    pub url: String,
    pub authorization: String,
    pub request_id: RequestId,
    pub body: Vec<u8>,
    pub timeout_seconds: u64,
    pub follow_redirects: bool,
}
pub struct HttpReply {
    pub status: u16,
    pub body: Vec<u8>,
}
pub trait LocalTransport {
    fn send(&self, plan: &RequestPlan) -> Result<HttpReply, SearchError>;
}
pub fn prepare(
    request: &SearchRequest,
    token: &str,
    request_id: &str,
) -> Result<RequestPlan, SearchError> {
    request.validate()?;
    let request_id = RequestId::parse(request_id)?;
    if token.is_empty() || token.len() > 8192 || !token.bytes().all(|c| c.is_ascii_graphic()) {
        return Err(SearchError::Unauthorized);
    }
    let url = destination::proxy_url().map_err(|_| SearchError::InvalidRequest)?;
    let body = serde_json::to_vec(request).map_err(|_| SearchError::InvalidRequest)?;
    Ok(RequestPlan {
        url: url.to_string(),
        authorization: format!("Bearer {token}"),
        request_id,
        body,
        timeout_seconds: TIMEOUT_SECONDS,
        follow_redirects: false,
    })
}
pub fn decode(reply: HttpReply) -> Result<SearchResponse, SearchError> {
    if reply.body.len() > MAX_RESPONSE_BYTES {
        return Err(SearchError::ResponseTooLarge);
    }
    if let Some(error) = proxy_error(&reply) {
        return Err(error);
    }
    match reply.status {
        200 => parse_response(&reply.body),
        401 | 403 => Err(SearchError::Unauthorized),
        429 => Err(SearchError::QuotaExceeded),
        300..=399 => Err(SearchError::RedirectBlocked),
        _ => Err(SearchError::UpstreamUnavailable),
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ProxyFailure {
    error: ProxyFailureBody,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ProxyFailureBody {
    code: SearchError,
    message: String,
}
fn proxy_error(reply: &HttpReply) -> Option<SearchError> {
    let failure: ProxyFailure = serde_json::from_slice(&reply.body).ok()?;
    if failure.error.message.trim().is_empty()
        || failure.error.message.chars().count() > 500
        || failure.error.message.contains('\0')
    {
        return None;
    }
    match (reply.status, failure.error.code) {
        (400, SearchError::InvalidRequest)
        | (401, SearchError::Unauthorized)
        | (403, SearchError::Forbidden)
        | (429, SearchError::QuotaExceeded | SearchError::UpstreamQuota)
        | (
            503,
            SearchError::NotConfigured
            | SearchError::Unavailable
            | SearchError::UpstreamUnavailable,
        )
        | (409, SearchError::SearchBusy)
        | (502, SearchError::UpstreamInvalid) => Some(failure.error.code),
        _ => None,
    }
}
pub fn run_local<T: LocalTransport>(
    request: &SearchRequest,
    token: &str,
    request_id: &str,
    transport: &T,
) -> Result<SearchResponse, SearchError> {
    let plan = prepare(request, token, request_id)?;
    decode(transport.send(&plan)?)
}
pub fn disabled_dispatch(
    request: &SearchRequest,
    token: &str,
    request_id: &str,
) -> Result<SearchResponse, SearchError> {
    let _plan = prepare(request, token, request_id)?;
    Err(SearchError::RealDispatchDisabled)
}
pub fn safe_message(error: SearchError) -> &'static str {
    match error {
        SearchError::InvalidRequest => "검색 조건을 확인해 주세요.",
        SearchError::Unauthorized => "다시 로그인해 주세요.",
        SearchError::Forbidden => "허용된 화면에서 다시 요청해 주세요.",
        SearchError::QuotaExceeded => "검색 사용량 한도에 도달했습니다.",
        SearchError::NotConfigured => "실제 검색 설정이 준비되지 않았습니다.",
        SearchError::Unavailable => "검색을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        SearchError::SearchBusy => "같은 검색을 처리 중입니다. 잠시 후 다시 시도해 주세요.",
        SearchError::UpstreamQuota => "영상 제공자의 사용량 한도에 도달했습니다.",
        SearchError::UpstreamInvalid => "영상 제공자의 응답을 확인하지 못했습니다.",
        SearchError::UpstreamUnavailable => "검색 서버에 연결하지 못했습니다.",
        SearchError::InvalidResponse => "검색 응답을 확인하지 못했습니다.",
        SearchError::ResponseTooLarge => "검색 응답이 허용 크기를 초과했습니다.",
        SearchError::Timeout => "검색 요청 시간이 초과되었습니다.",
        SearchError::RedirectBlocked => "승인되지 않은 검색 서버 이동을 차단했습니다.",
        SearchError::RealDispatchDisabled => {
            "이 단계에서는 실제 검색 연결이 비활성화되어 있습니다."
        }
    }
}
