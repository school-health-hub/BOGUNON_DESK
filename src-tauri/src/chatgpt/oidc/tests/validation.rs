use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};

use super::*;

#[test]
fn id_token_rejects_wrong_claims_key_algorithm_and_malformed_input() {
    // Given a trusted JWKS and invalid claim, key, algorithm, and token variants.
    let key_pair = EphemeralRsaKeyPair::generate();
    let set: jsonwebtoken::jwk::JwkSet =
        serde_json::from_value(key_pair.jwks()).expect("JWKS fixture");
    let client_id = IssuedClientId::parse("oaiapp_fixture").expect("issued ID");
    let wrong_issuer = id_token(&key_pair, |claims| claims.iss = "https://evil.example");
    let wrong_audience = id_token(&key_pair, |claims| claims.aud = "oaiapp_other");
    let wrong_nonce = id_token(&key_pair, |claims| claims.nonce = "other-nonce");
    let expired = id_token(&key_pair, |claims| claims.exp = 1);
    let missing_subject = id_token(&key_pair, |claims| claims.sub = " ");
    let unknown_kid = key_pair.sign_rs256(
        "missing-key",
        &FixtureClaims {
            iss: "https://auth.openai.com",
            aud: "oaiapp_fixture",
            sub: "subject-123",
            exp: 4_102_444_800,
            nonce: "nonce-sentinel",
            email: "person@example.test",
            name: "Test Person",
        },
    );
    let mut wrong_algorithm_header = Header::new(Algorithm::HS256);
    wrong_algorithm_header.kid = Some(TEST_KEY_ID.to_owned());
    let wrong_algorithm = encode(
        &wrong_algorithm_header,
        &FixtureClaims {
            iss: "https://auth.openai.com",
            aud: "oaiapp_fixture",
            sub: "subject-123",
            exp: 4_102_444_800,
            nonce: "nonce-sentinel",
            email: "person@example.test",
            name: "Test Person",
        },
        &EncodingKey::from_secret(b"01234567890123456789012345678901"),
    )
    .expect("wrong-algorithm fixture JWT");

    // When each token is validated.
    let invalid = [
        wrong_issuer,
        wrong_audience,
        wrong_nonce,
        expired,
        missing_subject,
        unknown_kid,
        wrong_algorithm,
        "not-a-jwt".to_owned(),
    ];

    // Then every claim/key violation has the same sanitized failure surface.
    for token in invalid {
        let error = match validate_id_token(
            &SecretToken::new(token),
            &set,
            &client_id,
            &OAuthNonce::new("nonce-sentinel"),
            "https://auth.openai.com",
        ) {
            Ok(_) => panic!("invalid identity must fail"),
            Err(error) => error,
        };
        assert_eq!(error.to_string(), "ChatGPT 신원 확인에 실패했습니다.");
        assert!(!error.to_string().contains("sentinel"));
    }
}

#[test]
fn id_token_validation_uses_the_validated_discovery_issuer() {
    // Given a correctly signed token and a different issuer supplied by validated discovery.
    let key_pair = EphemeralRsaKeyPair::generate();
    let set: jsonwebtoken::jwk::JwkSet =
        serde_json::from_value(key_pair.jwks()).expect("JWKS fixture");
    let client_id = IssuedClientId::parse("oaiapp_fixture").expect("issued ID");

    // When ID-token validation consumes that discovery issuer.
    let result = validate_id_token(
        &SecretToken::new(id_token(&key_pair, |_| {})),
        &set,
        &client_id,
        &OAuthNonce::new("nonce-sentinel"),
        "https://validated-issuer.example",
    );

    // Then the claim mismatch is rejected instead of falling back to a validator literal.
    assert!(matches!(result, Err(OidcError::InvalidIdentity)));
}
