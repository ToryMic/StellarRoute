//! Card program (stablecoin debit) — additive, default-off.
//!
//! Every route in this module is gated by `CARD_ENABLED`. When the flag is
//! unset or false the routes answer `404`, exactly like an unknown path, so
//! nothing changes for live users of `/swap`, `/offramp`, or
//! `/cross-chain-swap`. StellarRoute never holds keys or card PANs here: the
//! user signs the partner payment in their own wallet and the partner owns the
//! card credentials.

pub mod authorization;
pub mod fx;
pub mod horizon;
pub mod store;
pub mod webhook;

use std::sync::Arc;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};

use crate::models::{ApiErrorCode, ErrorResponse};

use horizon::{HorizonHttpLookup, HorizonTxLookup};
use store::{CardStore, InMemoryCardStore};

/// Master card feature flag. Defaults to off.
pub const CARD_ENABLED_ENV: &str = "CARD_ENABLED";
/// Partner-owned Stellar account that receives the USDC spend.
pub const CARD_PARTNER_STELLAR_ADDRESS_ENV: &str = "CARD_PARTNER_STELLAR_ADDRESS";
/// Optional USDC issuer pin for the partner payment.
pub const CARD_USDC_ISSUER_ENV: &str = "CARD_USDC_ISSUER";

fn env_nonempty(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// `true` only for an explicit truthy `CARD_ENABLED`.
pub fn is_card_enabled() -> bool {
    env_nonempty(CARD_ENABLED_ENV)
        .map(|v| matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(false)
}

/// Card runtime configuration, resolved once when the router is built.
#[derive(Debug, Clone, Default)]
pub struct CardConfig {
    pub enabled: bool,
    /// Raw `CARD_WEBHOOK_HMAC_KEY` bytes. Only the partner webhook reads it.
    pub webhook_hmac_key: Option<Vec<u8>>,
    /// `CARD_PARTNER_STELLAR_ADDRESS`; authorizations fail closed without it.
    pub partner_address: Option<String>,
    /// Optional `CARD_USDC_ISSUER` pin.
    pub usdc_issuer: Option<String>,
    pub network_passphrase: String,
}

impl CardConfig {
    pub fn from_env() -> Self {
        Self {
            enabled: is_card_enabled(),
            webhook_hmac_key: webhook::webhook_key_from_env(),
            partner_address: env_nonempty(CARD_PARTNER_STELLAR_ADDRESS_ENV),
            usdc_issuer: env_nonempty(CARD_USDC_ISSUER_ENV),
            network_passphrase: crate::swap::tx::network_passphrase_from_env(),
        }
    }
}

/// Shared state for the card routes.
#[derive(Clone)]
pub struct CardState {
    pub config: CardConfig,
    pub store: Arc<dyn CardStore>,
    pub horizon: Arc<dyn HorizonTxLookup>,
}

impl CardState {
    pub fn from_env() -> Self {
        Self {
            config: CardConfig::from_env(),
            store: Arc::new(InMemoryCardStore::default()),
            horizon: Arc::new(HorizonHttpLookup::from_env()),
        }
    }
}

/// `404` returned by every card route while the flag is off.
pub(crate) fn not_found() -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(ErrorResponse::new(ApiErrorCode::NotFound, "Not found")),
    )
        .into_response()
}

/// Card error body: `{ "error": "<code>", "message": "..." }`.
pub(crate) fn card_error(status: StatusCode, code: &str, message: impl Into<String>) -> Response {
    (
        status,
        Json(serde_json::json!({ "error": code, "message": message.into() })),
    )
        .into_response()
}

/// Card routes bound to an explicit state (used by tests).
pub fn router_with_state(state: Arc<CardState>) -> Router {
    Router::new()
        .route(
            "/api/v1/card/authorizations",
            post(authorization::record_authorization),
        )
        .route(
            "/api/v1/card/partner/events",
            post(webhook::partner_events),
        )
        .with_state(state)
}

/// Card routes configured from the environment.
pub fn router() -> Router {
    router_with_state(Arc::new(CardState::from_env()))
}

#[cfg(test)]
pub(crate) mod test_support {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::Request;
    use tower::ServiceExt;

    pub async fn send(
        app: Router,
        path: &str,
        headers: &[(&str, &str)],
        body: impl Into<Body>,
    ) -> (StatusCode, serde_json::Value) {
        let mut req = Request::builder()
            .method("POST")
            .uri(path)
            .header("content-type", "application/json");
        for (k, v) in headers {
            req = req.header(*k, *v);
        }
        let resp = app.oneshot(req.body(body.into()).unwrap()).await.unwrap();
        let status = resp.status();
        let bytes = to_bytes(resp.into_body(), 1 << 20).await.unwrap();
        let json = serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);
        (status, json)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_disabled() {
        assert!(!CardConfig::default().enabled);
    }
}
