-- Additive card storage only. Flag-off startup never reads these tables.
CREATE TABLE IF NOT EXISTS card_applications (
    id TEXT PRIMARY KEY,
    applicant_ref TEXT NOT NULL UNIQUE,
    display_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_authorizations (
    id TEXT PRIMARY KEY,
    application_id TEXT REFERENCES card_applications(id),
    status TEXT NOT NULL,
    amount_usdc NUMERIC(38, 7) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USDC',
    merchant_ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    captured_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS card_authorizations_application_id_idx
    ON card_authorizations (application_id);