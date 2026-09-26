//! Merchant Category Code (MCC) blocking configuration.
//!
//! Merchants have category codes. The default list is empty so this issue
//! does not invent a sanctions policy. Operators can configure blocks.

use std::collections::HashSet;

/// MCC block policy configuration.
#[derive(Debug, Clone, Default)]
pub struct MccBlockPolicy {
    /// Set of MCCs (4-digit strings) that are blocked. Empty by default.
    pub blocked_mccs: HashSet<String>,
}

impl MccBlockPolicy {
    /// Create a new empty MCC policy (no blocks).
    pub fn new() -> Self {
        Self {
            blocked_mccs: HashSet::new(),
        }
    }

    /// Create a policy from a list of MCC codes.
    pub fn from_list(mccs: Vec<String>) -> Self {
        Self {
            blocked_mccs: mccs.into_iter().collect(),
        }
    }

    /// Load policy from environment variable (comma-separated MCC codes).
    /// Returns empty policy if not set.
    pub fn from_env() -> Self {
        let mccs = std::env::var("CARD_BLOCKED_MCCS")
            .ok()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
            .map(|v| {
                v.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            })
            .unwrap_or_default();
        Self::from_list(mccs)
    }

    /// Check if an MCC is blocked.
    pub fn is_blocked(&self, mcc: &str) -> bool {
        self.blocked_mccs.contains(mcc)
    }

    /// Add an MCC to the block list.
    pub fn block(&mut self, mcc: String) {
        self.blocked_mccs.insert(mcc);
    }

    /// Remove an MCC from the block list.
    pub fn unblock(&mut self, mcc: &str) -> bool {
        self.blocked_mccs.remove(mcc)
    }

    /// Get the count of blocked MCCs.
    pub fn count(&self) -> usize {
        self.blocked_mccs.len()
    }

    /// Get all blocked MCCs as a sorted vector.
    pub fn blocked_list(&self) -> Vec<String> {
        let mut list: Vec<_> = self.blocked_mccs.iter().cloned().collect();
        list.sort();
        list
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_policy_has_no_blocks() {
        let policy = MccBlockPolicy::default();
        assert_eq!(policy.count(), 0);
        assert!(!policy.is_blocked("5411"));
    }

    #[test]
    fn can_create_policy_from_list() {
        let policy = MccBlockPolicy::from_list(vec!["5411".to_string(), "5412".to_string()]);
        assert_eq!(policy.count(), 2);
        assert!(policy.is_blocked("5411"));
        assert!(policy.is_blocked("5412"));
        assert!(!policy.is_blocked("5413"));
    }

    #[test]
    fn can_add_and_remove_mccs() {
        let mut policy = MccBlockPolicy::new();
        assert_eq!(policy.count(), 0);

        policy.block("5411".to_string());
        assert_eq!(policy.count(), 1);
        assert!(policy.is_blocked("5411"));

        policy.block("5412".to_string());
        assert_eq!(policy.count(), 2);

        assert!(policy.unblock("5411"));
        assert_eq!(policy.count(), 1);
        assert!(!policy.is_blocked("5411"));

        assert!(!policy.unblock("5411"));
        assert_eq!(policy.count(), 1);
    }

    #[test]
    fn blocked_list_is_sorted() {
        let policy = MccBlockPolicy::from_list(vec![
            "5412".to_string(),
            "5411".to_string(),
            "5413".to_string(),
        ]);
        let list = policy.blocked_list();
        assert_eq!(list, vec!["5411", "5412", "5413"]);
    }

    #[test]
    fn duplicate_mccs_are_deduplicated() {
        let policy = MccBlockPolicy::from_list(vec![
            "5411".to_string(),
            "5411".to_string(),
            "5412".to_string(),
        ]);
        assert_eq!(policy.count(), 2);
    }

    #[test]
    fn env_var_parsing_handles_whitespace() {
        std::env::set_var("CARD_BLOCKED_MCCS", "  5411 , 5412 , 5413  ");
        let policy = MccBlockPolicy::from_env();
        assert_eq!(policy.count(), 3);
        assert!(policy.is_blocked("5411"));
        assert!(policy.is_blocked("5412"));
        assert!(policy.is_blocked("5413"));
        std::env::remove_var("CARD_BLOCKED_MCCS");
    }

    #[test]
    fn env_var_parsing_empty_returns_no_blocks() {
        std::env::remove_var("CARD_BLOCKED_MCCS");
        let policy = MccBlockPolicy::from_env();
        assert_eq!(policy.count(), 0);
    }
}
