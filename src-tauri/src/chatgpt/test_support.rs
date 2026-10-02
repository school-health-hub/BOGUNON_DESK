use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use rsa::{pkcs1::EncodeRsaPrivateKey, rand_core::OsRng, traits::PublicKeyParts, RsaPrivateKey};
use serde::Serialize;
use serde_json::{json, Value};

pub(crate) const TEST_KEY_ID: &str = "ephemeral-test-key";

pub(crate) struct EphemeralRsaKeyPair {
    encoding_key: EncodingKey,
    jwks: Value,
}

impl EphemeralRsaKeyPair {
    pub(crate) fn generate() -> Self {
        let mut rng = OsRng;
        let private_key = RsaPrivateKey::new(&mut rng, 2_048).expect("ephemeral RSA keypair");
        let public_key = private_key.to_public_key();
        let private_der = private_key
            .to_pkcs1_der()
            .expect("ephemeral RSA private key DER");
        let encoding_key = EncodingKey::from_rsa_der(private_der.as_bytes());
        let jwks = json!({
            "keys": [{
                "kty": "RSA",
                "alg": "RS256",
                "use": "sig",
                "kid": TEST_KEY_ID,
                "n": URL_SAFE_NO_PAD.encode(public_key.n().to_bytes_be()),
                "e": URL_SAFE_NO_PAD.encode(public_key.e().to_bytes_be())
            }]
        });
        Self { encoding_key, jwks }
    }

    pub(crate) fn jwks(&self) -> Value {
        self.jwks.clone()
    }

    pub(crate) fn sign_rs256<Claims>(&self, key_id: &str, claims: &Claims) -> String
    where
        Claims: Serialize,
    {
        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some(key_id.to_owned());
        encode(&header, claims, &self.encoding_key).expect("ephemeral fixture JWT")
    }
}
