export const CARD_SPREAD_BPS = 50;
export const CARD_FLAT_FEE_USDC = 0.5;

export interface CardFeeQuote {
  grossUsdc: number;
  feeUsdc: number;
  netUsdc: number;
  fiatMerchantAmount: number;
}

export interface CardFeeAvailability {
  insufficient: boolean;
  shortfallUsdc: number;
}

function roundUsdc(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000_000) / 10_000_000;
}

export function calculateCardFees(
  grossUsdc: number,
  fiatPerUsdc: number,
): CardFeeQuote {
  if (!Number.isFinite(grossUsdc) || grossUsdc < 0) {
    throw new Error('Gross USDC amount must be a non-negative number.');
  }
  if (!Number.isFinite(fiatPerUsdc) || fiatPerUsdc < 0) {
    throw new Error('Fiat rate must be a non-negative number.');
  }

  const feeUsdc = roundUsdc(
    grossUsdc * (CARD_SPREAD_BPS / 10_000) + CARD_FLAT_FEE_USDC,
  );
  const netUsdc = roundUsdc(Math.max(0, grossUsdc - feeUsdc));

  return {
    grossUsdc: roundUsdc(grossUsdc),
    feeUsdc,
    netUsdc,
    fiatMerchantAmount: roundUsdc(netUsdc * fiatPerUsdc),
  };
}

export function checkCardFeeAvailability(
  availableUsdc: number,
  grossUsdc: number,
): CardFeeAvailability {
  if (!Number.isFinite(availableUsdc) || availableUsdc < 0) {
    throw new Error('Available USDC must be a non-negative number.');
  }
  if (!Number.isFinite(grossUsdc) || grossUsdc < 0) {
    throw new Error('Gross USDC amount must be a non-negative number.');
  }

  return {
    insufficient: availableUsdc < grossUsdc,
    shortfallUsdc: roundUsdc(Math.max(0, grossUsdc - availableUsdc)),
  };
}