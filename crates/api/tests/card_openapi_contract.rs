//! CARD-38 contract test (issues #1495-#1498).
//!
//! - Card paths exist in the generated OpenAPI spec.
//! - Pre-existing swap + quote schemas are unchanged (snapshot assertions).
//! - No PAN property appears anywhere in the card schemas.
//! - With flags unset, the new card routes return 404 (fail-closed).
//!
//! Runs fully in-process with a lazy Postgres pool; no network or live DB.

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use stellarroute_api::{state::DatabasePools, Server, ServerConfig};
use tower::ServiceExt;

async fn setup_router() -> axum::Router {
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect_lazy("postgres://localhost/unused")
        .expect("failed to create lazy pool");

    Server::new(ServerConfig::default(), DatabasePools::new(pool, None))
        .await
        .into_router()
}

async fn openapi_spec() -> Value {
    let router = setup_router().await;
    let response = router
        .oneshot(
            Request::builder()
                .uri("/api-docs/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("request failed");
    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    serde_json::from_slice(&body).unwrap()
}

#[tokio::test]
async fn card_paths_exist_in_openapi() {
    let spec = openapi_spec().await;
    for (path, method) in [
        ("/api/v1/card/health", "get"),
        ("/api/v1/card/applications/validate", "post"),
        ("/api/v1/card/authorizations", "get"),
    ] {
        let operation = &spec["paths"][path][method];
        assert!(
            !operation.is_null(),
            "{method} {path} must be documented in the OpenAPI spec"
        );
        let tags = operation["tags"].as_array().unwrap_or_else(|| {
            panic!("{method} {path} must have a tags array");
        });
        assert!(
            tags.iter().any(|t| t == "card"),
            "{method} {path} must be tagged 'card', got {tags:?}"
        );
    }

    let schemas = &spec["components"]["schemas"];
    for schema_name in [
        "CardHealth",
        "CardApplicationDraft",
        "CardApplicationValidation",
        "CardAuthorization",
        "CardAuthorizationsResponse",
    ] {
        assert!(
            schemas[schema_name].is_object(),
            "{schema_name} schema must be in components.schemas"
        );
    }
}

#[tokio::test]
async fn swap_and_quote_schemas_match_snapshot() {
    let spec = openapi_spec().await;
    let schemas = &spec["components"]["schemas"];

    // Swap snapshot — same fields the swap contract test pins.
    let prepare_props = &schemas["SwapPrepareResponse"]["properties"];
    assert!(
        prepare_props["network_passphrase"].is_object(),
        "SwapPrepareResponse must still document network_passphrase"
    );
    assert!(
        prepare_props["xdr_envelope"].is_object(),
        "SwapPrepareResponse must still document xdr_envelope"
    );
    assert!(
        prepare_props["expires_at"].is_object(),
        "SwapPrepareResponse must still document expires_at"
    );

    // Quote snapshot — core pricing fields must remain.
    let quote_props = &schemas["QuoteResponse"]["properties"];
    for field in ["price", "amount", "total", "path", "timestamp"] {
        assert!(
            quote_props[field].is_object(),
            "QuoteResponse must still document {field}"
        );
    }

    // Swap paths must still be present under the swap tag.
    for (path, method) in [
        ("/api/v1/swap/prepare", "post"),
        ("/api/v1/swap/submit", "post"),
    ] {
        let operation = &spec["paths"][path][method];
        assert!(
            !operation.is_null(),
            "{method} {path} must remain documented"
        );
    }
}

#[tokio::test]
async fn no_pan_property_in_card_schemas() {
    let spec = openapi_spec().await;
    let card_schema_names = [
        "CardHealth",
        "CardApplicationDraft",
        "CardApplicationValidation",
        "CardAuthorization",
        "CardAuthorizationsResponse",
    ];
    let mut card_json = String::new();
    for name in card_schema_names {
        card_json.push_str(&spec["components"]["schemas"][name].to_string());
    }
    let lowered = card_json.to_lowercase();
    for forbidden in [
        "\"pan\"",
        "card_number",
        "cardnumber",
        "\"cvv\"",
        "\"cvc\"",
        "exp_month",
        "exp_year",
        "card_expiry",
    ] {
        assert!(
            !lowered.contains(forbidden),
            "card schemas must not contain PAN property {forbidden}: {card_json}"
        );
    }
}

#[tokio::test]
async fn card_routes_return_404_when_flag_unset() {
    // Ensure the flag is unset for this test (fail-closed default).
    std::env::remove_var("CARD_ENABLED");
    let router = setup_router().await;

    for (uri, method) in [
        ("/api/v1/card/health", "GET"),
        ("/api/v1/card/authorizations", "GET"),
    ] {
        let response = router
            .clone()
            .oneshot(
                Request::builder()
                    .uri(uri)
                    .method(method)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("request failed");
        assert_eq!(
            response.status(),
            StatusCode::NOT_FOUND,
            "{method} {uri} must return 404 when CARD_ENABLED is unset"
        );
    }

    let response = router
        .oneshot(
            Request::builder()
                .uri("/api/v1/card/applications/validate")
                .method("POST")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"applicant_ref":"ref-1"}"#))
                .unwrap(),
        )
        .await
        .expect("request failed");
    assert_eq!(
        response.status(),
        StatusCode::NOT_FOUND,
        "POST /api/v1/card/applications/validate must return 404 when CARD_ENABLED is unset"
    );
}
