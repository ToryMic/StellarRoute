//! Card spending limits enforcement.
//!
//! Given prior authorizations in a window and a new gross USDC amount,
//! accept or return limit_exceeded. Boundaries: equal to remaining is allowed;
//! one stroop over is not.

use std::collections::HashMap;

/// A card spending limit window.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpendingLimit {
    /// Total USDC allowed in stroops (7 decimals) during this window.
    pub limit_stroops: i64,
    /// Window duration in seconds.
    pub window_seconds: u64,
}

/// Spending limit check result.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LimitCheckResult {
    /// The amount is within the limit.
    Allowed,
    /// The amount exceeds the limit.
    LimitExceeded,
}

/// Check if a new transaction amount would exceed the spending limit.
///
/// # Arguments
/// * `limit` - The spending limit configuration.
/// * `prior_authorizations` - Map of authorization_id -> (amount_stroops, timestamp_secs).
/// * `new_amount_stroops` - The new transaction amount in stroops.
/// * `now_secs` - Current timestamp in seconds.
///
/// # Returns
/// - `LimitCheckResult::Allowed` if `prior_total + new_amount <= limit_stroops`
/// - `LimitCheckResult::LimitExceeded` otherwise
pub fn check_limit(
    limit: &SpendingLimit,
    prior_authorizations: &HashMap<String, (i64, u64)>,
    new_amount_stroops: i64,
    now_secs: u64,
) -> LimitCheckResult {
    let window_start = now_secs.saturating_sub(limit.window_seconds);
    let mut total_in_window = 0i64;

    for (_auth_id, (amount, timestamp)) in prior_authorizations {
        if *timestamp >= window_start && *timestamp <= now_secs {
            total_in_window = total_in_window.saturating_add(*amount);
        }
    }

    // Equal to remaining is allowed; one stroop over is not.
    if total_in_window.saturating_add(new_amount_stroops) > limit.limit_stroops {
        LimitCheckResult::LimitExceeded
    } else {
        LimitCheckResult::Allowed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_prior_authorizations_allows_within_limit() {
        let limit = SpendingLimit {
            limit_stroops: 1_000_000,
            window_seconds: 3600,
        };
        let prior = HashMap::new();
        assert_eq!(
            check_limit(&limit, &prior, 500_000, 1000),
            LimitCheckResult::Allowed
        );
    }

    #[test]
    fn equal_to_remaining_is_allowed() {
        let limit = SpendingLimit {
            limit_stroops: 1_000_000,
            window_seconds: 3600,
        };
        let mut prior = HashMap::new();
        prior.insert("auth-1".into(), (600_000, 500));
        assert_eq!(
            check_limit(&limit, &prior, 400_000, 1000),
            LimitCheckResult::Allowed
        );
    }

    #[test]
    fn one_stroop_over_is_rejected() {
        let limit = SpendingLimit {
            limit_stroops: 1_000_000,
            window_seconds: 3600,
        };
        let mut prior = HashMap::new();
        prior.insert("auth-1".into(), (600_000, 500));
        assert_eq!(
            check_limit(&limit, &prior, 400_001, 1000),
            LimitCheckResult::LimitExceeded
        );
    }

    #[test]
    fn prior_outside_window_not_counted() {
        let limit = SpendingLimit {
            limit_stroops: 1_000_000,
            window_seconds: 3600,
        };
        let mut prior = HashMap::new();
        // 5000 secs ago, outside the 3600 sec window
        prior.insert("auth-1".into(), (600_000, 100));
        assert_eq!(
            check_limit(&limit, &prior, 900_000, 10000),
            LimitCheckResult::Allowed
        );
    }

    #[test]
    fn multiple_prior_authorizations_sum_correctly() {
        let limit = SpendingLimit {
            limit_stroops: 1_000_000,
            window_seconds: 3600,
        };
        let mut prior = HashMap::new();
        prior.insert("auth-1".into(), (300_000, 500));
        prior.insert("auth-2".into(), (300_000, 600));
        prior.insert("auth-3".into(), (200_000, 700));
        assert_eq!(
            check_limit(&limit, &prior, 200_000, 1000),
            LimitCheckResult::Allowed
        );
        assert_eq!(
            check_limit(&limit, &prior, 200_001, 1000),
            LimitCheckResult::LimitExceeded
        );
    }

    #[test]
    fn zero_amount_is_always_allowed() {
        let limit = SpendingLimit {
            limit_stroops: 1_000_000,
            window_seconds: 3600,
        };
        let mut prior = HashMap::new();
        prior.insert("auth-1".into(), (1_000_000, 500));
        assert_eq!(
            check_limit(&limit, &prior, 0, 1000),
            LimitCheckResult::Allowed
        );
    }

    #[test]
    fn boundary_at_exactly_limit() {
        let limit = SpendingLimit {
            limit_stroops: 1000,
            window_seconds: 3600,
        };
        let prior = HashMap::new();
        assert_eq!(
            check_limit(&limit, &prior, 1000, 1000),
            LimitCheckResult::Allowed
        );
        assert_eq!(
            check_limit(&limit, &prior, 1001, 1000),
            LimitCheckResult::LimitExceeded
        );
    }
}
