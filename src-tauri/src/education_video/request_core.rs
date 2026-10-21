use super::{destination, wire::*};
pub const TIMEOUT_SECONDS: u64 = 12;
pub const REAL_DISPATCH_ENABLED: bool = false;
/// Deliberately not Debug/Serialize: contains a request-scoped credential.
pub struct RequestPlan {
    pub url: String,
    pub authorization: String,
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
pub fn prepare(request: &SearchRequest, token: &str) -> Result<RequestPlan, SearchError> {
    request.validate()?;
    if token.is_empty() || token.len() > 8192 || !token.bytes().all(|c| c.is_ascii_graphic()) {
        return Err(SearchError::Unauthorized);
    }
    let url = destination::proxy_url().map_err(|_| SearchError::InvalidRequest)?;
    let body = serde_json::to_vec(request).map_err(|_| SearchError::InvalidRequest)?;
    Ok(RequestPlan {
        url: url.to_string(),
        authorization: format!("Bearer {token}"),
        body,
        timeout_seconds: TIMEOUT_SECONDS,
        follow_redirects: false,
    })
}
pub fn decode(reply: HttpReply) -> Result<SearchResponse, SearchError> {
    if reply.body.len() > MAX_RESPONSE_BYTES {
        return Err(SearchError::ResponseTooLarge);
    }
    match reply.status {
        200 => parse_response(&reply.body),
        401 | 403 => Err(SearchError::Unauthorized),
        429 => Err(SearchError::QuotaExceeded),
        300..=399 => Err(SearchError::RedirectBlocked),
        _ => Err(SearchError::UpstreamUnavailable),
    }
}
pub fn run_local<T: LocalTransport>(
    request: &SearchRequest,
    token: &str,
    transport: &T,
) -> Result<SearchResponse, SearchError> {
    let plan = prepare(request, token)?;
    decode(transport.send(&plan)?)
}
pub fn disabled_dispatch(
    request: &SearchRequest,
    token: &str,
) -> Result<SearchResponse, SearchError> {
    let _plan = prepare(request, token)?;
    Err(SearchError::RealDispatchDisabled)
}
pub fn safe_message(error: SearchError) -> &'static str {
    match error {
        SearchError::InvalidRequest => "검색 조건을 확인해 주세요.",
        SearchError::Unauthorized => "다시 로그인해 주세요.",
        SearchError::QuotaExceeded => "검색 사용량 한도에 도달했습니다.",
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
