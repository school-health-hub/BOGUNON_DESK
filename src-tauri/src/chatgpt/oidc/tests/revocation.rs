use super::*;

#[test]
fn revoke_retries_once_for_transient_failure_and_never_echoes_token() {
    tauri::async_runtime::block_on(async {
        // Given discovery and a flaky revocation endpoint.
        let transport = FakeTransport::new(vec![
            response(200, discovery()),
            Err(TransportError::Unavailable),
            response(204, json!(null)),
        ]);
        let client_id = IssuedClientId::parse("oaiapp_fixture").expect("issued ID");

        // When revocation is attempted.
        let status = OidcClient::new(&transport)
            .revoke_refresh_token(&client_id, &SecretToken::new("refresh-sentinel"))
            .await;

        // Then one retry succeeds and the form has no client secret.
        assert_eq!(status, RevocationStatus::Confirmed);
        let requests = transport.requests();
        assert_eq!(requests.len(), 3);
        assert_eq!(requests[1].2, requests[2].2);
        assert_eq!(
            requests[1].2,
            vec![
                ("token".to_owned(), "refresh-sentinel".to_owned()),
                ("token_type_hint".to_owned(), "refresh_token".to_owned()),
                ("client_id".to_owned(), "oaiapp_fixture".to_owned()),
            ]
        );
    });
}

#[test]
fn revoke_failure_is_sanitized_after_one_retry() {
    tauri::async_runtime::block_on(async {
        // Given two server failures after valid discovery.
        let transport = FakeTransport::new(vec![
            response(200, discovery()),
            response(503, json!({"token": "refresh-sentinel"})),
            response(500, json!({"error": "refresh-sentinel"})),
        ]);
        let client_id = IssuedClientId::parse("oaiapp_fixture").expect("issued ID");

        // When revocation exhausts its bounded retry.
        let status = OidcClient::new(&transport)
            .revoke_refresh_token(&client_id, &SecretToken::new("refresh-sentinel"))
            .await;

        // Then callers receive only a non-sensitive status.
        assert_eq!(status, RevocationStatus::Unconfirmed);
        assert_eq!(transport.requests().len(), 3);
    });
}

#[test]
fn revoke_does_not_retry_non_network_transport_rejection() {
    tauri::async_runtime::block_on(async {
        // Given valid discovery followed by a locally rejected oversized response.
        let transport = FakeTransport::new(vec![
            response(200, discovery()),
            Err(TransportError::ResponseTooLarge),
        ]);
        let client_id = IssuedClientId::parse("oaiapp_fixture").expect("issued ID");

        // When revocation receives a non-network transport rejection.
        let status = OidcClient::new(&transport)
            .revoke_refresh_token(&client_id, &SecretToken::new("refresh-sentinel"))
            .await;

        // Then it fails closed without spending the network-only retry.
        assert_eq!(status, RevocationStatus::Unconfirmed);
        assert_eq!(transport.requests().len(), 2);
    });
}
