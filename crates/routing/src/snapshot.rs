//! Snapshot isolation validator for multi-hop quote assembly.
//!
//! # Problem
//! In a multi-hop swap (e.g. XLM → USDC → BTC) each hop reads pool/orderbook
//! state.  If two hops read from *different* market snapshots (different ledger
//! sequences), the assembled quote is internally inconsistent: the price used
//! for hop 1 may no longer hold by the time hop 2 executes.
//!
//! # Solution
//! Every [`LiquidityEdge`] that enters a multi-hop path must carry the same
//! `snapshot_id` (an opaque monotonic counter derived from the ledger sequence
//! at which pool state was captured).  This module validates that invariant and
//! returns a machine-readable [`SnapshotIsolationError`] when it is violated.
//!
//! # Metrics
//! A [`SnapshotIsolationMetrics`] counter is updated on every validation call
//! so Prometheus scrapers can alert on isolation violations.

use crate::pathfinder::SwapPath;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use thiserror::Error;

// ── Snapshot identifier ───────────────────────────────────────────────────────

/// Opaque monotonic snapshot identifier derived from a ledger sequence number.
///
/// Two hops are considered *snapshot-compatible* if and only if their
/// `SnapshotId`s are equal.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SnapshotId(pub u64);

impl fmt::Display for SnapshotId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "snapshot#{}", self.0)
    }
}

// ── Errors ────────────────────────────────────────────────────────────────────

/// Machine-readable error returned when snapshot isolation is violated.
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum SnapshotIsolationError {
    /// Two or more hops in the path used state from different snapshots.
    #[error("mixed snapshot ids in path: hop {hop_index} uses {hop_snapshot}, expected {expected_snapshot}")]
    MixedSnapshots {
        /// Zero-based index of the offending hop.
        hop_index: usize,
        /// The snapshot id on the first hop (the expected baseline).
        expected_snapshot: SnapshotId,
        /// The snapshot id found on the offending hop.
        hop_snapshot: SnapshotId,
        /// Human-readable venue reference of the offending hop.
        venue_ref: String,
    },
    /// The path carries no hops and therefore cannot be validated.
    #[error("path contains no hops")]
    EmptyPath,
}

// ── Validated hop ─────────────────────────────────────────────────────────────

/// A path hop that has been stamped with its market snapshot id.
///
/// Callers that assemble multi-hop paths should attach a `snapshot_id` to each
/// hop at the time pool state is read.  The validator then checks consistency.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ValidatedHop {
    /// The snapshot at which this hop's pool/orderbook state was captured.
    pub snapshot_id: SnapshotId,
    /// The venue reference (e.g. AMM pool address or SDEX offer-book key).
    pub venue_ref: String,
    /// Source asset key.
    pub source_asset: String,
    /// Destination asset key.
    pub destination_asset: String,
}

// ── Metrics ───────────────────────────────────────────────────────────────────

/// Shared atomic counters tracking validator outcomes.
///
/// Mount these in your Prometheus registry by reading them in the metrics
/// scrape handler.
#[derive(Clone, Default)]
pub struct SnapshotIsolationMetrics {
    inner: Arc<SnapshotIsolationMetricsInner>,
}

#[derive(Default)]
struct SnapshotIsolationMetricsInner {
    total_validations: AtomicU64,
    violations: AtomicU64,
    empty_paths: AtomicU64,
}

impl SnapshotIsolationMetrics {
    /// Number of times `validate` has been called.
    pub fn total_validations(&self) -> u64 {
        self.inner.total_validations.load(Ordering::Relaxed)
    }

    /// Number of validation calls that detected a snapshot mismatch.
    pub fn violations(&self) -> u64 {
        self.inner.violations.load(Ordering::Relaxed)
    }

    /// Number of validation calls that received an empty path.
    pub fn empty_paths(&self) -> u64 {
        self.inner.empty_paths.load(Ordering::Relaxed)
    }
}

// ── Config ────────────────────────────────────────────────────────────────────

/// Configuration for the snapshot isolation validator.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SnapshotValidatorConfig {
    /// When `true` the validator strictly rejects any mixed-snapshot path.
    /// When `false` it records the violation in metrics but returns `Ok`.
    /// Defaults to `true` (strict).
    pub strict: bool,
}

