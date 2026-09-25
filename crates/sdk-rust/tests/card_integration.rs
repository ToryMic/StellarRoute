//! CARD-37 integration tests (issues #1495-#1498).
//!
//! Uses `wiremock` so no live API is required. Verifies:
//! - disabled health (404) does not panic and maps to `enabled: false`,
//! - validate posts the draft,
//! - list returns the fixture array.

use stellarroute_sdk::{CardApplicationDraft, ClientBuilder};
use wiremock::{
    matchers::{body_json, method, path},
    Mock, MockServer, ResponseTemplate,
};

async fn mock_server() -> MockServer {
    MockServer::start().await
}

fn client(server: &MockServer) -> stellarroute_sdk::StellarRouteClient {
    ClientBuilder::new(server.uri()).build().unwrap()
}

#[tokio::test]
async fn disabled_health_does_not_panic() {
    let server = mock_server().await;
    Mock::given(method("GET"))
        .and(path("/api/v1/card/health"))
        .respond_with(ResponseTemplate::new(404).set_body_json(serde_json::json!({
            "error": "not_found",
            "message": "card disabled"
        })))
        .mount(&server)
        .await;

    let health = client(&server).card_health().await.unwrap();
    assert!(!health.is_enabled());
    assert!(!health.enabled);
}

#[tokio::test]
async fn enabled_health_deserializes_envelope_and_flat() {
    let server = mock_server().await;
    Mock::given(method("GET"))
        .and(path("/api/v1/card/health"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "v": 1,
            "timestamp": 1_700_000_000_000i64,
            "request_id": "req-1",
            "data": { "enabled": true }
        })))
        .mount(&server)
        .await;

    let health = client(&server).card_health().await.unwrap();
    assert!(health.is_enabled());
}

#[tokio::test]
async fn validate_posts_the_draft() {
    let server = mock_server().await;
    Mock::given(method("POST"))
        .and(path("/api/v1/card/applications/validate"))
        .and(body_json(serde_json::json!({
            "applicant_ref": "ref-1",
            "display_name": "Ada"
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "v": 1,
            "timestamp": 1_700_000_000_000i64,
            "request_id": "req-2",
            "data": { "valid": true, "applicant_ref": "ref-1" }
        })))
        .mount(&server)
        .await;

    let out = client(&server)
        .validate_card_application(CardApplicationDraft {
            applicant_ref: "ref-1".into(),
            display_name: Some("Ada".into()),
        })
        .await
        .unwrap();
    assert!(out.valid);
    assert_eq!(out.applicant_ref, "ref-1");
}

#[tokio::test]
async fn list_returns_the_fixture_array() {
    let server = mock_server().await;
    Mock::given(method("GET"))
        .and(path("/api/v1/card/authorizations"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "v": 1,
            "timestamp": 1_700_000_000_000i64,
            "request_id": "req-3",
            "data": {
                "authorizations": [
                    {
                        "id": "auth-1",
                        "status": "declined",
                        "decline_code": "insufficient_funds",
                        "amount": "12.50",
                        "currency": "USD",
                        "created_at": "2026-09-25T00:00:00Z"
                    },
                    { "id": "auth-2", "status": "approved" }
                ],
                "total": 2
            }
        })))
        .mount(&server)
        .await;

    let list = client(&server).list_card_authorizations().await.unwrap();
    assert_eq!(list.len(), 2);
    assert_eq!(list[0].id, "auth-1");
    assert_eq!(list[0].decline_code.as_deref(), Some("insufficient_funds"));
}

#[tokio::test]
async fn list_disabled_returns_empty_vec() {
    let server = mock_server().await;
    Mock::given(method("GET"))
        .and(path("/api/v1/card/authorizations"))
        .respond_with(ResponseTemplate::new(404).set_body_json(serde_json::json!({
            "error": "not_found",
            "message": "card disabled"
        })))
        .mount(&server)
        .await;

    let list = client(&server).list_card_authorizations().await.unwrap();
    assert!(list.is_empty());
}
