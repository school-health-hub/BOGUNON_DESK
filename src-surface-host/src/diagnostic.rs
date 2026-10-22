use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic<'a> {
    pub schema: u8,
    pub stage: &'a str,
    pub result: &'a str,
    pub runtime_verification: &'a str,
    pub contains_sensitive_data: bool,
}

impl<'a> Diagnostic<'a> {
    pub const fn not_verified(stage: &'a str, result: &'a str) -> Self {
        Self {
            schema: 1,
            stage,
            result,
            runtime_verification: "NOT_VERIFIED",
            contains_sensitive_data: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagnostic_never_claims_runtime_verification() {
        let value = serde_json::to_value(Diagnostic::not_verified("compile", "PASS")).unwrap();
        assert_eq!(value["runtimeVerification"], "NOT_VERIFIED");
        assert_eq!(value["containsSensitiveData"], false);
    }
}