impl Default for SnapshotValidatorConfig {
    fn default() -> Self {
        Self { strict: true }
    }
}

// ── Validator ─────────────────────────────────────────────────────────────────

/// Validates that all hops in a multi-hop path share the same snapshot id.
pub struct SnapshotIsolationValidator {
    config: SnapshotValidatorConfig,
    metrics: SnapshotIsolationMetrics,
}

impl SnapshotIsolationValidator {
    /// Create a new validator with default (strict) config and fresh metrics.
    pub fn new(config: SnapshotValidatorConfig) -> Self {
        Self {
            config,
            metrics: SnapshotIsolationMetrics::default(),
        }
    }

    /// Shared read access to the metrics counters.
    pub fn metrics(&self) -> &SnapshotIsolationMetrics {
        &self.metrics
    }

    /// Validate snapshot consistency across a slice of stamped hops.
    ///
    /// Returns `Err(SnapshotIsolationError::MixedSnapshots)` if any hop
    /// deviates from the snapshot of the first hop.
    pub fn validate_hops(&self, hops: &[ValidatedHop]) -> Result<(), SnapshotIsolationError> {
        self.metrics
            .inner
            .total_validations
            .fetch_add(1, Ordering::Relaxed);

        if hops.is_empty() {
            self.metrics
                .inner
                .empty_paths
                .fetch_add(1, Ordering::Relaxed);
            if self.config.strict {
                return Err(SnapshotIsolationError::EmptyPath);
            }
            return Ok(());
        }

        let baseline = hops[0].snapshot_id;
        for (idx, hop) in hops.iter().enumerate().skip(1) {
            if hop.snapshot_id != baseline {
                self.metrics
                    .inner
                    .violations
                    .fetch_add(1, Ordering::Relaxed);
                tracing::warn!(
                    hop_index = idx,
                    expected = %baseline,
                    found = %hop.snapshot_id,
                    venue_ref = %hop.venue_ref,
                    "snapshot isolation violation detected"
                );
                if self.config.strict {
                    return Err(SnapshotIsolationError::MixedSnapshots {
                        hop_index: idx,
                        expected_snapshot: baseline,
                        hop_snapshot: hop.snapshot_id,
                        venue_ref: hop.venue_ref.clone(),
                    });
                }
            }
        }

        Ok(())
    }

