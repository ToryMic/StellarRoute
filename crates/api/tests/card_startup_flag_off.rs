use axum::{body::Body, http::Request};
use sqlx::postgres::PgPoolOptions;
use stellarroute_api::{state::DatabasePools, Server, ServerConfig};
use tower::ServiceExt;

#[tokio::test]
async fn card_tables_are_not_read_when_card_is_disabled() {
    std::env::remove_var("CARD_ENABLED");
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect_lazy("postgres://localhost/unused")
        .expect("failed to create lazy pool");

    let router = Server::new(ServerConfig::default(), DatabasePools::new(pool, None))
        .await
        .into_router();

    let response = router
        .oneshot(
            Request::builder()
                .uri("/api/v1/card/authorizations")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), axum::http::StatusCode::NOT_FOUND);
}
