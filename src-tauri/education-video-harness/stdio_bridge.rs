use super::{
    command_core,
    request_core::{self, HttpReply},
    wire::SearchRequest,
};
use std::{
    future::{ready, Future},
    io::{self, BufRead, Write},
    sync::Arc,
    task::{Context, Poll, Wake, Waker},
};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Input {
    request: SearchRequest,
    access_token: String,
    request_id: String,
}
#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct Reply {
    status: u16,
    body: String,
}
struct ReadyWaker;
impl Wake for ReadyWaker {
    fn wake(self: Arc<Self>) {}
}
fn finish_ready<F: Future>(future: F) -> F::Output {
    let waker = Waker::from(Arc::new(ReadyWaker));
    match std::pin::pin!(future)
        .as_mut()
        .poll(&mut Context::from_waker(&waker))
    {
        Poll::Ready(output) => output,
        Poll::Pending => panic!("Synthetic bridge must complete synchronously"),
    }
}

#[test]
#[ignore = "Explicit synthetic stdin/stdout interop driver only; never part of the app"]
fn synthetic_proxy_roundtrip() {
    let stdin = io::stdin();
    let mut lines = stdin.lock().lines();
    let input: Input = serde_json::from_str(&lines.next().unwrap().unwrap()).unwrap();
    assert!(matches!(
        input.access_token.as_str(),
        "synthetic-valid" | "synthetic-expired" | ""
    ));
    let result = finish_ready(command_core::synthetic(
        &input.request,
        &input.access_token,
        &input.request_id,
        |plan| {
            println!(
                "FINDER_PLAN:{}",
                serde_json::json!({ "url": plan.url, "authorization": plan.authorization,
            "requestId": plan.request_id.header_value(), "body": String::from_utf8(plan.body).unwrap(),
            "timeoutSeconds": plan.timeout_seconds, "followRedirects": plan.follow_redirects })
            );
            io::stdout().flush().unwrap();
            let reply: Reply = serde_json::from_str(&lines.next().unwrap().unwrap()).unwrap();
            ready(request_core::decode(HttpReply {
                status: reply.status,
                body: reply.body.into_bytes(),
            }))
        },
    ));
    println!("FINDER_RESULT:{}", serde_json::to_string(&result).unwrap());
    io::stdout().flush().unwrap();
}