    /// Convenience: extract `ValidatedHop`s from a [`SwapPath`] using a
    /// uniform `snapshot_id` (i.e. the snapshot captured when the path was
    /// assembled).  This is the common case where the caller already knows
    /// the snapshot under which the whole path was built.
    ///
    /// For paths where each hop may have been read from a different snapshot
    /// use `validate_hops` directly with individually stamped hops.
    pub fn validate_path_uniform(
        &self,
        path: &SwapPath,
        snapshot_id: SnapshotId,
    ) -> Result<(), SnapshotIsolationError> {
        let hops: Vec<ValidatedHop> = path
            .hops
            .iter()
            .map(|h| ValidatedHop {
                snapshot_id,
                venue_ref: h.venue_ref.clone(),
                source_asset: h.source_asset.clone(),
                destination_asset: h.destination_asset.clone(),
            })
            .collect();
        self.validate_hops(&hops)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn hop(snapshot: u64, venue: &str) -> ValidatedHop {
        ValidatedHop {
            snapshot_id: SnapshotId(snapshot),
            venue_ref: venue.to_string(),
            source_asset: "XLM".to_string(),
            destination_asset: "USDC".to_string(),
        }
    }

    fn strict_validator() -> SnapshotIsolationValidator {
        SnapshotIsolationValidator::new(SnapshotValidatorConfig { strict: true })
    }

    fn lenient_validator() -> SnapshotIsolationValidator {
        SnapshotIsolationValidator::new(SnapshotValidatorConfig { strict: false })
    }

    #[test]
    fn test_consistent_snapshots_pass() {
        let v = strict_validator();
        let hops = vec![hop(42, "pool_a"), hop(42, "pool_b"), hop(42, "pool_c")];
        assert!(v.validate_hops(&hops).is_ok());
    }

    #[test]
    fn test_mixed_snapshot_rejected_strict() {
        let v = strict_validator();
        let hops = vec![hop(42, "pool_a"), hop(43, "pool_b")];
        let err = v.validate_hops(&hops).unwrap_err();
        match err {
            SnapshotIsolationError::MixedSnapshots {
                hop_index,
                expected_snapshot,
                hop_snapshot,
                venue_ref,
            } => {
                assert_eq!(hop_index, 1);
                assert_eq!(expected_snapshot, SnapshotId(42));
                assert_eq!(hop_snapshot, SnapshotId(43));
                assert_eq!(venue_ref, "pool_b");
            }
            other => panic!("unexpected error: {other}"),
        }
    }

    #[test]
    fn test_mixed_snapshot_allowed_lenient() {
        let v = lenient_validator();
        let hops = vec![hop(42, "pool_a"), hop(99, "pool_b")];
        assert!(v.validate_hops(&hops).is_ok());
        assert_eq!(v.metrics().violations(), 1);
    }

    #[test]
    fn test_empty_path_rejected_strict() {
        let v = strict_validator();
        assert!(matches!(
            v.validate_hops(&[]),
            Err(SnapshotIsolationError::EmptyPath)
        ));
        assert_eq!(v.metrics().empty_paths(), 1);
    }

    #[test]
    fn test_empty_path_allowed_lenient() {
        let v = lenient_validator();
        assert!(v.validate_hops(&[]).is_ok());
    }

    #[test]
    fn test_metrics_total_validations_increment() {
        let v = strict_validator();
        for _ in 0..5 {
            let _ = v.validate_hops(&[hop(1, "pool_a"), hop(1, "pool_b")]);
        }
        assert_eq!(v.metrics().total_validations(), 5);
    }

    #[test]
    fn test_metrics_violation_count() {
        let v = strict_validator();
        let _ = v.validate_hops(&[hop(1, "pool_a"), hop(2, "pool_b")]);
        let _ = v.validate_hops(&[hop(1, "pool_a"), hop(2, "pool_b")]);
        let _ = v.validate_hops(&[hop(1, "pool_a"), hop(1, "pool_b")]); // ok
        assert_eq!(v.metrics().violations(), 2);
    }

    #[test]
    fn test_single_hop_always_passes() {
        let v = strict_validator();
        assert!(v.validate_hops(&[hop(77, "pool_x")]).is_ok());
    }

    #[test]
    fn test_error_is_serializable() {
        let err = SnapshotIsolationError::MixedSnapshots {
            hop_index: 2,
            expected_snapshot: SnapshotId(10),
            hop_snapshot: SnapshotId(11),
            venue_ref: "pool_z".to_string(),
        };
        let json = serde_json::to_string(&err).expect("should serialize");
        assert!(
            json.contains("mixed_snapshots")
                || json.contains("MixedSnapshots")
                || json.contains("hop_index")
        );
    }

    #[test]
    fn test_concurrent_update_detection() {
        // Simulates two concurrent indexer updates producing different ledger seqs.
        // Hop 0 was read at ledger 1000, hop 1 at ledger 1001 due to a concurrent update.
        let v = strict_validator();
        let hops = vec![
            ValidatedHop {
                snapshot_id: SnapshotId(1000),
                venue_ref: "xlm_usdc_amm".into(),
                source_asset: "XLM".into(),
                destination_asset: "USDC".into(),
            },
            ValidatedHop {
                snapshot_id: SnapshotId(1001), // concurrent update bumped this
                venue_ref: "usdc_btc_sdex".into(),
                source_asset: "USDC".into(),
                destination_asset: "BTC".into(),
            },
        ];
        assert!(
            v.validate_hops(&hops).is_err(),
            "concurrent-update mixed snapshot must be rejected"
        );
    }

    // ── Serde round-trips ───────────────────────────────────────────────────
    //
    // None of the types in this module enable `serde(deny_unknown_fields)`,
    // so deserialization *tolerates* unknown fields (they are ignored) and
    // serialization never emits fields beyond the ones declared here. The
    // round-trip tests below pin both halves of that contract: a payload we
    // emit must read back identically, and a payload from a *newer* producer
    // (extra fields) must still deserialize into the current shape instead of
    // erroring or silently dropping required fields.

    /// Multi-venue fixture: SDEX, Soroban AMM, and a cross-chain bridge hop
    /// captured under a single snapshot id.
    fn multi_venue_hops(snapshot: u64) -> Vec<ValidatedHop> {
        vec![
            ValidatedHop {
                snapshot_id: SnapshotId(snapshot),
                venue_ref: "sdex_xlm_usdc".to_string(),
                source_asset: "XLM".to_string(),
                destination_asset: "USDC".to_string(),
            },
            ValidatedHop {
                snapshot_id: SnapshotId(snapshot),
                venue_ref: "amm_phoenix_usdc_btc".to_string(),
                source_asset: "USDC".to_string(),
                destination_asset: "BTC".to_string(),
            },
            ValidatedHop {
                snapshot_id: SnapshotId(snapshot),
                venue_ref: "bridge_base_btc_eth".to_string(),
                source_asset: "BTC".to_string(),
                destination_asset: "ETH".to_string(),
            },
        ]
    }

    /// A `SwapPath` mirroring [`multi_venue_hops`] for the uniform-snapshot API.
    fn multi_venue_path() -> SwapPath {
        SwapPath {
            hops: multi_venue_hops(0)
                .iter()
                .map(|h| crate::pathfinder::PathHop {
                    source_asset: h.source_asset.clone(),
                    destination_asset: h.destination_asset.clone(),
                    venue_type: if h.venue_ref.starts_with("sdex") {
                        "sdex".to_string()
                    } else if h.venue_ref.starts_with("amm") {
                        "soroban_amm".to_string()
                    } else {
                        "bridge".to_string()
                    },
                    venue_ref: h.venue_ref.clone(),
                    price: 1.0,
                    fee_bps: 30,
                    provider: None,
                    bridge: None,
                })
                .collect(),
            estimated_output: 250_000,
        }
    }

    #[test]
    fn test_snapshot_id_json_round_trip() {
        let id = SnapshotId(8_675_309);
        let json = serde_json::to_string(&id).expect("snapshot id should serialize");
        // Newtype struct: the wire form is the bare u64, not an object.
        assert_eq!(json, "8675309");
        let decoded: SnapshotId =
            serde_json::from_str(&json).expect("snapshot id should deserialize");
        assert_eq!(decoded, id);
    }

    #[test]
    fn test_snapshot_id_display_is_stable() {
        assert_eq!(SnapshotId(42).to_string(), "snapshot#42");
    }

    #[test]
    fn test_validated_hop_json_round_trip() {
        let hops = multi_venue_hops(7);
        let single = &hops[1];
        let json = serde_json::to_string(single).expect("hop should serialize");
        let decoded: ValidatedHop = serde_json::from_str(&json).expect("hop should deserialize");
        assert_eq!(decoded.snapshot_id, single.snapshot_id);
        assert_eq!(decoded.venue_ref, single.venue_ref);
        assert_eq!(decoded.source_asset, single.source_asset);
        assert_eq!(decoded.destination_asset, single.destination_asset);
    }

    #[test]
    fn test_validated_hop_json_field_names_are_stable() {
        let hops = multi_venue_hops(7);
        let value = serde_json::to_value(&hops[0]).expect("hop should serialize");
        let obj = value.as_object().expect("hop should be a JSON object");
        assert_eq!(obj.len(), 4, "hop JSON must not grow new fields");
        for field in [
            "snapshot_id",
            "venue_ref",
            "source_asset",
            "destination_asset",
        ] {
            assert!(obj.contains_key(field), "missing hop field `{field}`");
        }
    }

    #[test]
    fn test_multi_venue_hops_round_trip_and_still_validate() {
        let hops = multi_venue_hops(1_234_567);
        let json = serde_json::to_string(&hops).expect("hops should serialize");
        let decoded: Vec<ValidatedHop> =
            serde_json::from_str(&json).expect("hops should deserialize");
        assert_eq!(decoded.len(), 3, "multi-venue fixture must keep 3 venues");

        // Round-trip must preserve every venue and every asset leg.
        for (original, back) in hops.iter().zip(decoded.iter()) {
            assert_eq!(back.snapshot_id, original.snapshot_id);
            assert_eq!(back.venue_ref, original.venue_ref);
            assert_eq!(back.source_asset, original.source_asset);
            assert_eq!(back.destination_asset, original.destination_asset);
        }

        // And the decoded hops must still satisfy snapshot isolation, i.e.
        // the round-trip did not lose the snapshot stamping.
        let v = strict_validator();
        assert!(v.validate_hops(&decoded).is_ok());
        assert_eq!(v.metrics().violations(), 0);
    }

    #[test]
    fn test_multi_venue_path_uniform_round_trip_and_validate() {
        let path = multi_venue_path();
        let json = serde_json::to_string(&path).expect("path should serialize");
        let decoded: SwapPath = serde_json::from_str(&json).expect("path should deserialize");
        assert_eq!(decoded.hops.len(), 3);
        assert_eq!(decoded.estimated_output, path.estimated_output);

        let v = strict_validator();
        assert!(v.validate_path_uniform(&decoded, SnapshotId(99)).is_ok());
    }

    #[test]
    fn test_mixed_snapshots_survive_round_trip_as_typed_diff() {
        let v = strict_validator();
        let mut hops = multi_venue_hops(1_000);
        hops[2].snapshot_id = SnapshotId(1_001);

        let err = v
            .validate_hops(&hops)
            .expect_err("mixed snapshots must be rejected");
        let json = serde_json::to_string(&err).expect("error should serialize");
        let decoded: SnapshotIsolationError =
            serde_json::from_str(&json).expect("error should deserialize");
        match decoded {
            SnapshotIsolationError::MixedSnapshots {
                hop_index,
                expected_snapshot,
                hop_snapshot,
                venue_ref,
            } => {
                assert_eq!(hop_index, 2);
                assert_eq!(expected_snapshot, SnapshotId(1_000));
                assert_eq!(hop_snapshot, SnapshotId(1_001));
                assert_eq!(venue_ref, "bridge_base_btc_eth");
            }
            other => panic!("unexpected error after round-trip: {other}"),
        }
    }

    #[test]
    fn test_empty_path_error_round_trips() {
        let err = SnapshotIsolationError::EmptyPath;
        let json = serde_json::to_string(&err).expect("error should serialize");
        let decoded: SnapshotIsolationError =
            serde_json::from_str(&json).expect("error should deserialize");
        assert!(matches!(decoded, SnapshotIsolationError::EmptyPath));
    }

    #[test]
    fn test_validator_config_round_trips_both_strictness_modes() {
        for strict in [true, false] {
            let config = SnapshotValidatorConfig { strict };
            let json = serde_json::to_string(&config).expect("config should serialize");
            let decoded: SnapshotValidatorConfig =
                serde_json::from_str(&json).expect("config should deserialize");
            assert_eq!(decoded.strict, strict);
        }

        // Default stays strict, and the default round-trips to strict.
        let default_json = serde_json::to_string(&SnapshotValidatorConfig::default())
            .expect("default config should serialize");
        assert_eq!(default_json, "{\"strict\":true}");
    }

    #[test]
    fn test_unknown_fields_are_tolerated_on_deserialize() {
        // `serde(deny_unknown_fields)` is intentionally NOT enabled on this
        // module's types, so a payload written by a newer producer that adds
        // fields must still deserialize. This documents that tolerance and
        // guards against someone adding `deny_unknown_fields` later and
        // breaking replay of previously persisted snapshots.
        let json = r#"{
            "snapshot_id": 5,
            "venue_ref": "amm_future_pool",
            "source_asset": "USDC",
            "destination_asset": "BTC",
            "future_field": {"nested": [1, 2, 3]}
        }"#;
        let hop: ValidatedHop =
            serde_json::from_str(json).expect("unknown fields must be ignored, not rejected");
        assert_eq!(hop.snapshot_id, SnapshotId(5));
        assert_eq!(hop.venue_ref, "amm_future_pool");
        assert_eq!(hop.source_asset, "USDC");
        assert_eq!(hop.destination_asset, "BTC");
    }

    #[test]
    fn test_missing_required_field_is_still_rejected() {
        // Tolerance is only for *extra* fields: dropping a required field must
        // still fail loudly rather than yielding a half-populated hop.
        let json = r#"{"snapshot_id": 5, "venue_ref": "pool"}"#;
        let err = serde_json::from_str::<ValidatedHop>(json)
            .expect_err("missing required fields must be rejected");
        assert!(!err.to_string().is_empty());
    }
}
