import { useState } from "react";
import type { Story } from "@ladle/react";
import "@/app/globals.css";
import { QuoteInspector, type VenueQuote } from "./QuoteInspector";

const meta = {
  title: "Shared/QuoteInspector",
  component: QuoteInspector,
  parameters: {
    layout: "padded",
  },
};

export default meta;

/**
 * Fixtures are frozen snapshots of the quote wire shape. They are display-only:
 * nothing here is fetched, and no story mutates inspector runtime behavior.
 */

const XLM = { asset_type: "native" as const };

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC = {
  asset_type: "credit_alphanum4" as const,
  asset_code: "USDC",
  asset_issuer: USDC_ISSUER,
};

/** Fixed timestamp so the fixture never drifts between renders. */
const FIXTURE_TIMESTAMP = 1713895200;

/**
 * Classic one-hop SDEX quote — the only execution path live today. This is the
 * happy-path fixture an operator should recognise at a glance.
 */
const classicSdexQuote: VenueQuote = {
  base_asset: XLM,
  quote_asset: USDC,
  amount: "1000",
  price: "0.105200",
  total: "105.2000",
  quote_type: "sell",
  timestamp: FIXTURE_TIMESTAMP,
  ttl_seconds: 30,
  venueName: "Stellar SDEX",
  path: [
    {
      from_asset: XLM,
      to_asset: USDC,
      price: "0.105200",
      source: "sdex",
      liquidity_depth: "250000.0000",
      fee_bps: 30,
    },
  ],
};

/**
 * Unsupported / excluded Soroban AMM venue.
 *
 * Display-only by design: the AMM leg is quoted by the aggregator for
 * comparison, but the router does not settle Soroban AMM hops yet, so the
 * venue is surfaced for operator diagnosis and must never be treated as an
 * executable path. `exclusion_diagnostics` records why it was held back.
 */
const unsupportedAmmQuote: VenueQuote = {
  base_asset: XLM,
  quote_asset: USDC,
  amount: "1000",
  price: "0.106100",
  total: "106.1000",
  quote_type: "sell",
  timestamp: FIXTURE_TIMESTAMP,
  ttl_seconds: 30,
  venueName: "Soroban AMM (unsupported)",
  isAggregated: true,
  path: [
    {
      from_asset: XLM,
      to_asset: USDC,
      price: "0.106100",
      source: "amm:CBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      liquidity_depth: "900000.0000",
      fee_bps: 30,
    },
  ],
  exclusion_diagnostics: {
    excluded_venues: [
      {
        venue_ref: "amm:CBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        reason: { type: "policy_threshold", threshold: 400 },
      },
    ],
  },
};

function StoryHarness({ quotes, isLoading }: { quotes: VenueQuote[]; isLoading?: boolean }) {
  const [lastSelected, setLastSelected] = useState<string | null>(null);

  return (
    <div className="dark min-h-screen bg-background text-foreground p-8">
      <QuoteInspector quotes={quotes} onSelect={(q) => setLastSelected(q.venueName)} isLoading={isLoading} />
      {lastSelected ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          onSelect → {lastSelected}
        </p>
      ) : null}
    </div>
  );
}

/** Classic one-hop SDEX prepare path, quoted by the live router. */
export const ClassicSdex: Story = () => <StoryHarness quotes={[classicSdexQuote]} />;
ClassicSdex.storyName = "Classic SDEX (one hop)";

/**
 * Unsupported Soroban AMM venue shown on its own, so operators can see how an
 * excluded venue is rendered without a competing executable row.
 */
export const UnsupportedAmmVenue: Story = () => <StoryHarness quotes={[unsupportedAmmQuote]} />;
UnsupportedAmmVenue.storyName = "Unsupported venue (Soroban AMM)";

/** SDEX next to the excluded AMM venue: the AMM quotes higher but is not executable. */
export const SdexVsExcludedAmm: Story = () => (
  <StoryHarness quotes={[classicSdexQuote, unsupportedAmmQuote]} />
);
SdexVsExcludedAmm.storyName = "SDEX vs excluded AMM";

/** No venue returned quotes — the inspector must stay empty, not blank. */
export const NoQuotes: Story = () => <StoryHarness quotes={[]} />;
NoQuotes.storyName = "No quotes";

/** Skeleton state while the operator is waiting on the quote endpoint. */
export const Loading: Story = () => <StoryHarness quotes={[classicSdexQuote]} isLoading />;
Loading.storyName = "Loading";
