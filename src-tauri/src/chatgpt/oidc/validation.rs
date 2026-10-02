use std::collections::HashSet;

use jsonwebtoken::{
    decode, decode_header,
    jwk::{JwkSet, KeyAlgorithm},
    Algorithm, DecodingKey, Validation,
};
use serde::Deserialize;

use super::OidcError;
use crate::chatgpt::model::{IssuedClientId, OAuthNonce, SecretToken, ValidatedIdentity};

#[derive(Deserialize)]
struct IdTokenClaims {
    iss: String,
    sub: String,
    nonce: String,
    email: Option<String>,
    name: Option<String>,
}

pub(crate) fn validate_id_token(
    token: &SecretToken,
    jwks: &JwkSet,
    client_id: &IssuedClientId,
    nonce: &OAuthNonce,
    expected_issuer: &str,
) -> Result<ValidatedIdentity, OidcError> {
    let header = decode_header(token.expose()).map_err(|_| OidcError::InvalidIdentity)?;
    if header.alg != Algorithm::RS256 {
        return Err(OidcError::InvalidIdentity);
    }
    let kid = header.kid.ok_or(OidcError::InvalidIdentity)?;
    let jwk = jwks.find(&kid).ok_or(OidcError::InvalidIdentity)?;
    if jwk.common.key_algorithm != Some(KeyAlgorithm::RS256) {
        return Err(OidcError::InvalidIdentity);
    }
    let key = DecodingKey::from_jwk(jwk).map_err(|_| OidcError::InvalidIdentity)?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.leeway = 0;
    validation.set_issuer(&[expected_issuer]);
    validation.set_audience(&[client_id.as_str()]);
    validation.required_spec_claims = HashSet::from([
        "exp".to_owned(),
        "iss".to_owned(),
        "aud".to_owned(),
        "sub".to_owned(),
    ]);
    let claims = decode::<IdTokenClaims>(token.expose(), &key, &validation)
        .map_err(|_| OidcError::InvalidIdentity)?
        .claims;
    if claims.nonce != nonce.expose() || claims.sub.trim().is_empty() {
        return Err(OidcError::InvalidIdentity);
    }
    Ok(ValidatedIdentity {
        issuer: claims.iss,
        subject: claims.sub,
        email: claims.email,
        display_name: claims.name,
    })
}
